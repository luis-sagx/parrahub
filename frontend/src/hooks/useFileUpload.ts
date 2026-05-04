import { useState } from 'react'
import axios from 'axios'
import { uploadFile as uploadFileRequest } from '@/services/filesApi'
import { useChatStore } from '@/store/chatStore'

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
]

export function useFileUpload() {
  const { currentRoom, nickname } = useChatStore()
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    // No se permite subir nada si el usuario no esta unido a una sala.
    if (!currentRoom) {
      setError('No hay una sala activa')
      return false
    }

    // Primera validacion local para evitar enviar archivos que el backend rechazaria.
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError('Tipo de archivo no permitido')
      return false
    }

    const maxBytes = currentRoom.maxFileSize * 1024 * 1024

    // El limite viene de la configuracion de la sala.
    if (file.size > maxBytes) {
      setError(`Archivo demasiado grande (max ${currentRoom.maxFileSize}MB)`)
      return false
    }

    try {
      setError(null)
      setProgress(0)
      setIsUploading(true)

      // El servicio hace la peticion multipart y reporta avance con onUploadProgress.
      await uploadFileRequest(file, currentRoom.id, nickname, setProgress)
      setProgress(100)
      return true
    } catch (err) {
      if (axios.isAxiosError(err)) {
        // NestJS puede devolver message como string o arreglo de strings.
        const message = err.response?.data?.message
        setError(Array.isArray(message) ? message.join(', ') : message ?? 'No se pudo subir el archivo')
        return false
      }

      setError('No se pudo subir el archivo')
      return false
    } finally {
      setIsUploading(false)
    }
  }

  const reset = () => {
    // Limpia estado visual para reutilizar el control de subida.
    setProgress(0)
    setError(null)
    setIsUploading(false)
  }

  return {
    progress,
    isUploading,
    error,
    upload,
    reset,
  }
}
