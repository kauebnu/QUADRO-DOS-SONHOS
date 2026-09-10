import { buildDailyMessage, dayNumber, localDate, localHour, saltFromId } from './messages.js'

/**
 * Lógica da rodada de notificações, isolada das dependências externas
 * (Supabase e web-push entram por parâmetro) para poder ser testada.
 *
 * @param {object} deps
 * @param {import('@supabase/supabase-js').SupabaseClient} deps.sb
 * @param {(sub:object, payload:string, opts:object)=>Promise<unknown>} deps.enviarPush
 * @param {boolean} [deps.dryRun]
 * @param {(...a:unknown[])=>void} [deps.log]
 */
export function criarRodada({ sb, enviarPush, dryRun = false, log = () => {} }) {
  let rodando = false

  async function montarContexto(profile, agora) {
    const tz = profile.timezone || 'America/Sao_Paulo'
    const hojeLocal = localDate(tz, agora)

    const [{ data: checkins }, { data: dreams }] = await Promise.all([
      sb
        .from('daily_checkins')
        .select('day')
        .eq('user_id', profile.id)
        .order('day', { ascending: false })
        .limit(40),
      sb
        .from('dreams')
        .select('title, target_date, status, archived')
        .eq('owner_id', profile.id)
        .eq('status', 'active')
        .eq('archived', false),
    ])

    const dias = (checkins ?? []).map((c) => c.day)
    const emDias = (a, b) =>
      Math.round((new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86_400_000)

    let diasSemCheckin = null
    if (dias.length > 0) diasSemCheckin = Math.max(0, emDias(hojeLocal, dias[0]))

    let sequencia = 0
    if (diasSemCheckin !== null && diasSemCheckin <= 1) {
      sequencia = 1
      for (let i = 1; i < dias.length; i++) {
        if (emDias(dias[i - 1], dias[i]) === 1) sequencia++
        else break
      }
    }

    const comPrazo = (dreams ?? [])
      .filter((d) => d.target_date)
      .map((d) => ({ title: d.title, days: emDias(d.target_date, hojeLocal) }))
      .sort((a, b) => a.days - b.days)

    return {
      nome: profile.display_name ?? '',
      dayNumber: dayNumber(agora),
      saltUsuario: saltFromId(profile.id),
      diasSemCheckin,
      sequencia,
      sonhoAtrasado: comPrazo.find((d) => d.days < 0) ?? null,
      sonhoProximo: comPrazo.find((d) => d.days >= 0 && d.days <= 45) ?? null,
    }
  }

  async function enviarParaUsuario(userId, subs, payload, agora = new Date()) {
    let entregues = 0
    const expiradas = []

    for (const sub of subs) {
      if (dryRun) {
        entregues++
        continue
      }
      try {
        await enviarPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12, urgency: 'normal' },
        )
        entregues++
      } catch (err) {
        const status = err?.statusCode
        // 404/410 = inscrição morta (app desinstalado, permissão revogada)
        if (status === 404 || status === 410) expiradas.push(sub.endpoint)
        else log(`  ! falha ao enviar (${status ?? '?'}): ${err?.message ?? err}`)
      }
    }

    if (expiradas.length && !dryRun) {
      await sb.from('push_subscriptions').delete().in('endpoint', expiradas)
      log(`  · ${expiradas.length} inscrição(ões) expirada(s) removida(s)`)
    }

    if (entregues > 0 && !dryRun) {
      const carimbo = agora.toISOString()
      await sb
        .from('push_subscriptions')
        .update({ last_sent_at: carimbo })
        .eq('user_id', userId)
      // sent_at explícito: a deduplicação depende dele, então não confiamos
      // apenas no default do banco
      await sb.from('notification_log').insert({
        user_id: userId,
        kind: payload.kind,
        title: payload.title,
        body: payload.body,
        sent_at: carimbo,
      })
    }

    return { entregues, expiradas: expiradas.length }
  }

  /** Executa uma rodada. Nunca roda duas em paralelo. */
  async function rodada(agora = new Date()) {
    if (rodando) {
      log('· rodada anterior ainda em andamento, pulando')
      return { pulado: true, candidatos: 0, usuarios: 0, enviados: 0, erros: 0 }
    }
    rodando = true

    const resumo = { candidatos: 0, usuarios: 0, enviados: 0, erros: 0, pulado: false }

    try {
      const { data: profiles, error } = await sb
        .from('profiles')
        .select('id, display_name, timezone, notification_hour, notifications_on')
        .eq('notifications_on', true)

      if (error) throw error

      for (const profile of profiles ?? []) {
        const tz = profile.timezone || 'America/Sao_Paulo'
        const hora = localHour(tz, agora)
        if (hora === null) {
          log(`! fuso inválido para ${profile.id}: ${tz}`)
          resumo.erros++
          continue
        }
        if (hora !== profile.notification_hour) continue

        resumo.candidatos++

        // Uma notificação por dia. Usamos uma janela de 20 horas em vez da
        // meia-noite local: funciona em qualquer fuso, sobrevive ao horário
        // de verão e impede repetição entre os tiques da mesma hora.
        const desde = new Date(agora.getTime() - 20 * 60 * 60 * 1000).toISOString()
        const { data: jaEnviado } = await sb
          .from('notification_log')
          .select('id')
          .eq('user_id', profile.id)
          .gte('sent_at', desde)
          .limit(1)

        if (jaEnviado?.length) continue

        const { data: subs } = await sb
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', profile.id)

        if (!subs?.length) continue

        try {
          const ctx = await montarContexto(profile, agora)
          const payload = { ...buildDailyMessage(ctx), tag: 'wedream-diario' }
          const { entregues } = await enviarParaUsuario(profile.id, subs, payload, agora)
          if (entregues > 0) {
            resumo.usuarios++
            resumo.enviados += entregues
            log(`✓ ${profile.display_name || profile.id} (${payload.kind}) → ${entregues} aparelho(s)`)
          }
        } catch (err) {
          resumo.erros++
          log(`! erro no usuário ${profile.id}: ${err?.message ?? err}`)
        }
      }
    } catch (err) {
      resumo.erros++
      log(`! erro na rodada: ${err?.message ?? err}`)
    } finally {
      rodando = false
    }

    return resumo
  }

  return { rodada, montarContexto, enviarParaUsuario }
}
