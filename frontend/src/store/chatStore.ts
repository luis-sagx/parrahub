import { create } from 'zustand'
import type { Message, Room } from '@/types'

const MAX_MESSAGES_IN_MEMORY = 200

interface ChatState {
  currentRoom: Room | null
  nickname: string
  messages: Message[]
  connectedUsers: string[]
  isConnected: boolean
  isJoining: boolean
  joinError: string | null
  setRoom: (room: Room, nickname: string) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  setUsers: (users: string[]) => void
  addUser: (nickname: string) => void
  removeUser: (nickname: string) => void
  setConnected: (isConnected: boolean) => void
  setJoining: (isJoining: boolean) => void
  setJoinError: (joinError: string | null) => void
  clearRoom: () => void
}

const keepLastMessages = (messages: Message[]) =>
  // Mantiene el chat liviano evitando crecer indefinidamente en memoria.
  messages.slice(-MAX_MESSAGES_IN_MEMORY)

export const useChatStore = create<ChatState>((set) => ({
  currentRoom: null,
  nickname: '',
  messages: [],
  connectedUsers: [],
  isConnected: false,
  isJoining: false,
  joinError: null,

  setRoom: (room, nickname) => {
    // Guarda la sala activa y el nickname con el que entro el usuario.
    set({ currentRoom: room, nickname, joinError: null })
  },

  setMessages: (messages) => {
    set({ messages: keepLastMessages(messages) })
  },

  addMessage: (message) => {
    // Agrega mensajes nuevos sin superar el limite local.
    set((state) => ({
      messages: keepLastMessages([...state.messages, message]),
    }))
  },

  setUsers: (users) => {
    set({ connectedUsers: users })
  },

  addUser: (nickname) => {
    set((state) => {
      // Evita duplicados si el backend repite un evento de presencia.
      if (state.connectedUsers.includes(nickname)) return state

      return {
        connectedUsers: [...state.connectedUsers, nickname],
      }
    })
  },

  removeUser: (nickname) => {
    set((state) => ({
      connectedUsers: state.connectedUsers.filter((user) => user !== nickname),
    }))
  },

  setConnected: (isConnected) => {
    set({ isConnected })
  },

  setJoining: (isJoining) => {
    set({ isJoining })
  },

  setJoinError: (joinError) => {
    set({ joinError })
  },

  clearRoom: () => {
    // Estado inicial usado al salir o antes de intentar entrar a otra sala.
    set({
      currentRoom: null,
      nickname: '',
      messages: [],
      connectedUsers: [],
      isConnected: false,
      isJoining: false,
      joinError: null,
    })
  },
}))
