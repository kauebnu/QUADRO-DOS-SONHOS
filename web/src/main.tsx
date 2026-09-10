import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import { AppProvider } from './store/AppProvider'

// No build de prévia o app roda como um arquivo único: rotas por hash e
// sem service worker. Em produção, o contrário dos dois.
const ehPrevia = typeof __WE_DREAM_PREVIEW__ !== 'undefined' && __WE_DREAM_PREVIEW__
const Router = ehPrevia ? HashRouter : BrowserRouter

if (!ehPrevia) {
  // Atualiza o app em segundo plano quando uma nova versão é publicada.
  registerSW({ immediate: true })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Router>
        <AppProvider>
          <App />
        </AppProvider>
      </Router>
    </ErrorBoundary>
  </React.StrictMode>,
)
