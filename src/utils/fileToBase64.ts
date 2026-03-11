import type { AttachmentItem } from '../types'

export function fileToBase64(file: File): Promise<AttachmentItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // result is "data:<mime>;base64,<data>" — strip the prefix
      const base64 = result.split(',')[1]
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64,
      })
    }
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export async function filesToBase64(files: File[]): Promise<AttachmentItem[]> {
  return Promise.all(files.map(fileToBase64))
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
