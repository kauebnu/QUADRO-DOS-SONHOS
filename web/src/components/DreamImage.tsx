import { useEffect, useState } from 'react'
import { dreamArt } from '../lib/dreamArt'
import { cn } from '../lib/format'
import type { Dream } from '../lib/types'
import { useApp } from '../store/AppProvider'

/**
 * Foto do sonho. Resolve a URL assinada do storage e, quando não há foto,
 * mostra uma capa dourada gerada a partir do id — nunca um buraco cinza.
 */
export function DreamImage({
  dream,
  emoji = '✨',
  className = '',
  imgClassName = '',
  kenBurns = false,
  eager = false,
}: {
  dream: Pick<Dream, 'id' | 'image_path' | 'title'>
  emoji?: string
  className?: string
  imgClassName?: string
  kenBurns?: boolean
  eager?: boolean
}) {
  const { repo } = useApp()
  const fallback = dreamArt(dream.id, emoji)
  const [src, setSrc] = useState<string>(fallback)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    setLoaded(false)

    if (!dream.image_path) {
      setSrc(fallback)
      setLoaded(true)
      return
    }

    // data: URL (modo demonstração) resolve na hora
    if (dream.image_path.startsWith('data:')) {
      setSrc(dream.image_path)
      return
    }

    repo
      .imageUrl(dream.image_path)
      .then((url) => {
        if (alive) setSrc(url ?? fallback)
      })
      .catch(() => {
        if (alive) setSrc(fallback)
      })

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dream.image_path, dream.id, repo])

  return (
    <div className={cn('relative overflow-hidden bg-ink-850', className)}>
      <img
        src={src}
        alt={dream.title}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setSrc(fallback)
          setLoaded(true)
        }}
        className={cn(
          'h-full w-full object-cover transition-all duration-700',
          loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
          kenBurns && 'animate-ken-burns',
          imgClassName,
        )}
      />
      {!loaded && <div className="absolute inset-0 bg-ink-800/60 shine" />}
    </div>
  )
}
