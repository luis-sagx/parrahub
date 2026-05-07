import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de la instancia de axios
const mockPost = vi.fn()
const mockGet = vi.fn()

vi.mock('./api', () => ({
  default: {
    post: mockPost,
    get: mockGet,
  },
}))

describe('filesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('uploadFile', () => {
    it('exporta la función uploadFile', async () => {
      const { uploadFile } = await import('./filesApi')
      expect(typeof uploadFile).toBe('function')
    })

    it('hace POST a /files/upload con FormData', async () => {
      const mockFile = new File(['content'], 'test.png', { type: 'image/png' })
      mockPost.mockResolvedValue({ data: { jobId: 1, status: 'queued' } })

      const { uploadFile } = await import('./filesApi')
      const result = await uploadFile(mockFile, 'room-1', 'user1')

      expect(mockPost).toHaveBeenCalledWith(
        '/files/upload',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
          }),
        }),
      )
      expect(result.jobId).toBe(1)
      expect(result.status).toBe('queued')
    })

    it('llama a onProgress con el porcentaje', async () => {
      const mockFile = new File(['content'], 'test.png', { type: 'image/png' })
      const onProgress = vi.fn()

      // Configurar el mock para que llame al callback de progreso
      mockPost.mockImplementation((_url, _data, config) => {
        if (config?.onUploadProgress) {
          config.onUploadProgress({ loaded: 50, total: 100 })
        }
        return Promise.resolve({ data: { jobId: 1, status: 'queued' } })
      })

      const { uploadFile } = await import('./filesApi')
      await uploadFile(mockFile, 'room-1', 'user1', onProgress)

      expect(onProgress).toHaveBeenCalledWith(50)
    })
  })

  describe('getFilesForRoom', () => {
    it('exporta la función getFilesForRoom', async () => {
      const { getFilesForRoom } = await import('./filesApi')
      expect(typeof getFilesForRoom).toBe('function')
    })

    it('hace GET a /files/room/{roomId}', async () => {
      mockGet.mockResolvedValue({ data: [] })
      const { getFilesForRoom } = await import('./filesApi')
      await getFilesForRoom('room-1')
      expect(mockGet).toHaveBeenCalledWith('/files/room/room-1')
    })
  })
})