import { Badge } from '@/components/ui/badge'
import { getUserColor } from '@/lib/userColors'
import { useChatStore } from '@/store/chatStore'

export default function UserList() {
  const { connectedUsers, nickname } = useChatStore()
  // El usuario actual queda primero; los demas se ordenan alfabeticamente.
  const orderedUsers = [
    ...connectedUsers.filter((user) => user === nickname),
    ...connectedUsers
      .filter((user) => user !== nickname)
      .sort((a, b) => a.localeCompare(b)),
  ]

  return (
    <aside className="h-full border-white/[0.08] bg-[#0f1011]">
      <div className="border-b border-white/[0.08] px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#f7f8f8]">Usuarios</h2>
          <Badge className="border-white/10 bg-white/[0.04] text-[#d0d6e0]">
            {connectedUsers.length}
          </Badge>
        </div>
      </div>

      <div className="space-y-1 p-3">
        {orderedUsers.length === 0 && (
          <p className="px-2 py-3 text-sm text-[#8a8f98]">
            Aun no hay usuarios visibles.
          </p>
        )}

        {orderedUsers.map((user) => {
          const userColor = getUserColor(user)

          return (
            // Cada fila muestra inicial, nickname y una marca cuando eres tu.
            <div
              key={user}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-[#d0d6e0]"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium"
                style={{
                  borderColor: `${userColor}55`,
                  backgroundColor: `${userColor}22`,
                  color: userColor,
                }}
              >
                {user.charAt(0).toUpperCase()}
              </div>
              <span
                className="min-w-0 flex-1 truncate font-medium"
                style={{ color: userColor }}
              >
                {user}
              </span>
              {user === nickname && (
                <Badge className="border-[#5e6ad2]/30 bg-[#5e6ad2]/20 text-[#d0d6e0]">
                  tu
                </Badge>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
