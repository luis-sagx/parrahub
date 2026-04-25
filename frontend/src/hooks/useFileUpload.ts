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
    if (!currentRoom) {
      setError('No hay una sala activa')
      return
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError('Tipo de archivo no permitido')
      return
    }

    const maxBytes = currentRoom.maxFileSize * 1024 * 1024

    if (file.size > maxBytes) {
      setError(`Archivo demasiado grande (max ${currentRoom.maxFileSize}MB)`)
      return
    }

    try {
      setError(null)
      setProgress(0)
      setIsUploading(true)

      await uploadFileRequest(file, currentRoom.id, nickname, setProgress)
      setProgress(100)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.message
        setError(Array.isArray(message) ? message.join(', ') : message ?? 'No se pudo subir el archivo')
        return
      }

      setError('No se pudo subir el archivo')
    } finally {
      setIsUploading(false)
    }
  }

  const reset = () => {
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
