import { describe, expect, it, vi } from 'vitest'
import { buildSystemMessage } from './systemMessages'

describe('buildSystemMessage', () => {
  it('crea un mensaje de sistema para entrada al chat', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T12:00:00.000Z'))

    const message = buildSystemMessage('room-1', 'Ana', 'joined')

    expect(message).toMatchObject({
      roomId: 'room-1',
      nickname: 'Sistema',
      content: 'Ana entró al chat',
      type: 'system',
      participants: [],
      seenBy: [],
      timestamp: '2026-05-07T12:00:00.000Z',
    })
    expect(message.id).toBe('system-joined-Ana-1778155200000')

    vi.useRealTimers()
  })

  it('crea un mensaje de sistema para salida del chat', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T12:30:00.000Z'))

    const message = buildSystemMessage('room-9', 'Luis', 'left')

    expect(message).toMatchObject({
      roomId: 'room-9',
      nickname: 'Sistema',
      content: 'Luis salió del chat',
      type: 'system',
      timestamp: '2026-05-07T12:30:00.000Z',
    })

    vi.useRealTimers()
  })
})
