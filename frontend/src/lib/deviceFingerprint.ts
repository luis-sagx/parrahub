const hashFingerprint = (value: string): string => {
  // Hash liviano para no enviar datos crudos del navegador al backend.
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function getDeviceFingerprint(): string {
  // Combina senales estables del navegador/dispositivo para reforzar la sesion unica.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
  const languages = navigator.languages?.join(',') || navigator.language || 'unknown'
  const platform = navigator.platform || 'unknown'
  const hardwareConcurrency = String(navigator.hardwareConcurrency || 'unknown')
  const deviceMemory = String(
    'deviceMemory' in navigator
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : 'unknown',
  )

  const screenData = [
    window.screen?.width,
    window.screen?.height,
    window.screen?.availWidth,
    window.screen?.availHeight,
    window.screen?.colorDepth,
    window.devicePixelRatio,
  ].join('x')

  return hashFingerprint(
    [
      timezone,
      languages,
      platform,
      hardwareConcurrency,
      deviceMemory,
      screenData,
    ].join('|'),
  )
}
