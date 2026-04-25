export type RoomType = 'TEXT' | 'MULTIMEDIA'

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

export interface UploadedFile {
  id?: string
  filename: string
  url: string
  size: number
  mimeType: string
  roomId: string
  createdAt?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface CreateRoomPayload {
  name: string
  type: RoomType
  pin: string
  maxFileSize?: number
}

export interface JoinRoomPayload {
  roomId: string
  pin: string
  nickname: string
}