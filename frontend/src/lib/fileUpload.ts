const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const

export const MAX_FILES_PER_UPLOAD_BATCH = 5

export const getAllowedMimeTypes = () => ALLOWED_MIME_TYPES

export const validateFileForUpload = (
  file: File,
  maxFileSizeMb: number,
): string | null => {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return 'Tipo de archivo no permitido'
  }

  const maxBytes = maxFileSizeMb * 1024 * 1024
  if (file.size > maxBytes) {
    return `El archivo "${file.name}" excede el limite de ${maxFileSizeMb}MB y no se puede enviar`
  }

  return null
}
