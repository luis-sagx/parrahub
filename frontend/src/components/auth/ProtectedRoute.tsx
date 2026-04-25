import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute() {
  const { isAuthenticated, token } = useAuthStore()
  const hasSession = isAuthenticated || Boolean(token) || Boolean(sessionStorage.getItem('authToken'))

  if (!hasSession) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
