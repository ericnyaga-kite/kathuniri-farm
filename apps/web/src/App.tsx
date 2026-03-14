import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './pages/LoginPage'
import { ManagerShell } from './pages/manager/ManagerShell'
import { OwnerShell } from './pages/owner/OwnerShell'

export default function App() {
  const { user } = useAuthStore()

  if (!user) return <LoginPage />

  return (
    <Routes>
      {user.role === 'manager' ? (
        <>
          <Route path="/manager/*" element={<ManagerShell />} />
          <Route path="*" element={<Navigate to="/manager" replace />} />
        </>
      ) : (
        <>
          <Route path="/owner/*" element={<OwnerShell />} />
          <Route path="*" element={<Navigate to="/owner" replace />} />
        </>
      )}
    </Routes>
  )
}
