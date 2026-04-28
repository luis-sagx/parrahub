import { create } from 'zustand'

const AUTH_TOKEN_KEY = 'authToken'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  setToken: (token: string) => void
  logout: () => void
  initFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isAuthenticated: false,

  setToken: (token) => {
    // sessionStorage mantiene la sesion solo mientras vive la pestana del navegador.
    sessionStorage.setItem(AUTH_TOKEN_KEY, token)
    set({ token, isAuthenticated: true })
  },

  logout: () => {
    // Borra el token local para que ProtectedRoute bloquee el dashboard.
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    set({ token: null, isAuthenticated: false })
  },

  initFromStorage: () => {
    // Rehidrata el estado si el usuario recarga la pagina durante la misma sesion.
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY)
    set({ token, isAuthenticated: Boolean(token) })
  },
}))
