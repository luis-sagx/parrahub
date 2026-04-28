export type RoomType = 'TEXT' | 'MULTIMEDIA'

// Modelo de sala tal como lo consume el frontend desde el backend.
export interface Room {
  id: string
  name: string
  type: RoomType
  maxFileSize: number
  isActive?: boolean
  createdAt: string
  updatedAt?: string
  adminId?: string
}

// Mensaje del chat: puede ser texto, archivo o evento de sistema.
export interface Message {
  id: string
  roomId: string
  nickname: string
  content?: string
  type: 'text' | 'file' | 'system'
  fileUrl?: string
  filename?: string
  mimeType?: string
  timestamp: string | number | Date
}

// Archivo subido y asociado a una sala.
export interface UploadedFile {
  id?: string
  filename: string
  url: string
  size: number
  mimeType: string
  roomId: string
  createdAt?: string
}

// Credenciales que envia el formulario de login.
export interface LoginCredentials {
  username: string
  password: string
}

// Datos necesarios para crear una sala desde el dashboard.
export interface CreateRoomPayload {
  name: string
  type: RoomType
  pin: string
  maxFileSize?: number
}

// Datos usados al intentar entrar a una sala publica.
export interface JoinRoomPayload {
  roomId: string
  pin: string
  nickname: string
}
