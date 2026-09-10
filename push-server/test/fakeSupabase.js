/**
 * Cliente Supabase falso, só com o suficiente para exercitar o runner:
 * select/eq/gte/order/limit encadeados, insert, update().eq() e delete().in().
 *
 * Guarda tudo em memória e registra as escritas para as asserções.
 */
export function fakeSupabase(tabelas = {}) {
  const db = {
    profiles: [],
    daily_checkins: [],
    dreams: [],
    notification_log: [],
    push_subscriptions: [],
    ...tabelas,
  }
  const escritas = { inseridos: [], atualizados: [], removidos: [] }

  function builder(tabela) {
    let linhas = () => db[tabela] ?? []
    const filtros = []
    let ordem = null
    let limite = null
    let modo = 'select'
    let carga = null

    const aplica = () => {
      let out = [...linhas()]
      for (const f of filtros) out = out.filter(f)
      if (ordem) {
        out.sort((a, b) => String(a[ordem.campo]).localeCompare(String(b[ordem.campo])))
        if (!ordem.asc) out.reverse()
      }
      if (limite !== null) out = out.slice(0, limite)
      return out
    }

    const api = {
      select() {
        return api
      },
      insert(valores) {
        modo = 'insert'
        carga = Array.isArray(valores) ? valores : [valores]
        return api
      },
      update(valores) {
        modo = 'update'
        carga = valores
        return api
      },
      delete() {
        modo = 'delete'
        return api
      },
      eq(campo, valor) {
        filtros.push((r) => r[campo] === valor)
        return api
      },
      gte(campo, valor) {
        filtros.push((r) => String(r[campo]) >= String(valor))
        return api
      },
      in(campo, valores) {
        filtros.push((r) => valores.includes(r[campo]))
        return api
      },
      order(campo, opts = {}) {
        ordem = { campo, asc: opts.ascending !== false }
        return api
      },
      limit(n) {
        limite = n
        return api
      },
      then(resolve, reject) {
        try {
          if (modo === 'insert') {
            db[tabela] = [...(db[tabela] ?? []), ...carga]
            escritas.inseridos.push({ tabela, linhas: carga })
            return resolve({ data: carga, error: null })
          }
          if (modo === 'update') {
            const alvo = aplica()
            for (const r of alvo) Object.assign(r, carga)
            escritas.atualizados.push({ tabela, linhas: alvo.length, valores: carga })
            return resolve({ data: alvo, error: null })
          }
          if (modo === 'delete') {
            const alvo = aplica()
            db[tabela] = (db[tabela] ?? []).filter((r) => !alvo.includes(r))
            escritas.removidos.push({ tabela, linhas: alvo.length })
            return resolve({ data: alvo, error: null })
          }
          return resolve({ data: aplica(), error: null })
        } catch (err) {
          return reject ? reject(err) : Promise.reject(err)
        }
      },
    }
    return api
  }

  return { from: (tabela) => builder(tabela), db, escritas }
}
