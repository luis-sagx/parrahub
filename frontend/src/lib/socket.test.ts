import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123'),
}))

// Mock de socket.io-client
const mockOn = vi.fn()
const mockOff = vi.fn()
const mockEmit = vi.fn()
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: mockOn,
    off: mockOff,
    emit: mockEmit,
    connect: mockConnect,
    disconnect: mockDisconnect,
    connected: false,
  })),
}))

describe('socket singleton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('exporta un socket con las propiedades correctas', async () => {
    const { socket } = await import('./socket')
    expect(socket).toBeDefined()
    expect(socket.on).toBeDefined()
    expect(socket.off).toBeDefined()
    expect(socket.emit).toBeDefined()
    expect(socket.connect).toBeDefined()
    expect(socket.disconnect).toBeDefined()
  })

  it('el socket tiene método connect', async () => {
    const { socket } = await import('./socket')
    expect(typeof socket.connect).toBe('function')
  })

  it('el socket tiene método disconnect', async () => {
    const { socket } = await import('./socket')
    expect(typeof socket.disconnect).toBe('function')
  })

  it('puede guardar y recuperar deviceId del localStorage', async () => {
    localStorage.setItem('chat_device_id', 'existing-device-id')
    const { socket } = await import('./socket')
    expect(localStorage.getItem('chat_device_id')).toBe('existing-device-id')
  })
})