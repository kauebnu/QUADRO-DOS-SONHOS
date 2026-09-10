import { Filter, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DreamCard } from '../components/DreamCard'
import { EmptyState, Segmented } from '../components/ui'
import { cn, daysUntil } from '../lib/format'
import { useApp } from '../store/AppProvider'

type Status = 'ativos' | 'realizados' | 'todos'
type Scope = 'todos' | 'meus' | 'casal' | 'par'
type Sort = 'recentes' | 'prazo' | 'prioridade' | 'valor' | 'alfabetica'

export function BoardPage() {
  const { data, isPartnerDream, categoryOf, user } = useApp()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<Status>('ativos')
  const [scope, setScope] = useState<Scope>('todos')
  const [catId, setCatId] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('recentes')
  const [showFilters, setShowFilters] = useState(false)

  const hasCouple = Boolean(data.couple)

  /** Categorias que realmente aparecem no quadro, com a contagem. */
  const catCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of data.dreams) {
      if (!d.category_id) continue
      m.set(d.category_id, (m.get(d.category_id) ?? 0) + 1)
    }
    return m
  }, [data.dreams])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()

    let list = data.dreams.filter((d) => {
      if (status === 'ativos' && (d.status !== 'active' || d.archived)) return false
      if (status === 'realizados' && d.status !== 'realized') return false

      if (scope === 'meus' && (d.owner_id !== user?.id || d.scope === 'couple')) return false
      if (scope === 'casal' && d.scope !== 'couple') return false
      if (scope === 'par' && !isPartnerDream(d)) return false

      if (catId && d.category_id !== catId) return false

      if (term) {
        const hay = `${d.title} ${d.description} ${d.plan}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'prazo': {
          const da = daysUntil(a.target_date)
          const db = daysUntil(b.target_date)
          if (da === null && db === null) return 0
          if (da === null) return 1
          if (db === null) return -1
          return da - db
        }
        case 'prioridade':
          return a.priority - b.priority || b.created_at.localeCompare(a.created_at)
        case 'valor':
          return Number(b.target_amount ?? 0) - Number(a.target_amount ?? 0)
        case 'alfabetica':
          return a.title.localeCompare(b.title, 'pt-BR')
        default:
          return b.created_at.localeCompare(a.created_at)
      }
    })

    return list
  }, [data.dreams, q, status, scope, catId, sort, user, isPartnerDream])

  const activeFilters = (catId ? 1 : 0) + (scope !== 'todos' ? 1 : 0) + (sort !== 'recentes' ? 1 : 0)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title text-3xl">O Quadro</h1>
          <p className="text-xs muted mt-1.5">
            {filtered.length} {filtered.length === 1 ? 'sonho' : 'sonhos'}
            {status === 'ativos' && ' em construção'}
            {status === 'realizados' && ' realizados'}
          </p>
        </div>
        <Link to="/sonho/novo" className="btn-gold">
          <Plus size={16} /> Novo sonho
        </Link>
      </header>

      {/* ---------------------------------------------------------- busca */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-200/35 pointer-events-none"
          />
          <input
            className="w-full !pl-11"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, descrição ou projeto…"
            aria-label="Buscar sonhos"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gold-200/40 hover:text-gold-100"
              aria-label="Limpar busca"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          className={cn('btn-ghost px-4 relative', showFilters && 'border-gold-500/60 text-gold-50')}
          onClick={() => setShowFilters((s) => !s)}
          aria-expanded={showFilters}
          aria-label="Filtros"
        >
          <Filter size={16} />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-gold-gradient text-[10px] font-bold text-ink-950">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* --------------------------------------------------------- status */}
      <div className="flex flex-wrap gap-3 items-center">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ativos', label: 'Em construção' },
            { value: 'realizados', label: 'Realizados' },
            { value: 'todos', label: 'Todos' },
          ]}
        />
      </div>

      {/* -------------------------------------------------------- filtros */}
      {showFilters && (
        <div className="card p-5 space-y-5 animate-fade-up">
          {hasCouple && (
            <div>
              <p className="field-label mb-2.5">De quem</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['todos', 'Todos'],
                    ['meus', 'Só meus'],
                    ['casal', '💞 Do casal'],
                    ['par', 'Do meu par'],
                  ] as [Scope, string][]
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setScope(v)}
                    className={cn('chip', scope === v && 'chip-active')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="field-label mb-2.5">Categoria</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCatId(null)}
                className={cn('chip', catId === null && 'chip-active')}
              >
                Todas
              </button>
              {data.categories
                .filter((c) => catCounts.get(c.id))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCatId(catId === c.id ? null : c.id)}
                    className={cn('chip', catId === c.id && 'chip-active')}
                  >
                    <span>{c.emoji}</span>
                    {c.name}
                    <span className="text-gold-200/35">{catCounts.get(c.id)}</span>
                  </button>
                ))}
            </div>
            <Link to="/perfil" className="inline-block mt-3 text-xs text-gold-300/70 hover:text-gold-200">
              + Criar categoria personalizada
            </Link>
          </div>

          <div>
            <p className="field-label mb-2.5">Ordenar por</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['recentes', 'Mais recentes'],
                  ['prazo', 'Prazo mais próximo'],
                  ['prioridade', 'Prioridade'],
                  ['valor', 'Maior valor'],
                  ['alfabetica', 'A–Z'],
                ] as [Sort, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setSort(v)}
                  className={cn('chip', sort === v && 'chip-active')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeFilters > 0 && (
            <button
              className="btn-quiet text-xs"
              onClick={() => {
                setCatId(null)
                setScope('todos')
                setSort('recentes')
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- galeria */}
      {filtered.length === 0 ? (
        <EmptyState
          emoji={q || activeFilters ? '🔍' : '🖼️'}
          title={q || activeFilters ? 'Nada encontrado' : 'Quadro em branco'}
          message={
            q || activeFilters
              ? 'Tente outra busca ou limpe os filtros para ver tudo de novo.'
              : 'Cada grande realização começou como uma imagem em um quadro. Comece pela sua.'
          }
          action={
            q || activeFilters ? (
              <button
                className="btn-ghost"
                onClick={() => {
                  setQ('')
                  setCatId(null)
                  setScope('todos')
                  setStatus('todos')
                }}
              >
                Limpar tudo
              </button>
            ) : (
              <Link to="/sonho/novo" className="btn-gold">
                <Plus size={16} /> Adicionar sonho
              </Link>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((d, i) => (
            <DreamCard
              key={d.id}
              dream={d}
              category={categoryOf(d)}
              deposits={data.deposits}
              isPartner={isPartnerDream(d)}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  )
}
