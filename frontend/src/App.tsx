import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AdminDashboard from '@/pages/AdminDashboard'
import AdminLogin from '@/pages/AdminLogin'
import ChatRoom from '@/pages/ChatRoom'
import JoinRoom from '@/pages/JoinRoom'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<AdminDashboard />} />
      </Route>
      <Route path="/join/:roomId" element={<JoinRoom />} />
      <Route path="/room/:roomId" element={<ChatRoom />} />
    </Routes>
  )
}
