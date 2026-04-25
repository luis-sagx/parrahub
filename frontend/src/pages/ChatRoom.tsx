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
import { useChatStore } from '@/store/chatStore'

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { disconnect } = useSocket()
  const { connectedUsers, currentRoom, isConnected } = useChatStore()

  useEffect(() => {
    const handleBeforeUnload = () => {
      disconnect()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [disconnect])

  if (!roomId) {
    return <Navigate to="/login" replace />
  }

  if (!currentRoom || !isConnected || currentRoom.id !== roomId) {
    return <Navigate to={`/join/${roomId}`} replace />
  }

  const handleLeave = () => {
    disconnect()
    navigate(`/join/${roomId}`)
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#08090a] text-[#f7f8f8]">
      <header className="border-b border-white/[0.08] bg-[#0f1011]/95">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-medium">
                {currentRoom.name}
              </h1>
              <Badge className="border-white/10 bg-white/[0.04] text-[#d0d6e0]">
                {currentRoom.type}
              </Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-[#8a8f98]">
              {currentRoom.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="hidden border-white/10 bg-white/[0.04] text-[#d0d6e0] sm:inline-flex">
              <UsersRound className="h-3.5 w-3.5" />
              {connectedUsers.length} usuarios
            </Badge>

            <Sheet>
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
                className="border-white/[0.08] bg-[#0f1011] p-0 text-[#f7f8f8]"
                side="left"
              >
                <SheetHeader className="border-b border-white/[0.08]">
                  <SheetTitle className="text-[#f7f8f8]">Usuarios</SheetTitle>
                  <SheetDescription className="text-[#8a8f98]">
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

      <section className="grid min-h-0 flex-1 md:grid-cols-[240px_1fr]">
        <div className="hidden min-h-0 border-r border-white/[0.08] md:block">
          <UserList />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MessageList />
          </div>
          <MessageInput />
        </div>
      </section>
    </main>
  )
}
