import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from './chatStore'
import type { Message, Room, MessageReaction } from '@/types'

const testRoom: Room = {
  id: 'room-1',
  name: 'Test Room',
  type: 'TEXT',
  maxFileSize: 10,
  createdAt: new Date().toISOString(),
}

const testMessage: Message = {
  id: 'msg-1',
  roomId: 'room-1',
  nickname: 'user1',
  content: 'Hello',
  type: 'text',
  timestamp: Date.now(),
}

beforeEach(() => {
  useChatStore.getState().clearRoom()
})

describe('useChatStore', () => {
  describe('estado inicial', () => {
    it('no tiene sala activa', () => {
      expect(useChatStore.getState().currentRoom).toBeNull()
    })

    it('no tiene nickname', () => {
      expect(useChatStore.getState().nickname).toBe('')
    })

    it('no tiene mensajes', () => {
      expect(useChatStore.getState().messages).toEqual([])
    })

    it('no tiene usuarios conectados', () => {
      expect(useChatStore.getState().connectedUsers).toEqual([])
    })

    it('no está conectado', () => {
      expect(useChatStore.getState().isConnected).toBe(false)
    })

    it('no está uniendo', () => {
      expect(useChatStore.getState().isJoining).toBe(false)
    })

    it('no tiene error de ingreso', () => {
      expect(useChatStore.getState().joinError).toBeNull()
    })
  })

  describe('setRoom', () => {
    it('define la sala activa', () => {
      useChatStore.getState().setRoom(testRoom, 'user1')
      expect(useChatStore.getState().currentRoom).toEqual(testRoom)
    })

    it('define el nickname', () => {
      useChatStore.getState().setRoom(testRoom, 'user1')
      expect(useChatStore.getState().nickname).toBe('user1')
    })

    it('limpia error de ingreso previo', () => {
      useChatStore.getState().setJoinError('Error previo')
      useChatStore.getState().setRoom(testRoom, 'user1')
      expect(useChatStore.getState().joinError).toBeNull()
    })
  })

  describe('setMessages', () => {
    it('guarda los mensajes', () => {
      const messages = [testMessage]
      useChatStore.getState().setMessages(messages)
      expect(useChatStore.getState().messages).toEqual(messages)
    })

    it('limita a 200 mensajes', () => {
      const messages = Array.from({ length: 250 }, (_, i) => ({
        ...testMessage,
        id: `msg-${i}`,
      }))
      useChatStore.getState().setMessages(messages)
      expect(useChatStore.getState().messages.length).toBe(200)
    })
  })

  describe('addMessage', () => {
    it('agrega un nuevo mensaje', () => {
      useChatStore.getState().addMessage(testMessage)
      expect(useChatStore.getState().messages).toContain(testMessage)
    })

    it('no duplica mensajes existentes', () => {
      useChatStore.getState().addMessage(testMessage)
      useChatStore.getState().addMessage(testMessage)
      expect(useChatStore.getState().messages.length).toBe(1)
    })

    it('actualiza mensaje existente si ya existe', () => {
      useChatStore.getState().addMessage(testMessage)
      const updatedMessage = { ...testMessage, content: 'Updated' }
      useChatStore.getState().addMessage(updatedMessage)
      expect(useChatStore.getState().messages[0].content).toBe('Updated')
    })
  })

  describe('updateMessageReactions', () => {
    it('actualiza las reacciones de un mensaje', () => {
      useChatStore.getState().setMessages([testMessage])
      const reactions: MessageReaction[] = [{ emoji: '👍', users: ['user1'] }]
      useChatStore.getState().updateMessageReactions('msg-1', reactions)
      expect(useChatStore.getState().messages[0].reactions).toEqual(reactions)
    })
  })

  describe('updateMessageSeenBy', () => {
    it('actualiza seenBy de un mensaje', () => {
      useChatStore.getState().setMessages([testMessage])
      useChatStore.getState().updateMessageSeenBy('msg-1', ['user1', 'user2'])
      expect(useChatStore.getState().messages[0].seenBy).toEqual([
        'user1',
        'user2',
      ])
    })
  })

  describe('setUsers', () => {
    it('define la lista de usuarios', () => {
      useChatStore.getState().setUsers(['user1', 'user2'])
      expect(useChatStore.getState().connectedUsers).toEqual(['user1', 'user2'])
    })
  })

  describe('addUser', () => {
    it('agrega un usuario', () => {
      useChatStore.getState().addUser('user1')
      expect(useChatStore.getState().connectedUsers).toContain('user1')
    })

    it('no agrega duplicados', () => {
      useChatStore.getState().addUser('user1')
      useChatStore.getState().addUser('user1')
      expect(useChatStore.getState().connectedUsers.length).toBe(1)
    })
  })

  describe('removeUser', () => {
    it('elimina un usuario', () => {
      useChatStore.getState().setUsers(['user1', 'user2'])
      useChatStore.getState().removeUser('user1')
      expect(useChatStore.getState().connectedUsers).not.toContain('user1')
    })

    it('no falla si el usuario no existe', () => {
      expect(() =>
        useChatStore.getState().removeUser('noexiste'),
      ).not.toThrow()
    })
  })

  describe('setConnected', () => {
    it('actualiza el estado de conexión', () => {
      useChatStore.getState().setConnected(true)
      expect(useChatStore.getState().isConnected).toBe(true)
    })
  })

  describe('setJoining', () => {
    it('actualiza el estado de unión', () => {
      useChatStore.getState().setJoining(true)
      expect(useChatStore.getState().isJoining).toBe(true)
    })
  })

  describe('setJoinError', () => {
    it('define el error de ingreso', () => {
      useChatStore.getState().setJoinError('Error de conexión')
      expect(useChatStore.getState().joinError).toBe('Error de conexión')
    })

    it('puede limpiar el error', () => {
      useChatStore.getState().setJoinError('Error')
      useChatStore.getState().setJoinError(null)
      expect(useChatStore.getState().joinError).toBeNull()
    })
  })

  describe('clearRoom', () => {
    it('resetea todo el estado', () => {
      useChatStore.getState().setRoom(testRoom, 'user1')
      useChatStore.getState().addMessage(testMessage)
      useChatStore.getState().setUsers(['user1'])
      useChatStore.getState().setConnected(true)
      useChatStore.getState().setJoining(true)
      useChatStore.getState().setJoinError('error')

      useChatStore.getState().clearRoom()

      const state = useChatStore.getState()
      expect(state.currentRoom).toBeNull()
      expect(state.nickname).toBe('')
      expect(state.messages).toEqual([])
      expect(state.connectedUsers).toEqual([])
      expect(state.isConnected).toBe(false)
      expect(state.isJoining).toBe(false)
      expect(state.joinError).toBeNull()
    })
  })
})