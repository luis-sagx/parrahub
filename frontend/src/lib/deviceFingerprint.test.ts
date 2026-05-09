import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDeviceFingerprint } from './deviceFingerprint'

const originalNavigatorDescriptors = {
  languages: Object.getOwnPropertyDescriptor(window.navigator, 'languages'),
  language: Object.getOwnPropertyDescriptor(window.navigator, 'language'),
  platform: Object.getOwnPropertyDescriptor(window.navigator, 'platform'),
  hardwareConcurrency: Object.getOwnPropertyDescriptor(
    window.navigator,
    'hardwareConcurrency',
  ),
}

const setNavigatorValue = (key: string, value: unknown) => {
  Object.defineProperty(window.navigator, key, {
    configurable: true,
    value,
  })
}

describe('getDeviceFingerprint', () => {
  afterEach(() => {
    vi.restoreAllMocks()

    for (const [key, descriptor] of Object.entries(originalNavigatorDescriptors)) {
      if (descriptor) {
        Object.defineProperty(window.navigator, key, descriptor)
      }
    }
  })

  it('genera un hash estable con datos del dispositivo', () => {
    const first = getDeviceFingerprint()
    const second = getDeviceFingerprint()

    expect(first).toMatch(/^[a-f0-9]{8}$/)
    expect(second).toBe(first)
  })

  it('usa fallbacks cuando faltan senales del navegador', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: '' }),
    } as Intl.DateTimeFormat)

    setNavigatorValue('languages', undefined)
    setNavigatorValue('language', '')
    setNavigatorValue('platform', '')
    setNavigatorValue('hardwareConcurrency', 0)

    expect(getDeviceFingerprint()).toMatch(/^[a-f0-9]{8}$/)
  })
})
