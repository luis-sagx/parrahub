import { useState } from 'react'
import axios from 'axios'
import { uploadFile as uploadFileRequest } from '@/services/filesApi'
import { validateFileForUpload } from '@/lib/fileUpload'
import { useChatStore } from '@/store/chatStore'

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

    const validationError = validateFileForUpload(file, currentRoom.maxFileSize)
    if (validationError) {
      // Primera validacion local para evitar enviar archivos que el backend rechazaria.
      setError(validationError)
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
