import type { Message } from '@/types'

type PresenceEvent = 'joined' | 'left'

const presenceMessages: Record<PresenceEvent, (nickname: string) => string> = {
  joined: (nickname) => `${nickname} entró al chat`,
  left: (nickname) => `${nickname} salió del chat`,
}

export const buildSystemMessage = (
  roomId: string,
  nickname: string,
  event: PresenceEvent,
): Message => ({
  id: `system-${event}-${nickname}-${Date.now()}`,
  roomId,
  nickname: 'Sistema',
  content: presenceMessages[event](nickname),
  type: 'system',
  participants: [],
  seenBy: [],
  timestamp: new Date().toISOString(),
})
