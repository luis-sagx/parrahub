import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'

// Mock completo de axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: {
          use: vi.fn((cb) => {
            // Simular el callback de request
            cb({
              headers: {},
            })
            return vi.fn()
          }),
        },
        response: {
          use: vi.fn((successCb, errorCb) => {
            // Devolver funciones para poder llamarlas
            return [successCb, errorCb]
          }),
        },
      },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    })),
    isAxiosError: vi.fn((err) => err?.isAxiosError === true),
  },
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ token: null })),
  },
}))

describe('API', () => {
  let originalLocation: typeof window.location

  beforeEach(() => {
    // Guardar location original
    originalLocation = window.location
    // Mock de window.location
    delete (window as any).location
    window.location = { pathname: '/' } as any

    // Limpiar storage
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    // Restaurar location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })

  it('exporta una instancia de axios', async () => {
    const api = (await import('./api')).default
    expect(api).toBeDefined()
    expect(typeof api.get).toBe('function')
    expect(typeof api.post).toBe('function')
  })

  it('la instancia tiene método get', async () => {
    const api = (await import('./api')).default
    expect(typeof api.get).toBe('function')
  })

  it('la instancia tiene método post', async () => {
    const api = (await import('./api')).default
    expect(typeof api.post).toBe('function')
  })

  it('la instancia tiene método put', async () => {
    const api = (await import('./api')).default
    expect(typeof api.put).toBe('function')
  })

  it('la instancia tiene método delete', async () => {
    const api = (await import('./api')).default
    expect(typeof api.delete).toBe('function')
  })
})

describe('axios.isAxiosError', () => {
  it('detecta errores de axios', () => {
    const error = { isAxiosError: true }
    expect(axios.isAxiosError(error)).toBe(true)
  })

  it('retorna false para errores no axios', () => {
    const error = new Error('Regular error')
    expect(axios.isAxiosError(error)).toBe(false)
  })
})