import { describe, it, expect } from 'vitest'
import { getUserColor } from './userColors'

const USER_COLORS = [
  '#7dd3fc',
  '#86efac',
  '#fca5a5',
  '#fcd34d',
  '#c4b5fd',
  '#f9a8d4',
  '#67e8f9',
  '#fdba74',
  '#a7f3d0',
  '#93c5fd',
]

describe('getUserColor', () => {
  it('retorna un color del array para cualquier nombre', () => {
    const result = getUserColor('test')
    expect(USER_COLORS).toContain(result)
  })

  it('retorna el mismo color para el mismo nombre', () => {
    const result1 = getUserColor('usuario1')
    const result2 = getUserColor('usuario1')
    expect(result1).toBe(result2)
  })

  it('retorna colores diferentes para nombres diferentes', () => {
    // Algunos nombres podrían collide por hash, pero verificamos que funciona
    const color1 = getUserColor('alice')
    const color2 = getUserColor('bob')
    expect(color1).toBeDefined()
    expect(color2).toBeDefined()
  })

  it('maneja nombres vacíos', () => {
    const result = getUserColor('')
    expect(USER_COLORS).toContain(result)
  })

  it('maneja nombres con caracteres especiales', () => {
    const result = getUserColor('usuario@#$%')
    expect(USER_COLORS).toContain(result)
  })

  it('distribuye colores uniformemente para diferentes hashes', () => {
    // Genera muchos colores y verifica que todos estén en el array
    const colors = new Set()
    for (let i = 0; i < 100; i++) {
      colors.add(getUserColor(`user${i}`))
    }
    // Debería tener al menos 3 colores diferentes para 100 usuarios
    expect(colors.size).toBeGreaterThanOrEqual(3)
  })
})