import { useRef, useState } from 'react'
import { Paperclip, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useChatStore } from '@/store/chatStore'

export default function FileUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const { currentRoom } = useChatStore()
  const { error, isUploading, progress, upload } = useFileUpload()

  const handleFile = (file?: File) => {
    if (!file) return
    setSelectedFileName(file.name)
    upload(file)
  }

  if (currentRoom?.type !== 'MULTIMEDIA') return null

  return (
    <div
      className="rounded-lg border border-dashed border-white/[0.12] bg-white/[0.025] p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        handleFile(event.dataTransfer.files[0])
      }}
    >
      <input
        ref={inputRef}
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
        type="file"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-[#d0d6e0]">
            <UploadCloud className="h-4 w-4 text-[#8a8f98]" />
            <span className="truncate">
              {selectedFileName ?? `Arrastra un archivo o selecciona uno`}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#62666d]">
            Max {currentRoom.maxFileSize}MB. Imagen, PDF o texto.
          </p>
        </div>

        <Button
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <Paperclip className="h-4 w-4" />
          Adjuntar
        </Button>
      </div>

      {isUploading && (
        <Progress className="mt-3 bg-white/[0.08]" value={progress} />
      )}

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  )
}
