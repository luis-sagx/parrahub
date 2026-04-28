import instance from './api'
import type { UploadedFile } from '@/types'

interface UploadFileResponse {
  jobId: string | number
  status: 'queued'
}

// Sube archivos como multipart/form-data para que el backend los procese.
export const uploadFile = async (
  file: File,
  roomId: string,
  nickname: string,
  onProgress?: (pct: number) => void,
): Promise<UploadFileResponse> => {
  const formData = new FormData()
  // Estos campos relacionan el archivo con la sala y el usuario que lo envio.
  formData.append('file', file)
  formData.append('roomId', roomId)
  formData.append('nickname', nickname)

  const { data } = await instance.post<UploadFileResponse>(
    '/files/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (event) => {
        // Convierte bytes enviados en porcentaje para la barra de progreso.
        if (!event.total || !onProgress) return

        const pct = Math.round((event.loaded * 100) / event.total)
        onProgress(pct)
      },
    },
  )

  return data
}

// Lista archivos asociados a una sala, util si se quiere mostrar una galeria/historial.
export const getFilesForRoom = async (roomId: string): Promise<UploadedFile[]> => {
  const { data } = await instance.get<UploadedFile[]>(`/files/room/${roomId}`)
  return data
}
