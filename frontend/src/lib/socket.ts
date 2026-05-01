import { io } from 'socket.io-client'

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

function getDeviceId(): string {
  let id = localStorage.getItem('chat_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('chat_device_id', id)
  }
  return id
}

// Instancia unica de Socket.IO. autoConnect=false permite conectarse solo al ingresar a sala.
// El deviceId se envía en el handshake para trackear sesiones por dispositivo.
export const socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
  auth: {
    deviceId: getDeviceId(),
  },
})
