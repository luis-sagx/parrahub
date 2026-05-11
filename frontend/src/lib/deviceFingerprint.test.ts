import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDeviceFingerprint } from './deviceFingerprint'

describe('getDeviceFingerprint', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('genera un hash estable con datos del dispositivo', () => {
    const first = getDeviceFingerprint()
    const second = getDeviceFingerprint()

    expect(first).toMatch(/^[a-f0-9]{8}$/)
    expect(second).toBe(first)
  })

  it('produce el mismo hash independientemente de hardwareConcurrency', () => {
    const first = getDeviceFingerprint()

    Object.defineProperty(window.navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 2,
    })

    const second = getDeviceFingerprint()
    expect(first).toBe(second)
  })

  it('produce el mismo hash independientemente de timezone (timezone falsificado por Firefox RFP)', () => {
    // El fingerprint ya no incluye timezone, así que cambiar Intl no debe afectarlo.
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Atlantic/Reykjavik' }),
    } as Intl.DateTimeFormat)

    const first = getDeviceFingerprint()

    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'America/Guayaquil' }),
    } as Intl.DateTimeFormat)

    const second = getDeviceFingerprint()
    expect(first).toBe(second)
  })

  it('produce hashes diferentes para distintos anchos de pantalla', () => {
    const originalWidth = window.screen.width

    Object.defineProperty(window.screen, 'width', { configurable: true, value: 1920 })
    const desktop = getDeviceFingerprint()

    Object.defineProperty(window.screen, 'width', { configurable: true, value: 390 })
    const mobile = getDeviceFingerprint()

    Object.defineProperty(window.screen, 'width', { configurable: true, value: originalWidth })

    expect(desktop).not.toBe(mobile)
  })

  it('produce hashes diferentes para dispositivos con y sin pantalla táctil', () => {
    Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: 0 })
    const nonTouch = getDeviceFingerprint()

    Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    const touch = getDeviceFingerprint()

    expect(nonTouch).not.toBe(touch)
  })
})
