import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'

export function AgentStatus() {
  const conversationId = useChatStore((s) => s.conversationId)
  const [copied, setCopied] = useState(false)

  const shortId = conversationId ? conversationId.slice(-8) : null

  if (!shortId) return null

  function handleCopy() {
    if (!conversationId) return
    navigator.clipboard.writeText(conversationId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="agent-status">
      {/* Session icon */}
      <svg className="agent-status__session-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="12" height="10" rx="2" />
        <path d="M5 7h6M5 10h3" />
      </svg>
      <span className="agent-status__conv-id">{shortId}</span>
      <button
        className={`agent-status__copy ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        title={copied ? 'Đã sao chép' : 'Sao chép conversation ID'}
        aria-label="Sao chép conversation ID"
      >
        {copied ? (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,8 6,12 14,4" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="5" width="8" height="9" rx="1.5" />
            <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H5" />
          </svg>
        )}
      </button>
    </div>
  )
}
