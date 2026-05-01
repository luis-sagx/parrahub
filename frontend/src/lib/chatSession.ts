const CHAT_NICKNAME_KEY = 'chat_nickname'
const CHAT_ROOM_ID_KEY = 'chat_room_id'
const CHAT_PIN_KEY = 'chat_pin'

export interface StoredChatSession {
  roomId: string
  nickname: string
  pin?: string
}

export const saveChatSession = (session: StoredChatSession) => {
  sessionStorage.setItem(CHAT_ROOM_ID_KEY, session.roomId)
  sessionStorage.setItem(CHAT_NICKNAME_KEY, session.nickname)

  if (session.pin) {
    sessionStorage.setItem(CHAT_PIN_KEY, session.pin)
  } else {
    sessionStorage.removeItem(CHAT_PIN_KEY)
  }
}

export const getChatSession = (): StoredChatSession | null => {
  const roomId = sessionStorage.getItem(CHAT_ROOM_ID_KEY)
  const nickname = sessionStorage.getItem(CHAT_NICKNAME_KEY)

  if (!roomId || !nickname) return null

  return {
    roomId,
    nickname,
    pin: sessionStorage.getItem(CHAT_PIN_KEY) || undefined,
  }
}

export const clearChatSession = () => {
  sessionStorage.removeItem(CHAT_ROOM_ID_KEY)
  sessionStorage.removeItem(CHAT_NICKNAME_KEY)
  sessionStorage.removeItem(CHAT_PIN_KEY)
}
