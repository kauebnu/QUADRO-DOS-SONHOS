import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Logo } from './ui'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Rede de segurança: se qualquer tela quebrar, o app mostra uma saída
 * em vez de uma página em branco.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('WE DREAM — erro de renderização:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen grid place-items-center px-6 py-14">
        <div className="card max-w-md w-full p-8 text-center">
          <Logo size="sm" />
          <div className="text-4xl my-5">🌙</div>
          <h1 className="font-display text-2xl text-gold-50">Algo saiu do lugar</h1>
          <p className="mt-3 text-sm muted leading-relaxed">
            Tivemos um imprevisto ao montar esta tela. Seus sonhos continuam salvos — é só
            recarregar.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <button className="btn-gold" onClick={() => window.location.reload()}>
              Recarregar o app
            </button>
            <button
              className="btn-quiet"
              onClick={() => {
                window.location.href = '/'
              }}
            >
              Voltar para o início
            </button>
          </div>
          <details className="mt-6 text-left">
            <summary className="text-[11px] uppercase tracking-widest text-gold-200/35 cursor-pointer">
              Detalhes técnicos
            </summary>
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-ink-950/70 p-3 text-[10px] text-gold-100/50 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
