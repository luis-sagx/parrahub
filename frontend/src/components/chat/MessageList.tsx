import { useEffect, useRef, useState } from 'react'
import {
  CheckCheck,
  FileText,
  Info,
  MessageSquarePlus,
  MessageSquareText,
  Trash2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getUserColor } from '@/lib/userColors'
import { cn } from '@/lib/utils'
import { socket } from '@/lib/socket'
import { useChatStore } from '@/store/chatStore'
import type { Message } from '@/types'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

const formatTime = (timestamp: Message['timestamp']) =>
  new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))

const isImageMessage = (message: Message) =>
  message.type === 'file' && message.mimeType?.startsWith('image/')

const isSystemMessage = (message: Message) => message.type === 'system'

const getParticipants = (message: Message) =>
  Array.from(new Set(message.participants?.length ? message.participants : [message.nickname]))

const getSeenBy = (message: Message) =>
  Array.from(new Set(message.seenBy?.length ? message.seenBy : [message.nickname]))

const isMessageFullySeen = (message: Message) => {
  const participants = getParticipants(message)
  const seenBy = getSeenBy(message)

  return participants.length > 0 && participants.every((user) => seenBy.includes(user))
}

export default function MessageList() {
  const { messages, nickname } = useChatStore()
  const listRef = useRef<HTMLDivElement | null>(null)
  const messageElementsRef = useRef(new Map<string, HTMLElement>())
  const visibleMessageIdsRef = useRef(new Set<string>())
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(
    null,
  )
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const selectedMessage =
    messages.find((message) => message.id === selectedMessageId) ?? null

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    list.scrollTo({
      top: list.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  useEffect(() => {
    if (!nickname || messages.length === 0) return

    const flushSeenMessages = () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return

      const pendingSeenIds = messages
        .filter((message) => message.nickname !== nickname)
        .filter((message) => !getSeenBy(message).includes(nickname))
        .filter((message) => visibleMessageIdsRef.current.has(message.id))
        .map((message) => message.id)

      if (pendingSeenIds.length === 0) return

      socket.emit('mark-messages-seen', {
        messageIds: pendingSeenIds,
      })
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const messageId = entry.target.getAttribute('data-message-id')
          if (!messageId) continue

          if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
            visibleMessageIdsRef.current.add(messageId)
          } else {
            visibleMessageIdsRef.current.delete(messageId)
          }
        }

        flushSeenMessages()
      },
      {
        root: listRef.current,
        threshold: [0.65],
      },
    )

    for (const [messageId, element] of messageElementsRef.current.entries()) {
      if (messages.some((message) => message.id === messageId)) {
        observer.observe(element)
      }
    }

    const handleFocus = () => {
      flushSeenMessages()
    }

    const handleVisibilityChange = () => {
      flushSeenMessages()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    flushSeenMessages()

    return () => {
      observer.disconnect()
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [messages, nickname])

  useEffect(() => {
    const currentMessageIds = new Set(messages.map((message) => message.id))

    for (const messageId of messageElementsRef.current.keys()) {
      if (!currentMessageIds.has(messageId)) {
        messageElementsRef.current.delete(messageId)
        visibleMessageIdsRef.current.delete(messageId)
      }
    }
  }, [messages])

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
    <>
      <div
        ref={listRef}
        className="h-full overflow-y-auto p-4"
        role="log"
        aria-live="polite"
      >
        <div className="space-y-3">
          {messages.map((message) => {
            if (isSystemMessage(message)) {
              return (
                <article
                  key={message.id}
                  className="flex justify-center"
                  data-message-id={message.id}
                  ref={(element) => {
                    if (element) {
                      messageElementsRef.current.set(message.id, element)
                      return
                    }

                    messageElementsRef.current.delete(message.id)
                    visibleMessageIdsRef.current.delete(message.id)
                  }}
                >
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-[#aeb4bf]">
                    <Info className="h-3.5 w-3.5 text-[#7170ff]" />
                    <span>{message.content}</span>
                    <span className="text-[#7f8590]">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </article>
              )
            }

            const isOwn = message.nickname === nickname
            const userColor = getUserColor(message.nickname)
            const reactions = message.reactions ?? []
            const showsImagePreview = isImageMessage(message) && Boolean(message.fileUrl)
            const participants = getParticipants(message)
            const seenBy = getSeenBy(message)
            const isFullySeen = isMessageFullySeen(message)
            const isDeleted = message.deleted === true

            return (
              <article
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                data-message-id={message.id}
                ref={(element) => {
                  if (element) {
                    messageElementsRef.current.set(message.id, element)
                    return
                  }

                  messageElementsRef.current.delete(message.id)
                  visibleMessageIdsRef.current.delete(message.id)
                }}
              >
                <div className={cn(
                      'group flex flex-col',
                      isOwn ? 'items-end max-w-[75%]' : 'items-start max-w-[75%]'
                    )}>
                  {isDeleted ? (
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                      <p className="text-xs font-medium text-[#6b6f7a] mb-1">
                        {message.nickname}
                      </p>
                      <p className="italic text-sm leading-6 text-[#6b6f7a]">
                        Mensaje eliminado
                      </p>
                    </div>
                  ) : (
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
                  )}

                  {!isDeleted && (
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

                    <button
                      aria-label="Ver informacion del mensaje"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[#a8adb7] transition hover:bg-white/[0.07] hover:text-white md:opacity-0 md:group-hover:opacity-100"
                      onClick={() => setSelectedMessageId(message.id)}
                      type="button"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>

                    {isOwn && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs',
                          isFullySeen
                            ? 'border-sky-400/40 bg-sky-400/10 text-sky-300'
                            : 'border-white/[0.08] bg-white/[0.03] text-[#8a8f98]',
                        )}
                        title={
                          isFullySeen
                            ? 'Todos los participantes ya vieron este mensaje'
                            : 'Aun falta que alguien vea este mensaje'
                        }
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        {seenBy.length}/{participants.length}
                      </span>
                    )}

                    
                  </div>
                )}
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <Dialog
        open={Boolean(selectedMessage)}
        onOpenChange={(open) => {
          if (!open) setSelectedMessageId(null)
        }}
      >
        <DialogContent className="border-white/8 bg-[#17181b] text-white">
          <DialogHeader>
            <DialogTitle>Informacion del mensaje</DialogTitle>
            <DialogDescription className="text-slate-400">
              Aqui puedes ver quienes ya lo vieron dentro del grupo.
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
                <p className="text-xs text-slate-400">
                  {selectedMessage.nickname} • {formatTime(selectedMessage.timestamp)}
                </p>
                {selectedMessage.deleted ? (
                  <p className="mt-2 italic text-sm text-[#6b6f7a]">
                    Mensaje eliminado
                  </p>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-100">
                    {selectedMessage.type === 'file'
                      ? selectedMessage.filename ?? selectedMessage.content
                      : selectedMessage.content}
                  </p>
                )}
              </div>

              {!selectedMessage.deleted && (
                <div className="space-y-2">
                  {getParticipants(selectedMessage).map((participant) => {
                    const alreadySeen = getSeenBy(selectedMessage).includes(participant)

                    return (
                      <div
                        key={`${selectedMessage.id}-${participant}`}
                        className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2"
                      >
                        <span
                          className="text-sm font-medium"
                          style={{ color: getUserColor(participant) }}
                        >
                          {participant}
                        </span>
                        <span
                          className={cn(
                            'text-xs font-medium',
                            alreadySeen ? 'text-sky-300' : 'text-slate-400',
                          )}
                        >
                          {alreadySeen ? 'Vio el mensaje' : 'Aun no lo ve'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {selectedMessage.nickname === nickname && !selectedMessage.deleted && (
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
                  onClick={() => {
                    socket.emit('delete-message', {
                      messageId: selectedMessage.id,
                    })
                    setSelectedMessageId(null)
                  }}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar mensaje
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
