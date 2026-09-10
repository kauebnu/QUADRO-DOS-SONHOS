import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { FullScreenLoader, Toasts } from './components/ui'
import { ArchivePage } from './pages/ArchivePage'
import { BankPage } from './pages/BankPage'
import { BoardPage } from './pages/BoardPage'
import { CouplePage } from './pages/CouplePage'
import { DreamDetailPage } from './pages/DreamDetailPage'
import { DreamFormPage } from './pages/DreamFormPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PresentationPage } from './pages/PresentationPage'
import { ProfilePage } from './pages/ProfilePage'
import { TipsPage } from './pages/TipsPage'
import { useApp } from './store/AppProvider'

export default function App() {
  const { ready, user, toasts, dismissToast } = useApp()

  return (
    <>
      {!ready ? (
        <FullScreenLoader />
      ) : !user ? (
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      ) : (
        <Routes>
          {/* apresentação ocupa a tela inteira, fora do shell */}
          <Route path="/apresentacao" element={<PresentationPage />} />
          <Route
            path="*"
            element={
              <AppShell>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/quadro" element={<BoardPage />} />
                  <Route path="/banco" element={<BankPage />} />
                  <Route path="/realizados" element={<ArchivePage />} />
                  <Route path="/dicas" element={<TipsPage />} />
                  <Route path="/casal" element={<CouplePage />} />
                  <Route path="/perfil" element={<ProfilePage />} />
                  <Route path="/sonho/novo" element={<DreamFormPage />} />
                  <Route path="/sonho/:id" element={<DreamDetailPage />} />
                  <Route path="/sonho/:id/editar" element={<DreamFormPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            }
          />
        </Routes>
      )}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
