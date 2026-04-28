const CHAT_SESSION_KEY = 'chatSession'

export interface StoredChatSession {
  roomId: string
  pin: string
  nickname: string
}

export const saveChatSession = (session: StoredChatSession) => {
  sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(session))
}

export const getChatSession = (): StoredChatSession | null => {
  const rawSession = sessionStorage.getItem(CHAT_SESSION_KEY)
  if (!rawSession) return null

  try {
    return JSON.parse(rawSession) as StoredChatSession
  } catch {
    sessionStorage.removeItem(CHAT_SESSION_KEY)
    return null
  }
}

export const clearChatSession = () => {
  sessionStorage.removeItem(CHAT_SESSION_KEY)
}
