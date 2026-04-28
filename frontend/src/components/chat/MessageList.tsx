import { useEffect, useRef } from 'react'
import { FileText, MessageSquareText } from 'lucide-react'
import { getUserColor } from '@/lib/userColors'
import { useChatStore } from '@/store/chatStore'
import type { Message } from '@/types'

const formatTime = (timestamp: Message['timestamp']) =>
  // El timestamp puede venir como string, numero o Date desde diferentes respuestas.
  new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))

const isImageMessage = (message: Message) =>
  // Solo los archivos de imagen se previsualizan; el resto queda como enlace.
  message.type === 'file' && message.mimeType?.startsWith('image/')

export default function MessageList() {
  const { messages, nickname } = useChatStore()
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Baja automaticamente dentro del panel de mensajes, sin mover toda la pagina.
    const list = listRef.current
    if (!list) return

    list.scrollTo({
      top: list.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div
        ref={listRef}
        className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 text-center"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
          <MessageSquareText className="h-5 w-5 text-[#8a8f98]" />
        </div>
        <h2 className="text-lg font-medium text-[#f7f8f8]">
          Todavia no hay mensajes
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[#8a8f98]">
          Cuando alguien envie un mensaje, aparecera aqui en tiempo real.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      className="h-full overflow-y-auto p-4"
      role="log"
      aria-live="polite"
    >
      <div className="space-y-3">
        {messages.map((message) => {
          const isOwn = message.nickname === nickname
          const userColor = getUserColor(message.nickname)

          return (
            // Alinea a la derecha los mensajes del usuario actual.
            <article
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[min(82%,680px)] rounded-lg border px-3 py-2 ${
                  isOwn
                    ? 'border-[#5e6ad2]/30 bg-[#5e6ad2]/20'
                    : 'border-white/[0.08] bg-white/[0.035]'
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-[#8a8f98]">
                  <span className="font-medium" style={{ color: userColor }}>
                    {message.nickname}
                  </span>
                  <span>{formatTime(message.timestamp)}</span>
                </div>

                {message.type === 'file' ? (
                  // Los mensajes de archivo pueden tener previsualizacion y link de descarga.
                  <div className="space-y-2">
                    {isImageMessage(message) && message.fileUrl && (
                      <a
                        href={message.fileUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <img
                          alt={message.filename ?? 'Imagen adjunta'}
                          className="max-h-56 rounded-md border border-white/[0.08] object-cover"
                          src={message.fileUrl}
                        />
                      </a>
                    )}
                    <a
                      className="inline-flex items-center gap-2 text-sm text-[#828fff] underline-offset-4 hover:underline"
                      href={message.fileUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <FileText className="h-4 w-4" />
                      {message.filename ?? 'Archivo adjunto'}
                    </a>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#f7f8f8]">
                    {message.content}
                  </p>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
