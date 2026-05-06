import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock de axios para testear la configuración de la API
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: {
          use: vi.fn((cb) => cb),
        },
        response: {
          use: vi.fn((successCb, errorCb) => [successCb, errorCb]),
        },
      },
    })),
    isAxiosError: vi.fn((err) => err?.isAxiosError === true),
  },
}))

describe('API Instance', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('puede importar la instancia de axios', async () => {
    const instance = (await import('./api')).default
    expect(instance).toBeDefined()
    expect(instance.interceptors).toBeDefined()
  })
})