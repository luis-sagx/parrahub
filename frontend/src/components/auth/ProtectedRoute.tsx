import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute() {
  const { isAuthenticated, token } = useAuthStore()
  // Tambien revisa sessionStorage para sobrevivir a recargas dentro de la misma pestana.
  const hasSession = isAuthenticated || Boolean(token) || Boolean(sessionStorage.getItem('authToken'))

  if (!hasSession) {
    // Sin sesion valida, cualquier ruta hija vuelve al login.
    return <Navigate to="/login" replace />
  }

  // Outlet renderiza la pagina protegida que coincidio en App.tsx.
  return <Outlet />
}
