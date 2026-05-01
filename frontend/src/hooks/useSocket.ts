import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearChatSession,
  getChatSession,
  saveChatSession,
  type StoredChatSession,
} from '@/lib/chatSession'
import { socket } from '@/lib/socket'
import { useChatStore } from '@/store/chatStore'
import type { Message, Room } from '@/types'

interface JoinSuccessPayload {
  roomId: string
  nickname: string
  room?: Room
  history?: Message[]
  users?: string[]
  reconnected?: boolean
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
    | 'MISSING_DEVICE_ID'
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
  MISSING_DEVICE_ID: 'No se pudo identificar este dispositivo',
}

// Evita registrar los mismos listeners muchas veces cuando varios componentes usan el hook.
let listenersRegistered = false
let pendingSession: StoredChatSession | null = null

const buildRoomFromJoin = (payload: JoinSuccessPayload): Room =>
  // Si el backend no manda la sala completa, armamos una minima para pintar la UI.
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
      // Marca conexion tecnica del socket, antes o despues de unirse a sala.
      setConnected(true)
    }

    const handleDisconnect = () => {
      // La desconexion no borra todo aqui; clearRoom se hace al salir explicitamente.
      setConnected(false)
    }

    const handleJoinSuccess = (payload: JoinSuccessPayload) => {
      // Al unirse, guardamos sala, usuario e historial, y entramos al chat.
      // reconnected: true indica que ya estábamos en esta sala (refresco).
      setRoom(buildRoomFromJoin(payload), payload.nickname)
      setMessages(payload.history ?? [])
      setUsers(payload.users ?? [])
      setJoinError(null)
      setJoining(false)
      setConnected(true)

      if (pendingSession?.roomId === payload.roomId) {
        saveChatSession({
          roomId: payload.roomId,
          nickname: payload.nickname,
          pin: pendingSession.pin,
        })
        pendingSession = null
      }

      // Si es una reconexión silenciosa, no navegamos (ya estamos en /room/:roomId)
      if (!payload.reconnected) {
        navigate(`/room/${payload.roomId}`)
      }
    }

    const handleNewMessage = (message: Message) => {
      // Todos los mensajes, incluidos archivos procesados, llegan por este evento.
      addMessage(message)
    }

    const handleUserJoined = ({ users }: UsersUpdatedPayload) => {
      // El backend manda la lista completa para mantener presencia consistente.
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
      // Traduce codigos tecnicos del backend a mensajes utiles para el formulario.
      setJoinError(socketErrorMessages[error.code] ?? error.message ?? 'Error')
      setJoining(false)
      pendingSession = null
    }

    const handleConnectError = () => {
      // Error de transporte: normalmente backend apagado, URL mal configurada o CORS.
      setJoinError('Error de conexion con el servidor')
      setJoining(false)
      setConnected(false)
    }

    const handleKicked = (data: { reason: string; message: string }) => {
      // El usuario fue desconectado por inactividad o por otra razón.
      clearChatSession()
      clearRoom()

      // Muestra notificación y navega al formulario de unirse
      const roomId = window.location.pathname.split('/').pop()
      if (roomId) {
        navigate(`/join/${roomId}`, { replace: true })
      }

      setJoinError(`Sesión cerrada: ${data.message}`)
      socket.disconnect()
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
    socket.on('kicked', handleKicked)

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
      socket.off('kicked', handleKicked)
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
      pendingSession = { roomId, pin, nickname }

      const joinRoom = () => {
        // join-room valida PIN/nickname en el backend y responde con join-success o error.
        socket.emit('join-room', { roomId, pin, nickname })
      }

      // Limpia cualquier sala previa antes de intentar entrar en otra.
      clearRoom()
      setJoining(true)
      setJoinError(null)

      if (socket.connected) {
        // Cambio de sala intencional: limpiar sesion actual en backend antes de reconectar.
        socket.emit('leave-room', {}, () => {
          socket.once('disconnect', () => {
            setConnected(false)
            socket.once('connect', joinRoom)
            socket.connect()
          })
          socket.disconnect()
        })

        setTimeout(() => {
          if (!socket.connected) return
          socket.once('disconnect', () => {
            setConnected(false)
            socket.once('connect', joinRoom)
            socket.connect()
          })
          socket.disconnect()
        }, 300)
        return
      }

      socket.once('connect', joinRoom)
      socket.connect()
    },
    [clearRoom, setConnected, setJoinError, setJoining],
  )

  const reconnectFromSession = useCallback(
    (roomId: string) => {
      const session = getChatSession()

      if (!session || session.roomId !== roomId) {
        return false
      }

      connect(session.roomId, session.pin || '', session.nickname)
      return true
    },
    [connect],
  )

  const disconnect = useCallback(
    (clearStoredSession = true) => {
      // Salida manual: desconecta el transporte y limpia el estado del chat.
      if (clearStoredSession) {
        clearChatSession()
        if (socket.connected) {
          socket.emit('leave-room', {})
          setTimeout(() => {
            pendingSession = null
            socket.disconnect()
            clearRoom()
          }, 150)
          return
        }
      }

      pendingSession = null
      socket.disconnect()
      clearRoom()
    },
    [clearRoom],
  )

  const sendMessage = useCallback((content: string) => {
    // Funcion auxiliar para componentes que prefieran usar el hook en vez del socket directo.
    socket.emit('send-message', { content })
  }, [])

  return {
    socket,
    connected: isConnected,
    connect,
    reconnectFromSession,
    disconnect,
    sendMessage,
  }
}
