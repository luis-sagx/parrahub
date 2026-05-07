import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  createRoomSchema,
  joinRoomSchema,
} from './validations'

describe('loginSchema', () => {
  it('valida credenciales correctas', () => {
    const result = loginSchema.safeParse({
      username: 'admin',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('falla si username está vacío', () => {
    const result = loginSchema.safeParse({
      username: '',
      password: 'password123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('username')
    }
  })

  it('falla si password tiene menos de 8 caracteres', () => {
    const result = loginSchema.safeParse({
      username: 'admin',
      password: 'pass',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('password')
    }
  })

  it('falla si username excede 50 caracteres', () => {
    const result = loginSchema.safeParse({
      username: 'a'.repeat(51),
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })
})

describe('createRoomSchema', () => {
  it('valida datos correctos para crear sala', () => {
    const result = createRoomSchema.safeParse({
      name: 'Sala de prueba',
      type: 'TEXT',
      pin: '1234',
      maxFileSize: 10,
    })
    expect(result.success).toBe(true)
  })

  it('falla si el nombre tiene menos de 3 caracteres', () => {
    const result = createRoomSchema.safeParse({
      name: 'ab',
      type: 'TEXT',
      pin: '1234',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('name')
    }
  })

  it('falla si el tipo no es TEXT ni MULTIMEDIA', () => {
    const result = createRoomSchema.safeParse({
      name: 'Sala valida',
      type: 'INVALID',
      pin: '1234',
    })
    expect(result.success).toBe(false)
  })

  it('falla si el PIN no tiene entre 4 y 10 dígitos', () => {
    const result = createRoomSchema.safeParse({
      name: 'Sala valida',
      type: 'TEXT',
      pin: '123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('pin')
    }
  })

  it('falla si el PIN contiene letras', () => {
    const result = createRoomSchema.safeParse({
      name: 'Sala valida',
      type: 'TEXT',
      pin: '1234abcd',
    })
    expect(result.success).toBe(false)
  })

  it('falla si maxFileSize es menor que 1', () => {
    const result = createRoomSchema.safeParse({
      name: 'Sala valida',
      type: 'MULTIMEDIA',
      pin: '1234',
      maxFileSize: 0,
    })
    expect(result.success).toBe(false)
  })

  it('falla si maxFileSize excede 100', () => {
    const result = createRoomSchema.safeParse({
      name: 'Sala valida',
      type: 'MULTIMEDIA',
      pin: '1234',
      maxFileSize: 101,
    })
    expect(result.success).toBe(false)
  })

  it('permite maxFileSize opcional', () => {
    const result = createRoomSchema.safeParse({
      name: 'Sala valida',
      type: 'TEXT',
      pin: '1234',
    })
    expect(result.success).toBe(true)
  })
})

describe('joinRoomSchema', () => {
  it('valida datos correctos para unirse a sala', () => {
    const result = joinRoomSchema.safeParse({
      pin: '123456',
      nickname: 'Usuario1',
    })
    expect(result.success).toBe(true)
  })

  it('falla si el nickname tiene menos de 2 caracteres', () => {
    const result = joinRoomSchema.safeParse({
      pin: '1234',
      nickname: 'a',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('nickname')
    }
  })

  it('falla si el nickname excede 20 caracteres', () => {
    const result = joinRoomSchema.safeParse({
      pin: '1234',
      nickname: 'a'.repeat(21),
    })
    expect(result.success).toBe(false)
  })

  it('falla si el nickname contiene caracteres inválidos', () => {
    const result = joinRoomSchema.safeParse({
      pin: '1234',
      nickname: 'user@domain',
    })
    expect(result.success).toBe(false)
  })

  it('permite guiones y guiones bajos en nickname', () => {
    const result = joinRoomSchema.safeParse({
      pin: '1234',
      nickname: 'user_name-123',
    })
    expect(result.success).toBe(true)
  })

  it('falla si el PIN tiene menos de 4 dígitos', () => {
    const result = joinRoomSchema.safeParse({
      pin: '123',
      nickname: 'Usuario',
    })
    expect(result.success).toBe(false)
  })

  it('falla si el PIN tiene más de 10 dígitos', () => {
    const result = joinRoomSchema.safeParse({
      pin: '12345678901',
      nickname: 'Usuario',
    })
    expect(result.success).toBe(false)
  })
})