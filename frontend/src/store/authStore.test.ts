import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from './authStore'

// Limpiar el store antes de cada test
beforeEach(() => {
  useAuthStore.getState().logout()
  vi.clearAllMocks()
})

describe('useAuthStore', () => {
  describe('estado inicial', () => {
    it('tiene token null inicialmente', () => {
      expect(useAuthStore.getState().token).toBeNull()
    })

    it('no está autenticado inicialmente', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
  })

  describe('setToken', () => {
    it('actualiza el token correctamente', () => {
      useAuthStore.getState().setToken('test-token')
      expect(useAuthStore.getState().token).toBe('test-token')
    })

    it('marca como autenticado al establecer token', () => {
      useAuthStore.getState().setToken('test-token')
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })

    it('guarda el token en sessionStorage', () => {
      useAuthStore.getState().setToken('test-token')
      expect(sessionStorage.getItem('authToken')).toBe('test-token')
    })

    it('permite actualizar el token', () => {
      useAuthStore.getState().setToken('token-1')
      useAuthStore.getState().setToken('token-2')
      expect(useAuthStore.getState().token).toBe('token-2')
    })
  })

  describe('logout', () => {
    it('limpia el token', () => {
      useAuthStore.getState().setToken('test-token')
      useAuthStore.getState().logout()
      expect(useAuthStore.getState().token).toBeNull()
    })

    it('marca como no autenticado', () => {
      useAuthStore.getState().setToken('test-token')
      useAuthStore.getState().logout()
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })

    it('elimina el token de sessionStorage', () => {
      useAuthStore.getState().setToken('test-token')
      useAuthStore.getState().logout()
      expect(sessionStorage.getItem('authToken')).toBeNull()
    })

    it('no falla si ya está logout', () => {
      expect(() => useAuthStore.getState().logout()).not.toThrow()
    })
  })

  describe('initFromStorage', () => {
    it('recupera token de sessionStorage', () => {
      sessionStorage.setItem('authToken', 'stored-token')
      useAuthStore.getState().initFromStorage()
      expect(useAuthStore.getState().token).toBe('stored-token')
    })

    it('marca como autenticado si existe token', () => {
      sessionStorage.setItem('authToken', 'stored-token')
      useAuthStore.getState().initFromStorage()
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })

    it('no está autenticado si no hay token', () => {
      sessionStorage.clear()
      useAuthStore.getState().initFromStorage()
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })

    it('token es null si no hay token en storage', () => {
      sessionStorage.clear()
      useAuthStore.getState().initFromStorage()
      expect(useAuthStore.getState().token).toBeNull()
    })
  })
})