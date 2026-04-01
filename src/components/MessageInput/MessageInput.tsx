import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react'
import type { AttachmentsConfig, AttachmentItem } from '../../types'
import { filesToBase64, formatFileSize } from '../../utils/fileToBase64'
import { useChatStore } from '../../store/chatStore'

const REFERENCE_MAX_LEN = 80

interface MessageInputProps {
  onSend: (content: string, attachments: AttachmentItem[]) => void
  attachmentsConfig?: AttachmentsConfig
  disabled?: boolean
}

export function MessageInput({
  onSend,
  attachmentsConfig,
  disabled = false,
}: MessageInputProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reference = useChatStore((s) => s.reference)
  const setReference = useChatStore((s) => s.setReference)

  const attachEnabled = attachmentsConfig?.enabled ?? false
  const maxSize = (attachmentsConfig?.maxSize ?? 5) * 1024 * 1024
  const maxCount = attachmentsConfig?.maxCount ?? 5
  const accept = attachmentsConfig?.accept?.join(',') ?? '*/*'

  const shortRef = reference
    ? reference.length > REFERENCE_MAX_LEN
      ? reference.slice(0, REFERENCE_MAX_LEN) + '…'
      : reference
    : null

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  function handleTextChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    autoResize()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    if (disabled || isUploading) return

    // Prepend reference as quote if present
    const content = reference
      ? `> ${reference}\n\n${trimmed}`
      : trimmed

    onSend(content, attachments)
    setText('')
    setAttachments([])
    setReference(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''
    setUploadError(null)

    if (attachments.length + files.length > maxCount) {
      setUploadError(`Tối đa ${maxCount} file mỗi tin nhắn`)
      return
    }

    const oversized = files.find((f) => f.size > maxSize)
    if (oversized) {
      setUploadError(`File "${oversized.name}" vượt quá ${attachmentsConfig?.maxSize ?? 5}MB`)
      return
    }

    setIsUploading(true)
    try {
      const converted = await filesToBase64(files)
      setAttachments((prev) => [...prev, ...converted])
    } catch {
      setUploadError('Không thể đọc file, vui lòng thử lại')
    } finally {
      setIsUploading(false)
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled && !isUploading

  return (
    <div className="message-input-area">
      {/* Reference chip */}
      {shortRef && (
        <div className="reference-chip">
          <svg className="reference-chip__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 3H3a1 1 0 0 0-1 1v3c0 3.3 2.7 5 4 5" />
            <path d="M13 3h-3a1 1 0 0 0-1 1v3c0 3.3 2.7 5 4 5" />
          </svg>
          <span className="reference-chip__text">{shortRef}</span>
          <button
            className="reference-chip__remove"
            onClick={() => setReference(null)}
            title="Bỏ tham chiếu"
            type="button"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="attachment-preview-bar">
          {attachments.map((att, i) => (
            <div key={i} className="attachment-preview-item">
              {att.type.startsWith('image/') ? (
                <img
                  className="attachment-preview-image"
                  src={`data:${att.type};base64,${att.data}`}
                  alt={att.name}
                />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
              <span className="attachment-preview-item__name">{att.name}</span>
              <span className="attachment-preview-item__size">{formatFileSize(att.size)}</span>
              <button
                className="attachment-preview-item__remove"
                onClick={() => removeAttachment(i)}
                title="Xóa file"
                type="button"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <span style={{ fontSize: '12px', color: 'var(--sai-error)' }}>{uploadError}</span>
      )}

      <div className="message-input-row">
        {attachEnabled && (
          <>
            <input
              ref={fileInputRef}
              className="file-input-hidden"
              type="file"
              multiple
              accept={accept}
              onChange={handleFileChange}
            />
            <button
              className="input-action-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || attachments.length >= maxCount}
              title="Đính kèm file"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          </>
        )}

        <textarea
          ref={textareaRef}
          className="message-input-field"
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn..."
          disabled={disabled}
        />

        <button
          className="input-action-btn send"
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          title="Gửi tin nhắn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
