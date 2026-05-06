import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveChatSession,
  getChatSession,
  clearChatSession,
} from './chatSession'

describe('chatSession', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  describe('saveChatSession', () => {
    it('guarda roomId en sessionStorage', () => {
      saveChatSession({ roomId: 'room-1', nickname: 'user1' })
      expect(sessionStorage.getItem('chat_room_id')).toBe('room-1')
    })

    it('guarda nickname en sessionStorage', () => {
      saveChatSession({ roomId: 'room-1', nickname: 'user1' })
      expect(sessionStorage.getItem('chat_nickname')).toBe('user1')
    })

    it('guarda pin si se proporciona', () => {
      saveChatSession({ roomId: 'room-1', nickname: 'user1', pin: '1234' })
      expect(sessionStorage.getItem('chat_pin')).toBe('1234')
    })

    it('no guarda pin si no se proporciona', () => {
      saveChatSession({ roomId: 'room-1', nickname: 'user1' })
      expect(sessionStorage.getItem('chat_pin')).toBeNull()
    })

    it('actualiza pin si ya existía', () => {
      saveChatSession({ roomId: 'room-1', nickname: 'user1', pin: '1234' })
      saveChatSession({ roomId: 'room-1', nickname: 'user1', pin: '5678' })
      expect(sessionStorage.getItem('chat_pin')).toBe('5678')
    })
  })

  describe('getChatSession', () => {
    it('retorna null si no hay session', () => {
      const result = getChatSession()
      expect(result).toBeNull()
    })

    it('retorna null si solo hay roomId', () => {
      sessionStorage.setItem('chat_room_id', 'room-1')
      const result = getChatSession()
      expect(result).toBeNull()
    })

    it('retorna null si solo hay nickname', () => {
      sessionStorage.setItem('chat_nickname', 'user1')
      const result = getChatSession()
      expect(result).toBeNull()
    })

    it('retorna la session completa si existe', () => {
      sessionStorage.setItem('chat_room_id', 'room-1')
      sessionStorage.setItem('chat_nickname', 'user1')
      sessionStorage.setItem('chat_pin', '1234')

      const result = getChatSession()

      expect(result).toEqual({
        roomId: 'room-1',
        nickname: 'user1',
        pin: '1234',
      })
    })

    it('retorna pin como undefined si no existe', () => {
      sessionStorage.setItem('chat_room_id', 'room-1')
      sessionStorage.setItem('chat_nickname', 'user1')

      const result = getChatSession()

      expect(result?.pin).toBeUndefined()
    })
  })

  describe('clearChatSession', () => {
    it('elimina todos los datos de session', () => {
      sessionStorage.setItem('chat_room_id', 'room-1')
      sessionStorage.setItem('chat_nickname', 'user1')
      sessionStorage.setItem('chat_pin', '1234')

      clearChatSession()

      expect(sessionStorage.getItem('chat_room_id')).toBeNull()
      expect(sessionStorage.getItem('chat_nickname')).toBeNull()
      expect(sessionStorage.getItem('chat_pin')).toBeNull()
    })

    it('no falla si no hay datos', () => {
      expect(() => clearChatSession()).not.toThrow()
    })
  })
})