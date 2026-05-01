import { useEffect } from 'react'
import { Menu, UsersRound } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import MessageInput from '@/components/chat/MessageInput'
import MessageList from '@/components/chat/MessageList'
import UserList from '@/components/chat/UserList'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useSocket } from '@/hooks/useSocket'
import { getChatSession } from '@/lib/chatSession'
import { useChatStore } from '@/store/chatStore'

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { disconnect, reconnectFromSession } = useSocket()
  const { connectedUsers, currentRoom, isConnected, isJoining, joinError } =
    useChatStore()
  const storedSession = roomId ? getChatSession() : null
  const canReconnect = Boolean(
    storedSession && storedSession.roomId === roomId && !joinError,
  )

  useEffect(() => {
    // Al cerrar o recargar la pestana se avisa al socket para limpiar la presencia.
    const handleBeforeUnload = () => {
      disconnect(false)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [disconnect])

  useEffect(() => {
    if (!roomId || currentRoom || isConnected || isJoining) return
    reconnectFromSession(roomId)
  }, [currentRoom, isConnected, isJoining, reconnectFromSession, roomId])

  if (!roomId) {
    // Sin ID no hay sala a la cual volver, asi que se manda al login.
    return <Navigate to="/login" replace />
  }

  if (
    (!currentRoom || !isConnected || currentRoom.id !== roomId) &&
    canReconnect
  ) {
    return (
      <main className="flex h-dvh items-center justify-center bg-zinc-950 px-6 text-fg">
        <div className="rounded-lg border border-white/8 bg-surface px-5 py-4 text-center">
          <p className="text-sm text-slate-300">
            {joinError ?? 'Reconectando a la sala...'}
          </p>
        </div>
      </main>
    )
  }

  if (!currentRoom || !isConnected || currentRoom.id !== roomId) {
    // Evita entrar directo a /room/:id sin haber pasado por el PIN.
    return <Navigate to={`/join/${roomId}`} replace />
  }

  const handleLeave = () => {
    // Salir desconecta el socket y devuelve al formulario de union.
    disconnect()
    navigate(`/join/${roomId}`)
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-fg">
      <header className="shrink-0 border-b border-white/8 bg-surface/95">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-medium">
                {currentRoom.name}
              </h1>
              <Badge className="border-white/10 bg-white/[0.04] text-slate-300">
                {currentRoom.type}
              </Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-slate-400">
              {currentRoom.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="hidden border-white/10 bg-white/[0.04] text-slate-300 sm:inline-flex">
              <UsersRound className="h-3.5 w-3.5" />
              {connectedUsers.length} usuarios
            </Badge>

            <Sheet>
              {/* En movil, la lista de usuarios vive en un panel lateral. */}
              <SheetTrigger asChild>
                <Button
                  className="md:hidden"
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Ver usuarios</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                className="border-white/8 bg-surface p-0 text-fg"
                side="left"
              >
                <SheetHeader className="border-b border-white/8">
                  <SheetTitle className="text-fg">Usuarios</SheetTitle>
                  <SheetDescription className="text-slate-400">
                    Personas conectadas en esta sala.
                  </SheetDescription>
                </SheetHeader>
                <UserList />
              </SheetContent>
            </Sheet>

            <Button onClick={handleLeave} type="button" variant="ghost">
              Salir
            </Button>
          </div>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[240px_1fr]">
        {/* En escritorio la lista de usuarios queda fija a la izquierda. */}
        <div className="hidden min-h-0 overflow-hidden border-r border-white/8 md:block">
          <UserList />
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1">
            <MessageList />
          </div>
          <MessageInput />
        </div>
      </section>
    </main>
  )
}
