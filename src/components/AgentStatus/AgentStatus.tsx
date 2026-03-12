import { useState } from 'react'
import { usePresence } from '../../hooks/usePresence'
import { useChatStore } from '../../store/chatStore'

export function AgentStatus() {
  const { isOnline } = usePresence()
  const conversationId = useChatStore((s) => s.conversationId)
  const [copied, setCopied] = useState(false)

  const shortId = conversationId ? conversationId.slice(-8) : null

  function handleCopy() {
    if (!conversationId) return
    navigator.clipboard.writeText(conversationId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="agent-status">
      <span className={`agent-status__dot ${isOnline ? 'online' : 'offline'}`} />
      <span className="agent-status__label">
        {isOnline ? 'Đang trực tuyến' : 'Ngoại tuyến'}
      </span>
      {shortId && (
        <>
          <span className="agent-status__bullet">·</span>
          <span className="agent-status__conv-id">{shortId}</span>
          <button
            className={`agent-status__copy ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={copied ? 'Đã sao chép' : 'Sao chép conversation ID'}
            aria-label="Sao chép conversation ID"
          >
            {copied ? (
              // checkmark
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2,8 6,12 14,4" />
              </svg>
            ) : (
              // copy icon
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="5" width="8" height="9" rx="1.5" />
                <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H5" />
              </svg>
            )}
          </button>
        </>
      )}
    </div>
  )
}
