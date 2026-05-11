const hashFingerprint = (value: string): string => {
  // Hash liviano para no enviar datos crudos del navegador al backend.
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function getOSFamily(): string {
  const ua = navigator.userAgent
  // Android debe ir antes que Linux porque Android UA contiene "Linux".
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad/i.test(ua)) return 'iOS'
  if (/Mac OS X/i.test(ua)) return 'Mac'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'unknown'
}

export function getDeviceFingerprint(): string {
  // Señales elegidas por ser hardware puro, resistentes a privacy.resistFingerprinting de Firefox:
  //
  //   osFamily   – todos los browsers reportan el mismo SO en el UA (Chrome/Firefox/Opera en Linux → "Linux").
  //   screen.width – ancho físico del monitor; Firefox RFP no lo altera (solo falsifica height).
  //   colorDepth – profundidad de color del panel; hardware, igual en todos los browsers.
  //   maxTouchPoints – capacidad táctil del hardware (0 = no táctil); no falsificado por RFP.
  //
  // Señales EXCLUIDAS porque Firefox privacy.resistFingerprinting las falsifica:
  //   timezone        → cambia a "Atlantic/Reykjavik" aunque el SO esté en otra zona.
  //   screen.height   → recorta al alto de la ventana (~526 px) en vez de la pantalla real.
  //   hardwareConcurrency → reporta siempre 2 en vez de los núcleos reales.
  const osFamily = getOSFamily()
  const screenWidth = window.screen?.width ?? 0
  const colorDepth = window.screen?.colorDepth ?? 24
  const touch = navigator.maxTouchPoints ?? 0

  return hashFingerprint([osFamily, screenWidth, colorDepth, touch].join('|'))
}
