import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  Paperclip,
  SendHorizonal,
  UploadCloud,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useChatStore } from '@/store/chatStore'

interface PendingUpload {
  id: string
  file: File
  previewUrl: string | null
  textPreview: string | null
}

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const buildPendingUpload = async (file: File): Promise<PendingUpload> => {
  let previewUrl: string | null = null
  let textPreview: string | null = null

  if (file.type.startsWith('image/') || file.type === 'application/pdf') {
    previewUrl = URL.createObjectURL(file)
  } else if (file.type === 'text/plain') {
    const content = await file.text()
    textPreview = content.slice(0, 800)
  }

  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    previewUrl,
    textPreview,
  }
}

const revokeUploadPreview = (upload: PendingUpload) => {
  if (upload.previewUrl) {
    URL.revokeObjectURL(upload.previewUrl)
  }
}

export default function FileUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingFilesRef = useRef<PendingUpload[]>([])
  const [pendingFiles, setPendingFiles] = useState<PendingUpload[]>([])
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const { currentRoom } = useChatStore()
  const { error, isUploading, progress, reset, upload } = useFileUpload()

  useEffect(() => {
    pendingFilesRef.current = pendingFiles
  }, [pendingFiles])

  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach(revokeUploadPreview)
    }
  }, [])

  const clearSelection = () => {
    pendingFilesRef.current.forEach(revokeUploadPreview)
    pendingFilesRef.current = []
    setPendingFiles([])
    setActivePreviewId(null)
    setUploadingIndex(null)
    reset()

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleFiles = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files)
    if (selectedFiles.length === 0) return

    const builtUploads = await Promise.all(selectedFiles.map(buildPendingUpload))
    reset()

    setPendingFiles((current) => {
      const next = [...current, ...builtUploads]

      if (!activePreviewId && next[0]) {
        setActivePreviewId(next[0].id)
      } else if (builtUploads[0] && current.length === 0) {
        setActivePreviewId(builtUploads[0].id)
      }

      return next
    })

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const removePendingFile = (id: string) => {
    setPendingFiles((current) => {
      const target = current.find((item) => item.id === id)
      if (target) {
        revokeUploadPreview(target)
      }

      const next = current.filter((item) => item.id !== id)

      if (activePreviewId === id) {
        setActivePreviewId(next[0]?.id ?? null)
      }

      if (next.length === 0) {
        setUploadingIndex(null)
        reset()
      }

      return next
    })
  }

  const sendPendingFiles = async () => {
    if (pendingFiles.length === 0) return

    for (const [index, item] of pendingFiles.entries()) {
      setUploadingIndex(index)
      const uploaded = await upload(item.file)

      if (!uploaded) {
        setActivePreviewId(item.id)
        setUploadingIndex(null)
        return
      }
    }

    clearSelection()
  }

  if (currentRoom?.type !== 'MULTIMEDIA') return null

  const activePreview =
    pendingFiles.find((item) => item.id === activePreviewId) ?? pendingFiles[0]

  return (
    <div
      className="rounded-lg border border-dashed border-white/[0.12] bg-white/[0.025] p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        void handleFiles(event.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        className="hidden"
        multiple
        onChange={(event) => {
          if (!event.target.files) return
          void handleFiles(event.target.files)
        }}
        type="file"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-[#d0d6e0]">
            <UploadCloud className="h-4 w-4 text-[#8a8f98]" />
            <span className="truncate">
              {pendingFiles.length > 0
                ? `${pendingFiles.length} archivo(s) listos para revisar`
                : 'Arrastra uno o varios archivos'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#62666d]">
            Max {currentRoom.maxFileSize}MB por archivo. Imagen, PDF o texto.
          </p>
        </div>

        <Button
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Paperclip className="h-4 w-4" />
          Adjuntar
        </Button>
      </div>

      {pendingFiles.length > 0 && activePreview && (
        <div className="mt-3 -mx-1 rounded-xl border border-white/[0.08] bg-[#111315] p-4">
          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#f7f8f8]">
                    Archivos pendientes
                  </p>
                  <p className="mt-1 text-xs text-[#8a8f98]">
                    Elige cual quieres previsualizar.
                  </p>
                </div>

                <Button
                  className="text-slate-300"
                  disabled={isUploading}
                  onClick={clearSelection}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cancelar archivos</span>
                </Button>
              </div>

              <div className="max-h-64 space-y-2 overflow-auto pr-1">
                {pendingFiles.map((item, index) => {
                  const isActive = item.id === activePreview.id
                  const isCurrentUpload = uploadingIndex === index && isUploading

                  return (
                    <button
                      key={item.id}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        isActive
                          ? 'border-[#7170ff] bg-[#5e6ad2]/15'
                          : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                      }`}
                      onClick={() => setActivePreviewId(item.id)}
                      type="button"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-[#f7f8f8]">
                            {item.file.name}
                          </p>
                          <p className="mt-1 text-xs text-[#8a8f98]">
                            {formatFileSize(item.file.size)}
                          </p>
                          {isCurrentUpload && (
                            <p className="mt-1 text-[11px] text-[#a7afff]">
                              Enviando...
                            </p>
                          )}
                        </div>

                        <Button
                          className="text-slate-400"
                          disabled={isUploading}
                          onClick={(event) => {
                            event.stopPropagation()
                            removePendingFile(item.id)
                          }}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Eliminar archivo</span>
                        </Button>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="min-w-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#f7f8f8]">
                  {activePreview.file.name}
                </p>
                <p className="mt-1 text-xs text-[#8a8f98]">
                  {activePreview.file.type || 'Tipo desconocido'} ·{' '}
                  {formatFileSize(activePreview.file.size)}
                </p>
              </div>

              {activePreview.previewUrl &&
                activePreview.file.type.startsWith('image/') && (
                  <img
                    alt={activePreview.file.name}
                    className="mt-3 h-[min(58vh,34rem)] w-full rounded-xl border border-white/[0.08] bg-black/30 object-contain"
                    src={activePreview.previewUrl}
                  />
                )}

              {activePreview.previewUrl &&
                activePreview.file.type === 'application/pdf' && (
                  <iframe
                    className="mt-3 h-[min(68vh,42rem)] w-full rounded-xl border border-white/[0.08] bg-white"
                    src={activePreview.previewUrl}
                    title={`Preview de ${activePreview.file.name}`}
                  />
                )}

              {activePreview.textPreview !== null && (
                <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-[#8a8f98]">
                    <FileText className="h-4 w-4" />
                    Vista previa de texto
                  </div>
                  <pre className="h-[min(50vh,30rem)] overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-[#d0d6e0]">
                    {activePreview.textPreview || 'Archivo de texto vacio'}
                  </pre>
                </div>
              )}

              {!activePreview.previewUrl &&
                activePreview.textPreview === null && (
                  <div className="mt-3 rounded-xl border border-dashed border-white/[0.08] px-3 py-6 text-xs text-[#8a8f98]">
                    El archivo esta listo para enviarse. No tiene preview visual en esta vista.
                  </div>
                )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              className="border-white/[0.08] bg-white/[0.04] text-slate-300"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              type="button"
              variant="outline"
            >
              <Paperclip className="h-4 w-4" />
              Agregar mas
            </Button>
            <Button
              className="bg-[#5e6ad2] text-white hover:bg-[#7170ff]"
              disabled={isUploading}
              onClick={() => void sendPendingFiles()}
              type="button"
            >
              <SendHorizonal className="h-4 w-4" />
              {isUploading
                ? `Enviando ${uploadingIndex !== null ? uploadingIndex + 1 : 1}/${pendingFiles.length}`
                : `Aceptar y enviar ${pendingFiles.length}`}
            </Button>
          </div>
        </div>
      )}

      {isUploading && (
        <Progress className="mt-3 bg-white/[0.08]" value={progress} />
      )}

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  )
}
