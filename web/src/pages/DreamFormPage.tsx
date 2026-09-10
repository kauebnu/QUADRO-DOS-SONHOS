import { ArrowLeft, Camera, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DreamImage } from '../components/DreamImage'
import { ConfirmDialog, Field, Switch } from '../components/ui'
import { compressImage } from '../lib/dreamArt'
import { cn, today } from '../lib/format'
import type { DreamInput, DreamScope } from '../lib/types'
import { useApp } from '../store/AppProvider'

const PRIORITIES: { value: number; label: string; emoji: string }[] = [
  { value: 1, label: 'Prioridade máxima', emoji: '🔥' },
  { value: 2, label: 'Importante', emoji: '⭐' },
  { value: 3, label: 'Um dia', emoji: '🌙' },
]

export function DreamFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'novo'
  const navigate = useNavigate()
  const { data, addDream, editDream, removeDream, uploadImage, notify, user } = useApp()

  const existing = useMemo(
    () => (isNew ? null : data.dreams.find((d) => d.id === id) ?? null),
    [data.dreams, id, isNew],
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [plan, setPlan] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [scope, setScope] = useState<DreamScope>('individual')
  const [shareWithPartner, setShareWithPartner] = useState(false)
  const [dateAdded, setDateAdded] = useState(today())
  const [targetDate, setTargetDate] = useState('')
  const [amount, setAmount] = useState('')
  const [priority, setPriority] = useState(2)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const canEdit = !existing || existing.owner_id === user?.id || existing.scope === 'couple'
  const hasCouple = Boolean(data.couple)

  useEffect(() => {
    if (!existing) return
    setTitle(existing.title)
    setDescription(existing.description)
    setPlan(existing.plan)
    setCategoryId(existing.category_id ?? '')
    setScope(existing.scope)
    setShareWithPartner(existing.share_with_partner)
    setDateAdded(existing.date_added)
    setTargetDate(existing.target_date ?? '')
    setAmount(existing.target_amount ? String(existing.target_amount) : '')
    setPriority(existing.priority)
    setImagePath(existing.image_path)
  }, [existing])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      notify('Escolha um arquivo de imagem (JPG, PNG ou WEBP).', 'erro')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      notify('Essa foto é muito grande. Use uma até 15 MB.', 'erro')
      return
    }

    try {
      const blob = await compressImage(file)
      setPendingFile(blob)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(URL.createObjectURL(blob))
    } catch {
      notify('Não consegui processar essa imagem. Tente outra.', 'erro')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return

    const cleanTitle = title.trim()
    if (!cleanTitle) {
      notify('Dê um nome ao seu sonho.', 'erro')
      return
    }

    const parsedAmount = amount.trim() ? Number(amount.replace(/\./g, '').replace(',', '.')) : null
    if (parsedAmount !== null && (Number.isNaN(parsedAmount) || parsedAmount < 0)) {
      notify('O valor do sonho precisa ser um número positivo.', 'erro')
      return
    }
    if (targetDate && dateAdded && targetDate < dateAdded) {
      notify('A data de realizar não pode ser antes da data de adicionar.', 'erro')
      return
    }

    setBusy(true)
    try {
      const patch: DreamInput = {
        title: cleanTitle,
        description: description.trim(),
        plan: plan.trim(),
        category_id: categoryId || null,
        scope: hasCouple ? scope : 'individual',
        share_with_partner: hasCouple && scope === 'individual' ? shareWithPartner : false,
        couple_id: hasCouple ? data.couple!.id : null,
        date_added: dateAdded || today(),
        target_date: targetDate || null,
        target_amount: parsedAmount,
        priority,
      }

      const saved = existing
        ? await editDream(existing.id, patch)
        : await addDream({ ...patch, title: cleanTitle })

      if (pendingFile) {
        const ext = pendingFile.type.includes('webp')
          ? 'webp'
          : pendingFile.type.includes('png')
            ? 'png'
            : pendingFile.type.includes('gif')
              ? 'gif'
              : 'jpg'
        const path = await uploadImage(saved.id, pendingFile, ext)
        await editDream(saved.id, { image_path: path })
      }

      navigate(`/sonho/${saved.id}`, { replace: true })
    } catch {
      /* toast já mostrou */
    } finally {
      setBusy(false)
    }
  }

  if (!isNew && !existing) {
    return (
      <div className="card p-10 text-center">
        <p className="muted">Sonho não encontrado.</p>
        <button className="btn-ghost mt-5" onClick={() => navigate('/quadro')}>
          Voltar ao quadro
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button className="btn-quiet -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Voltar
      </button>

      <header>
        <h1 className="section-title text-3xl">{isNew ? 'Novo sonho' : 'Editar sonho'}</h1>
        <p className="text-xs muted mt-1.5">
          Quanto mais detalhe, mais real ele fica. Escreva como se já fosse seu.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* ---------------------------------------------------------- foto */}
        <div className="card overflow-hidden">
          <div className="relative aspect-[16/10]">
            {preview ? (
              <img src={preview} alt="Prévia" className="h-full w-full object-cover" />
            ) : (
              <DreamImage
                dream={{ id: existing?.id ?? 'novo', image_path: imagePath, title: title || 'Novo sonho' }}
                emoji={data.categories.find((c) => c.id === categoryId)?.emoji ?? '✨'}
                className="absolute inset-0"
                eager
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-gold text-xs px-4 py-2.5"
                onClick={() => fileRef.current?.click()}
              >
                <Camera size={14} />
                {imagePath || preview ? 'Trocar foto' : 'Adicionar foto'}
              </button>
              {(preview || imagePath) && (
                <button
                  type="button"
                  className="btn-ghost text-xs px-4 py-2.5"
                  onClick={() => {
                    setPendingFile(null)
                    if (preview) URL.revokeObjectURL(preview)
                    setPreview(null)
                    setImagePath(null)
                  }}
                >
                  Remover
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
          </div>
          <p className="px-4 py-3 text-[11px] muted leading-relaxed">
            Sem foto? Criamos uma capa dourada exclusiva para este sonho.
          </p>
        </div>

        {/* -------------------------------------------------------- textos */}
        <div className="card p-5 sm:p-6 space-y-5">
          <Field label="O sonho">
            <input
              className="w-full !text-lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Casa dos sonhos frente ao mar"
              maxLength={120}
              required
              autoFocus={isNew}
            />
          </Field>

          <Field
            label="Descrição"
            hint="Escreva sentindo. Cores, cheiros, o que muda na sua vida quando acontecer."
          >
            <textarea
              className="w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Como é esse sonho realizado?"
              maxLength={1200}
            />
          </Field>

          <Field
            label="Projeto — como vou realizar"
            hint="O passo a passo concreto. É o que separa desejo de plano."
          >
            <textarea
              className="w-full"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder={'1) Guardar X por mês\n2) Falar com fulano em janeiro\n3) …'}
              maxLength={2000}
            />
          </Field>
        </div>

        {/* --------------------------------------------- categoria e prazo */}
        <div className="card p-5 sm:p-6 space-y-5">
          <Field label="Categoria">
            <select className="w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sem categoria</option>
              {data.categories
                .filter((c) => c.user_id === user?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
            </select>
          </Field>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Adicionei ao quadro em">
              <input
                type="date"
                className="w-full"
                value={dateAdded}
                onChange={(e) => setDateAdded(e.target.value)}
              />
            </Field>
            <Field label="Pretendo realizar em">
              <input
                type="date"
                className="w-full"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Valor do sonho (opcional)"
            hint="Com valor definido, o Banco dos Sonhos mostra sua porcentagem de conquista."
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-200/45 text-sm pointer-events-none">
                R$
              </span>
              <input
                className="w-full !pl-11"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="850000"
              />
            </div>
          </Field>

          <div>
            <p className="field-label mb-2.5">Prioridade</p>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    'rounded-xl border py-3 px-2 transition text-center',
                    priority === p.value
                      ? 'border-gold-500/70 bg-gold-500/12'
                      : 'border-gold-500/15 bg-ink-800/50 hover:border-gold-500/35',
                  )}
                >
                  <span className="block text-xl">{p.emoji}</span>
                  <span className="block mt-1 text-[10px] font-semibold text-gold-100/70 leading-tight">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ visibilidade */}
        {hasCouple && (
          <div className="card p-5 sm:p-6 space-y-5">
            <div>
              <p className="field-label mb-2.5">De quem é este sonho?</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['individual', '🙋‍♀️', 'Meu', 'Só seu — você decide se mostra'],
                    ['couple', '💞', 'Nosso', 'Dos dois, visível e editável pelos dois'],
                  ] as [DreamScope, string, string, string][]
                ).map(([v, emoji, label, hint]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setScope(v)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition',
                      scope === v
                        ? 'border-gold-500/70 bg-gold-500/12'
                        : 'border-gold-500/15 bg-ink-800/50 hover:border-gold-500/35',
                    )}
                  >
                    <span className="block text-xl">{emoji}</span>
                    <span className="block mt-1.5 text-sm font-semibold text-gold-50">{label}</span>
                    <span className="block mt-0.5 text-[11px] muted leading-snug">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {scope === 'individual' && (
              <div className="hairline pt-5">
                <Switch
                  checked={shareWithPartner}
                  onChange={setShareWithPartner}
                  label="Deixar meu par ver este sonho"
                  description="Continua sendo seu — só você pode editar ou apagar. Seu par apenas acompanha e torce."
                />
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------- ações */}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-gold flex-1 sm:flex-none !px-8" disabled={busy || !canEdit}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {isNew ? 'Adicionar ao quadro' : 'Salvar alterações'}
          </button>
          <button type="button" className="btn-quiet" onClick={() => navigate(-1)} disabled={busy}>
            Cancelar
          </button>
          {existing && existing.owner_id === user?.id && (
            <button
              type="button"
              className="btn-danger sm:ml-auto"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              <Trash2 size={16} /> Excluir
            </button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir este sonho?"
        danger
        confirmLabel="Sim, excluir"
        message={
          <>
            <strong className="text-gold-100">{existing?.title}</strong> será removido do quadro junto
            com a foto e os aportes registrados. Essa ação não pode ser desfeita.
          </>
        }
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          if (existing) {
            await removeDream(existing.id)
            navigate('/quadro', { replace: true })
          }
        }}
      />
    </div>
  )
}
