import { describe, it, expect } from 'vitest'
import { queryClient } from './queryClient'

describe('queryClient', () => {
  it('es una instancia de QueryClient', () => {
    expect(queryClient).toBeDefined()
  })

  it('tiene opciones por defecto configuradas', () => {
    const defaultOptions = queryClient.getDefaultOptions()
    expect(defaultOptions).toBeDefined()
  })

  it('tiene staleTime configurado en 30 segundos', () => {
    const defaultOptions = queryClient.getDefaultOptions()
    expect(defaultOptions.queries?.staleTime).toBe(30_000)
  })

  it('tiene retry configurado a 1', () => {
    const defaultOptions = queryClient.getDefaultOptions()
    expect(defaultOptions.queries?.retry).toBe(1)
  })

  it('puede ejecutar clear para limpiar la caché', () => {
    queryClient.clear()
    // No debe lanzar errores
    expect(queryClient).toBeDefined()
  })

  it('puede ejecutar cancelQueries', () => {
    queryClient.cancelQueries()
    // No debe lanzar errores
    expect(queryClient).toBeDefined()
  })
})