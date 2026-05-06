import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn (tailwind-merge)', () => {
  it('concatena clases simples', () => {
    const result = cn('bg-red-500', 'text-white')
    expect(result).toBe('bg-red-500 text-white')
  })

  it('resuelve conflictos de Tailwind usando el último valor', () => {
    const result = cn('bg-red-500', 'bg-blue-500')
    expect(result).toBe('bg-blue-500')
  })

  it('maneja valores condicionales', () => {
    const result = cn('flex', false && 'hidden', 'text-white')
    expect(result).toBe('flex text-white')
  })

  it('maneja arrays de clases', () => {
    const result = cn(['flex', 'items-center'])
    expect(result).toBe('flex items-center')
  })

  it('maneja clases vacías', () => {
    const result = cn('flex', '', 'text-white')
    expect(result).toBe('flex text-white')
  })

  it('resuelve conflictos con valores booleanos', () => {
    const result = cn('p-4', true && 'p-6')
    expect(result).toBe('p-6')
  })
})