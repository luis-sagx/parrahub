import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AdminDashboard from '@/pages/AdminDashboard'
import UserDashboard from '@/pages/UserDashboard'
import AdminLogin from '@/pages/AdminLogin'
import ChatRoom from '@/pages/ChatRoom'
import JoinRoom from '@/pages/JoinRoom'

export default function App() {
  return (
    <Routes>
      {/* La raiz muestra el dashboard publico de usuario. */}
      <Route path="/" element={<UserDashboard />} />
      <Route path="/UserDashboard" element={<UserDashboard />} />
      <Route path="/user-dashboard" element={<UserDashboard />} />
      <Route path="/login" element={<AdminLogin />} />
      {/* Todas las rutas dentro de ProtectedRoute necesitan token de administrador. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<AdminDashboard />} />
      </Route>
      {/* Rutas publicas usadas por los invitados para entrar y conversar en una sala. */}
      <Route path="/join/:roomId" element={<JoinRoom />} />
      <Route path="/room/:roomId" element={<ChatRoom />} />
    </Routes>
  )
}
