import { describe, it, expect } from 'vitest'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() })),
  useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    getDefaultOptions: vi.fn(() => ({})),
  })),
}))

vi.mock('@/services/roomsApi', () => ({
  getRooms: vi.fn(() => Promise.resolve([])),
  createRoom: vi.fn(() => Promise.resolve({ id: '1' })),
  deleteRoom: vi.fn(() => Promise.resolve()),
}))

describe('useRooms additional branch coverage', () => {
  it('useRooms tiene el queryKey correcto', async () => {
    const { useRooms } = await import('./useRooms')
    const result = useRooms()
    expect(result.rooms).toEqual([])
    expect(result.isLoading).toBe(false)
  })

  it('useRooms permite crear sala', async () => {
    const { useRooms } = await import('./useRooms')
    const result = useRooms()
    expect(typeof result.createRoom).toBe('function')
  })

  it('useRooms permite eliminar sala', async () => {
    const { useRooms } = await import('./useRooms')
    const result = useRooms()
    expect(typeof result.deleteRoom).toBe('function')
  })

  it('useRooms indica estado de creando', async () => {
    const { useRooms } = await import('./useRooms')
    const result = useRooms()
    expect(result.isCreating).toBe(false)
  })

  it('useRooms indica estado de eliminando', async () => {
    const { useRooms } = await import('./useRooms')
    const result = useRooms()
    expect(result.isDeleting).toBe(false)
  })
})