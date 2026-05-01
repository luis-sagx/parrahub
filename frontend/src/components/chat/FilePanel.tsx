import { Download, File, Image as ImageIcon, FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getFilesForRoom } from '@/services/filesApi'
import { useChatStore } from '@/store/chatStore'
import { socket } from '@/lib/socket'
import type { UploadedFile } from '@/types'

const formatDate = (date: string | Date | undefined) => {
  if (!date) return 'Fecha desconocida'
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return <ImageIcon className="h-4 w-4 text-blue-400" />
  }
  if (mimeType === 'application/pdf') {
    return <FileText className="h-4 w-4 text-red-400" />
  }
  return <File className="h-4 w-4 text-slate-400" />
}

interface FilePanelFile extends UploadedFile {
  createdAt?: string
}

export default function FilePanel() {
  const { currentRoom } = useChatStore()

  const { data: files = [], isLoading } = useQuery<FilePanelFile[]>({
    queryKey: ['files', currentRoom?.id],
    queryFn: () =>
      currentRoom?.id ? getFilesForRoom(currentRoom.id) : Promise.resolve([]),
    initialData: [],
  })

  // Escuchamos 'new-file' para actualizar la lista sin refetch
  useMemo(() => {
    const handleNewFile = () => {
      // React Query re-valida automáticamente
    }

    socket.on('new-file', handleNewFile)
    return () => {
      socket.off('new-file', handleNewFile)
    }
  }, [])

  if (!currentRoom || currentRoom.type !== 'MULTIMEDIA') {
    return null
  }

  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)
  const imageFiles = files.filter((f) => f.mimeType?.startsWith('image/'))
  const otherFiles = files.filter((f) => !f.mimeType?.startsWith('image/'))

  return (
    <div className="flex h-full flex-col bg-surface text-fg">
      {/* Encabezado */}
      <div className="shrink-0 border-b border-white/8 px-4 py-3">
        <h2 className="text-sm font-medium text-slate-300">Archivos</h2>
        <p className="mt-1 text-xs text-slate-500">
          {files.length} archivo{files.length !== 1 ? 's' : ''} · {totalSizeMB}{' '}
          MB
        </p>
      </div>

      {/* Contenido */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg bg-white/2"
              />
            ))}
          </div>
        )}

        {!isLoading && files.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <ImageIcon className="mb-3 h-8 w-8 text-slate-600" />
            <p className="text-xs text-slate-500">
              Aún no hay archivos compartidos
            </p>
          </div>
        )}

        {!isLoading && imageFiles.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">
              Imágenes
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {imageFiles.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  rel="noreferrer"
                  target="_blank"
                  className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 hover:border-brand/50"
                >
                  <img
                    alt={file.filename}
                    className="h-full w-full object-cover transition group-hover:scale-110"
                    src={file.url}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <Download className="h-4 w-4 text-white" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {!isLoading && otherFiles.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">
              Otros
            </h3>
            <div className="space-y-2">
              {otherFiles.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  rel="noreferrer"
                  target="_blank"
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/2 px-3 py-2 text-xs hover:border-brand/50 hover:bg-white/4 transition"
                >
                  {getFileIcon(file.mimeType)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-300">
                      {file.filename}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatDate(file.createdAt)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
