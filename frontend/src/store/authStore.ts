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
    sessionStorage.setItem(AUTH_TOKEN_KEY, token)
    set({ token, isAuthenticated: true })
  },

  logout: () => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    set({ token: null, isAuthenticated: false })
  },

  initFromStorage: () => {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY)
    set({ token, isAuthenticated: Boolean(token) })
  },
}))
