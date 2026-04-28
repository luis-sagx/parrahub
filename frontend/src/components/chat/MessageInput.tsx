import { useState } from 'react'
import { SendHorizonal } from 'lucide-react'
import FileUpload from '@/components/chat/FileUpload'
import { Button } from '@/components/ui/button'
import { socket } from '@/lib/socket'
import { useChatStore } from '@/store/chatStore'

const MAX_MESSAGE_LENGTH = 1000

export default function MessageInput() {
  const { currentRoom, isConnected } = useChatStore()
  const [content, setContent] = useState('')

  // Se recorta el texto antes de validar/enviar para evitar mensajes vacios.
  const trimmedContent = content.trim()
  const canSend = isConnected && trimmedContent.length > 0

  const sendMessage = () => {
    if (!canSend) return

    // Socket.IO envia el mensaje al backend; la lista se actualiza al recibir new-message.
    socket.emit('send-message', { content: trimmedContent })
    setContent('')
  }

  return (
    <div className="shrink-0 border-t border-white/[0.08] bg-[#0f1011] p-3">
      {/* Las salas multimedia muestran el bloque de carga encima del texto. */}
      {currentRoom?.type === 'MULTIMEDIA' && <FileUpload />}

      <div className="mt-3 flex gap-2">
        <textarea
          className="min-h-10 flex-1 resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm leading-6 text-[#f7f8f8] outline-none placeholder:text-[#62666d] focus:border-[#7170ff] focus:ring-3 focus:ring-[#7170ff]/30 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isConnected}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              // Enter envia; Shift+Enter permite escribir en varias lineas.
              event.preventDefault()
              sendMessage()
            }
          }}
          placeholder={
            isConnected ? 'Escribe un mensaje...' : 'Conectate para escribir'
          }
          rows={1}
          value={content}
        />

        <Button
          className="h-10 bg-[#5e6ad2] text-white hover:bg-[#7170ff]"
          disabled={!canSend}
          onClick={sendMessage}
          type="button"
        >
          <SendHorizonal className="h-4 w-4" />
          <span className="sr-only">Enviar mensaje</span>
        </Button>
      </div>

      <p className="mt-1 text-right text-xs text-[#62666d]">
        {content.length}/{MAX_MESSAGE_LENGTH}
      </p>
    </div>
  )
}
