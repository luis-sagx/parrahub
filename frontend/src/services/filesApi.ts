import instance from './api'
import type { UploadedFile } from '@/types'

interface UploadFileResponse {
  jobId: string | number
  status: 'queued'
}

export const uploadFile = async (
  file: File,
  roomId: string,
  nickname: string,
  onProgress?: (pct: number) => void,
): Promise<UploadFileResponse> => {
  const formData = new FormData()
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
        if (!event.total || !onProgress) return

        const pct = Math.round((event.loaded * 100) / event.total)
        onProgress(pct)
      },
    },
  )

  return data
}

export const getFilesForRoom = async (roomId: string): Promise<UploadedFile[]> => {
  const { data } = await instance.get<UploadedFile[]>(`/files/room/${roomId}`)
  return data
}
