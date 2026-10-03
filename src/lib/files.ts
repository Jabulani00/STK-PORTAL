const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'ppt',
  'pptx',
  'jpg',
  'jpeg',
  'png',
  'zip',
])

const MIME_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  csv: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  zip: ['application/zip', 'application/x-zip-compressed'],
}

export interface UploadMeta {
  name: string
  type: string
  size: number
}

export function sanitiseFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? 'file'
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
  return cleaned.slice(0, 120) || 'file'
}

export function validateUpload(file: UploadMeta, maxMb: number) {
  const safeName = sanitiseFileName(file.name)
  const extension = safeName.includes('.') ? (safeName.split('.').pop() ?? '').toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return 'This file type is not allowed. Upload a PDF, Office document, image, CSV, or ZIP file.'
  }
  if (file.size <= 0) return 'This file is empty.'
  if (file.size > maxMb * 1024 * 1024) return `This file is larger than ${maxMb} MB.`
  const allowed = MIME_TYPES[extension] ?? []
  if (file.type && !allowed.includes(file.type)) {
    return 'The file content does not match its extension.'
  }
  return null
}
