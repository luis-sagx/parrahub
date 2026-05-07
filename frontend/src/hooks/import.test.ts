import { describe, it, expect, vi } from 'vitest'

// Mock de dependencies de los hooks
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: [], isLoading: false })),
  useMutation: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    getDefaultOptions: vi.fn(() => ({})),
  })),
}))

vi.mock('@/services/roomsApi', () => ({
  getRooms: vi.fn(),
  createRoom: vi.fn(),
  deleteRoom: vi.fn(),
  getPublicRooms: vi.fn(),
  getRoom: vi.fn(),
  getRoomMessages: vi.fn(),
}))

vi.mock('@/services/filesApi', () => ({
  uploadFile: vi.fn(),
  getFilesForRoom: vi.fn(),
}))

vi.mock('@/store/chatStore', () => ({
  useChatStore: vi.fn(() => ({
    currentRoom: null,
    nickname: '',
    addMessage: vi.fn(),
    setRoom: vi.fn(),
    setMessages: vi.fn(),
    setUsers: vi.fn(),
    addUser: vi.fn(),
    removeUser: vi.fn(),
    setConnected: vi.fn(),
    setJoining: vi.fn(),
    setJoinError: vi.fn(),
    clearRoom: vi.fn(),
  })),
}))

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  })),
}))

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}))

describe('Hooks imports', () => {
  it('puede importar useRooms', async () => {
    const module = await import('./useRooms')
    expect(module).toBeDefined()
    expect(typeof module.useRooms).toBe('function')
  })

  it('puede importar usePublicRooms', async () => {
    const module = await import('./usePublicRooms')
    expect(module).toBeDefined()
    expect(typeof module.usePublicRooms).toBe('function')
  })

  it('puede importar useFileUpload', async () => {
    const module = await import('./useFileUpload')
    expect(module).toBeDefined()
    expect(typeof module.useFileUpload).toBe('function')
  })
})

describe('useRooms hook', () => {
  it('useRooms retorna estructura esperada', async () => {
    const { useRooms } = await import('./useRooms')
    // La función useRooms se puede ejecutar y debe retornar funciones
    const result = useRooms()
    expect(result).toHaveProperty('rooms')
    expect(result).toHaveProperty('isLoading')
    expect(result).toHaveProperty('isError')
    expect(result).toHaveProperty('refetchRooms')
    expect(result).toHaveProperty('createRoom')
    expect(result).toHaveProperty('isCreating')
    expect(result).toHaveProperty('deleteRoom')
    expect(result).toHaveProperty('isDeleting')
  })
})

describe('usePublicRooms hook', () => {
  it('usePublicRooms retorna estructura esperada', async () => {
    const { usePublicRooms } = await import('./usePublicRooms')
    const result = usePublicRooms()
    expect(result).toHaveProperty('rooms')
    expect(result).toHaveProperty('isLoading')
    expect(result).toHaveProperty('isError')
  })
})

describe('useFileUpload hook', () => {
  it('el módulo exporta useFileUpload', async () => {
    const { useFileUpload } = await import('./useFileUpload')
    expect(useFileUpload).toBeDefined()
    expect(typeof useFileUpload).toBe('function')
  })
})