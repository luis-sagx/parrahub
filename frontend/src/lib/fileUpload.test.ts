import { describe, expect, it } from 'vitest'
import {
  getAllowedMimeTypes,
  MAX_FILES_PER_UPLOAD_BATCH,
  validateFileForUpload,
} from './fileUpload'

describe('file upload helpers', () => {
  it('expone el limite de archivos por tanda', () => {
    expect(MAX_FILES_PER_UPLOAD_BATCH).toBe(5)
  })

  it('rechaza tipos de archivo no permitidos', () => {
    const file = new File(['demo'], 'script.exe', {
      type: 'application/x-msdownload',
    })

    expect(validateFileForUpload(file, 5)).toBe('Tipo de archivo no permitido')
  })

  it('rechaza archivos que exceden el peso configurado', () => {
    const file = new File(['1234'], 'video.mp4', {
      type: 'image/png',
    })

    Object.defineProperty(file, 'size', {
      configurable: true,
      value: 6 * 1024 * 1024,
    })

    expect(validateFileForUpload(file, 5)).toBe(
      'El archivo "video.mp4" excede el limite de 5MB y no se puede enviar',
    )
  })

  it('acepta archivos validos', () => {
    const file = new File(['hola'], 'nota.txt', {
      type: 'text/plain',
    })

    expect(validateFileForUpload(file, 5)).toBeNull()
    expect(getAllowedMimeTypes()).toContain('text/plain')
  })
})
