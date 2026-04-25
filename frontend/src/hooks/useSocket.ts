import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '@/lib/socket'
import { useChatStore } from '@/store/chatStore'
import type { Message, Room } from '@/types'

interface JoinSuccessPayload {
  roomId: string
  nickname: string
  room?: Room
  history?: Message[]
}

interface UsersUpdatedPayload {
  nickname: string
  users: string[]
}

interface SocketErrorPayload {
  code:
    | 'INVALID_PIN'
    | 'NICKNAME_TAKEN'
    | 'ALREADY_IN_ROOM'
    | 'NOT_IN_ROOM'
    | 'MESSAGE_TOO_LONG'
  message?: string
}

interface NewFilePayload {
  id: string
  roomId: string
  nickname: string
  fileUrl?: string
  url?: string
  filename: string
  mimeType: string
  timestamp?: string | number | Date
  createdAt?: string | number | Date
}

const socketErrorMessages: Record<SocketErrorPayload['code'], string> = {
  INVALID_PIN: 'PIN incorrecto o sala no encontrada',
  NICKNAME_TAKEN: 'Ese nickname ya esta en uso',
  ALREADY_IN_ROOM: 'Ya estas conectado en otra sala',
  NOT_IN_ROOM: 'Debes unirte a una sala primero',
  MESSAGE_TOO_LONG: 'El mensaje no puede tener mas de 1000 caracteres',
}

let listenersRegistered = false

const buildRoomFromJoin = (payload: JoinSuccessPayload): Room =>
  payload.room ?? {
    id: payload.roomId,
    name: `Sala ${payload.roomId.slice(0, 8)}`,
    type: 'TEXT',
    maxFileSize: 10,
    createdAt: new Date().toISOString(),
  }

export function useSocket() {
  const navigate = useNavigate()
  const {
    addMessage,
    clearRoom,
    isConnected,
    setConnected,
    setJoinError,
    setJoining,
    setMessages,
    setRoom,
    setUsers,
  } = useChatStore()

  useEffect(() => {
    if (listenersRegistered) return
    listenersRegistered = true

    const handleConnect = () => {
      setConnected(true)
    }

    const handleDisconnect = () => {
      setConnected(false)
    }

    const handleJoinSuccess = (payload: JoinSuccessPayload) => {
      setRoom(buildRoomFromJoin(payload), payload.nickname)
      setMessages(payload.history ?? [])
      setJoinError(null)
      setJoining(false)
      setConnected(true)
      navigate(`/room/${payload.roomId}`)
    }

    const handleNewMessage = (message: Message) => {
      addMessage(message)
    }

    const handleUserJoined = ({ users }: UsersUpdatedPayload) => {
      setUsers(users)
    }

    const handleUserLeft = ({ users }: UsersUpdatedPayload) => {
      setUsers(users)
    }

    const handleNewFile = (_payload: NewFilePayload) => {
      // The backend also emits this file as `new-message`, so keep this event
      // subscribed for future UI notifications but avoid duplicating messages.
    }

    const handleSocketError = (error: SocketErrorPayload) => {
      setJoinError(socketErrorMessages[error.code] ?? error.message ?? 'Error')
      setJoining(false)
    }

    const handleConnectError = () => {
      setJoinError('Error de conexion con el servidor')
      setJoining(false)
      setConnected(false)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('join-success', handleJoinSuccess)
    socket.on('new-message', handleNewMessage)
    socket.on('user-joined', handleUserJoined)
    socket.on('user-left', handleUserLeft)
    socket.on('new-file', handleNewFile)
    socket.on('error', handleSocketError)
    socket.on('connect_error', handleConnectError)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('join-success', handleJoinSuccess)
      socket.off('new-message', handleNewMessage)
      socket.off('user-joined', handleUserJoined)
      socket.off('user-left', handleUserLeft)
      socket.off('new-file', handleNewFile)
      socket.off('error', handleSocketError)
      socket.off('connect_error', handleConnectError)
      listenersRegistered = false
    }
  }, [
    addMessage,
    navigate,
    setConnected,
    setJoinError,
    setJoining,
    setMessages,
    setRoom,
    setUsers,
  ])

  const connect = useCallback(
    (roomId: string, pin: string, nickname: string) => {
      const joinRoom = () => {
        socket.emit('join-room', { roomId, pin, nickname })
      }

      clearRoom()
      setJoining(true)
      setJoinError(null)

      if (socket.connected) {
        socket.once('disconnect', () => {
          setConnected(false)
          socket.once('connect', joinRoom)
          socket.connect()
        })
        socket.disconnect()
        return
      }

      socket.once('connect', joinRoom)
      socket.connect()
    },
    [clearRoom, setConnected, setJoinError, setJoining],
  )

  const disconnect = useCallback(() => {
    socket.disconnect()
    clearRoom()
  }, [clearRoom])

  const sendMessage = useCallback((content: string) => {
    socket.emit('send-message', { content })
  }, [])

  return {
    socket,
    connected: isConnected,
    connect,
    disconnect,
    sendMessage,
  }
}
