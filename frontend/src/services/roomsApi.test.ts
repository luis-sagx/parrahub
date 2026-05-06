import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de la instancia de axios
const mockPost = vi.fn()
const mockGet = vi.fn()
const mockDelete = vi.fn()

vi.mock('./api', () => ({
  default: {
    post: mockPost,
    get: mockGet,
    delete: mockDelete,
  },
}))

describe('roomsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('exporta la función login', async () => {
      const { login } = await import('./roomsApi')
      expect(typeof login).toBe('function')
    })

    it('hace POST a /auth/login con credenciales', async () => {
      mockPost.mockResolvedValue({ data: { access_token: 'token123' } })
      const { login } = await import('./roomsApi')
      const result = await login({ username: 'admin', password: 'password' })
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        username: 'admin',
        password: 'password',
      })
      expect(result.access_token).toBe('token123')
    })
  })

  describe('getRooms', () => {
    it('exporta la función getRooms', async () => {
      const { getRooms } = await import('./roomsApi')
      expect(typeof getRooms).toBe('function')
    })

    it('hace GET a /rooms', async () => {
      mockGet.mockResolvedValue({ data: [] })
      const { getRooms } = await import('./roomsApi')
      await getRooms()
      expect(mockGet).toHaveBeenCalledWith('/rooms')
    })
  })

  describe('getPublicRooms', () => {
    it('exporta la función getPublicRooms', async () => {
      const { getPublicRooms } = await import('./roomsApi')
      expect(typeof getPublicRooms).toBe('function')
    })

    it('hace GET a /rooms/public', async () => {
      mockGet.mockResolvedValue({ data: [] })
      const { getPublicRooms } = await import('./roomsApi')
      await getPublicRooms()
      expect(mockGet).toHaveBeenCalledWith('/rooms/public')
    })
  })

  describe('getRoom', () => {
    it('exporta la función getRoom', async () => {
      const { getRoom } = await import('./roomsApi')
      expect(typeof getRoom).toBe('function')
    })

    it('hace GET a /rooms/{id}', async () => {
      mockGet.mockResolvedValue({ data: { id: 'room-1' } })
      const { getRoom } = await import('./roomsApi')
      await getRoom('room-1')
      expect(mockGet).toHaveBeenCalledWith('/rooms/room-1')
    })
  })

  describe('createRoom', () => {
    it('exporta la función createRoom', async () => {
      const { createRoom } = await import('./roomsApi')
      expect(typeof createRoom).toBe('function')
    })

    it('hace POST a /rooms con payload', async () => {
      mockPost.mockResolvedValue({ data: { id: 'room-1' } })
      const { createRoom } = await import('./roomsApi')
      await createRoom({ name: 'Test', type: 'TEXT', pin: '1234' })
      expect(mockPost).toHaveBeenCalledWith('/rooms', {
        name: 'Test',
        type: 'TEXT',
        pin: '1234',
      })
    })
  })

  describe('deleteRoom', () => {
    it('exporta la función deleteRoom', async () => {
      const { deleteRoom } = await import('./roomsApi')
      expect(typeof deleteRoom).toBe('function')
    })

    it('hace DELETE a /rooms/{id}', async () => {
      mockDelete.mockResolvedValue({})
      const { deleteRoom } = await import('./roomsApi')
      await deleteRoom('room-1')
      expect(mockDelete).toHaveBeenCalledWith('/rooms/room-1')
    })
  })

  describe('getRoomMessages', () => {
    it('exporta la función getRoomMessages', async () => {
      const { getRoomMessages } = await import('./roomsApi')
      expect(typeof getRoomMessages).toBe('function')
    })

    it('hace GET a /rooms/{id}/messages', async () => {
      mockGet.mockResolvedValue({ data: [] })
      const { getRoomMessages } = await import('./roomsApi')
      await getRoomMessages('room-1')
      expect(mockGet).toHaveBeenCalledWith('/rooms/room-1/messages')
    })
  })
})