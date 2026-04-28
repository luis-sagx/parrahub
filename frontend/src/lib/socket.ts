import { io } from 'socket.io-client'

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

// Instancia unica de Socket.IO. autoConnect=false permite conectarse solo al ingresar a sala.
export const socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
})
