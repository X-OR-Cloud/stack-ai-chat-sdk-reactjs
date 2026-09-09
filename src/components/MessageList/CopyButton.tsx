import { useEffect, useRef, useState } from 'react'
import type { Message } from '../../types'

const COPIED_FEEDBACK_MS = 1500

/**
 * Copies `text` to the clipboard. The async Clipboard API needs a secure context
 * (https / localhost) and a user gesture; plain-http embeds fall back to the legacy
 * `execCommand('copy')` path so the button still works there.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    // The textarea goes into the light DOM on purpose: execCommand selects from the
    // document, and a node inside the shadow root is not reliably selectable.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.style.pointerEvents = 'none'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

interface CopyButtonProps {
  message: Message
}

export function CopyButton({ message }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  // A streaming bubble is still being written — copying half an answer is not useful.
  if (!message.content || message.localId?.startsWith('stream_')) return null

  async function handleClick() {
    // Raw markdown: it is exactly what the agent wrote, and pastes cleanly into editors
    // that understand it. Rendered HTML would need a separate plain-text conversion.
    const ok = await copyToClipboard(message.content)
    if (!ok) return
    setCopied(true)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  return (
    <button
      type="button"
      className={`msg-action-btn copy-btn${copied ? ' is-active' : ''}`}
      onClick={handleClick}
      aria-label={copied ? 'Đã sao chép' : 'Sao chép câu trả lời'}
      title={copied ? 'Đã sao chép' : 'Sao chép câu trả lời'}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 12 9 17 20 6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  )
}
