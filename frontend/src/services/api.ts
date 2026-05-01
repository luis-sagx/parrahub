import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const instance = axios.create({
  // URL base configurable por Vite; en desarrollo cae al backend local.
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 5000,
})

instance.interceptors.request.use((config) => {
  // Inyecta el Bearer token en cada peticion privada si existe una sesion admin.
  const token =
    useAuthStore.getState().token ?? sessionStorage.getItem('authToken')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Inyecta el deviceId en el header para validar en el backend.
  const deviceId = localStorage.getItem('chat_device_id')
  if (deviceId) {
    config.headers['x-device-id'] = deviceId
  }

  return config
})

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el backend rechaza el token, cerramos sesion y enviamos al login.
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()

      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

export default instance
