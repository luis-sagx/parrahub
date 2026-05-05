import { useEffect, useRef, useState } from 'react'
import { FileText, MessageSquarePlus, MessageSquareText } from 'lucide-react'
import { getUserColor } from '@/lib/userColors'
import { cn } from '@/lib/utils'
import { socket } from '@/lib/socket'
import { useChatStore } from '@/store/chatStore'
import type { Message } from '@/types'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

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
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(
    null,
  )

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
          const reactions = message.reactions ?? []
          const showsImagePreview = isImageMessage(message) && Boolean(message.fileUrl)

          return (
            // Alinea a la derecha los mensajes del usuario actual.
            <article
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div className="group flex max-w-[min(82%,680px)] flex-col items-start">
                <div
                  className={`rounded-lg border px-3 py-2 ${
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
                      {showsImagePreview && (
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

                      {!showsImagePreview && (
                        <a
                          className="inline-flex items-center gap-2 text-sm text-[#828fff] underline-offset-4 hover:underline"
                          href={message.fileUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <FileText className="h-4 w-4" />
                          {message.filename ?? 'Archivo adjunto'}
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#f7f8f8]">
                      {message.content}
                    </p>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {reactions.map((reaction) => {
                    const reactedByCurrentUser = reaction.users.includes(nickname)

                    return (
                      <button
                        key={`${message.id}-${reaction.emoji}`}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors',
                          reactedByCurrentUser
                            ? 'border-[#7170ff]/50 bg-[#7170ff]/20 text-white'
                            : 'border-white/[0.08] bg-white/[0.03] text-[#d5d7dc] hover:bg-white/[0.06]',
                        )}
                        onClick={() =>
                          socket.emit('react-message', {
                            messageId: message.id,
                            emoji: reaction.emoji,
                          })
                        }
                        type="button"
                      >
                        <span>{reaction.emoji}</span>
                        <span>{reaction.users.length}</span>
                      </button>
                    )
                  })}

                  <div className="relative">
                    <button
                      aria-expanded={activeReactionPicker === message.id}
                      aria-label="Agregar reaccion"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[#a8adb7] transition hover:bg-white/[0.07] hover:text-white md:opacity-0 md:group-hover:opacity-100"
                      onClick={() =>
                        setActiveReactionPicker((current) =>
                          current === message.id ? null : message.id,
                        )
                      }
                      type="button"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                    </button>

                    {activeReactionPicker === message.id && (
                      <div
                        className={cn(
                          'absolute z-10 mt-2 flex gap-1 rounded-full border border-white/[0.08] bg-[#17181b] p-1 shadow-lg',
                          isOwn ? 'right-0' : 'left-0',
                        )}
                      >
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={`${message.id}-${emoji}-picker`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:bg-white/[0.08]"
                            onClick={() => {
                              socket.emit('react-message', {
                                messageId: message.id,
                                emoji,
                              })
                              setActiveReactionPicker(null)
                            }}
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
