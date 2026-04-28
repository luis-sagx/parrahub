import  instance from './api'
import type { CreateRoomPayload, LoginCredentials, Message, Room } from '@/types'

interface LoginResponse {
  access_token: string
  expiresIn?: string | number
}

// Autentica al administrador y devuelve el JWT que usara Axios.
export const login = async (
  credentials: LoginCredentials,
): Promise<LoginResponse> => {
  const { data } = await instance.post<LoginResponse>('/auth/login', credentials)
  return data
}

// Obtiene todas las salas visibles para el administrador.
export const getRooms = async (): Promise<Room[]> => {
  const { data } = await instance.get<Room[]>('/rooms')
  return data
}

// Obtiene las salas activas que cualquier usuario puede ver sin login.
export const getPublicRooms = async (): Promise<Room[]> => {
  const { data } = await instance.get<Room[]>('/rooms/public')
  return data
}

// Consulta una sala puntual por ID.
export const getRoom = async (id: string): Promise<Room> => {
  const { data } = await instance.get<Room>(`/rooms/${id}`)
  return data
}

// Crea una sala de texto o multimedia.
export const createRoom = async (payload: CreateRoomPayload): Promise<Room> => {
  const { data } = await instance.post<Room>('/rooms', payload)
  return data
}

// Elimina una sala desde el dashboard.
export const deleteRoom = async (id: string): Promise<void> => {
  await instance.delete(`/rooms/${id}`)
}

// Recupera el historial de mensajes de una sala.
export const getRoomMessages = async (
  roomId: string,
): Promise<Message[]> => {
  const { data } = await instance.get<Message[]>(`/rooms/${roomId}/messages`)
  return data
}
