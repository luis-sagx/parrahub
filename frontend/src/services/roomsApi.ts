import  instance from './api'
import type { CreateRoomPayload, LoginCredentials, Message, Room } from '@/types'

interface LoginResponse {
  access_token: string
  expiresIn?: string | number
}

export const login = async (
  credentials: LoginCredentials,
): Promise<LoginResponse> => {
  const { data } = await instance.post<LoginResponse>('/auth/login', credentials)
  return data
}

export const getRooms = async (): Promise<Room[]> => {
  const { data } = await instance.get<Room[]>('/rooms')
  return data
}

export const getRoom = async (id: string): Promise<Room> => {
  const { data } = await instance.get<Room>(`/rooms/${id}`)
  return data
}

export const createRoom = async (payload: CreateRoomPayload): Promise<Room> => {
  const { data } = await instance.post<Room>('/rooms', payload)
  return data
}

export const deleteRoom = async (id: string): Promise<void> => {
  await instance.delete(`/rooms/${id}`)
}

export const getRoomMessages = async (
  roomId: string,
): Promise<Message[]> => {
  const { data } = await instance.get<Message[]>(`/rooms/${roomId}/messages`)
  return data
}