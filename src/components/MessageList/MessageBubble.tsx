import type { Message, AttachmentItem, ReactionFeedback } from '../../types'
import { renderMarkdown } from '../../utils/renderMarkdown'
import { SourcesPanel } from './SourcesPanel'
import { CollapsibleBlock } from './CollapsibleBlock'
import { NoticeBanner } from './NoticeBanner'
import { useEffect, useState } from 'react'
import { NewsCards } from './NewsCards'
import { VoteButtons } from './VoteButtons'
import { DislikeReasonForm } from './DislikeReasonForm'
import { bridgeVote } from '../../sendMessageBridge'
import { CopyButton } from './CopyButton'
import { useChatStore } from '../../store/chatStore'

function formatTime(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function AttachmentChip({ attachment }: { attachment: AttachmentItem }) {
  const isImage = attachment.type.startsWith('image/')
  if (isImage) {
    return (
      <img
        className="message-attachment-image"
        src={`data:${attachment.type};base64,${attachment.data}`}
        alt={attachment.name}
      />
    )
  }
  return (
    <div className="message-attachment-chip">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span>{attachment.name}</span>
    </div>
  )
}

const COLLAPSIBLE_META: Record<string, { icon: string; label: string }> = {
  thinking:    { icon: '💭', label: 'Thinking' },
  tool_use:    { icon: '🔧', label: 'Tool Call' },
  tool_result: { icon: '📋', label: 'Tool Result' },
}

/** Timestamp + action buttons under an agent answer, plus the dislike feedback form */
function AssistantFooter({ message }: { message: Message }) {
  // 'new': the dislike is not cast yet — "Gửi" sends it together with the feedback.
  // 'edit': the dislike exists — "Gửi" only updates its feedback (same type + feedback).
  const [formMode, setFormMode] = useState<'new' | 'edit' | null>(null)
  const disliked = message.userReaction === 'dislike'
  const pending = !!message.votePending

  // Editing feedback only makes sense while the dislike exists: close once it is removed
  useEffect(() => {
    if (formMode === 'edit' && !pending && !disliked) setFormMode(null)
  }, [formMode, pending, disliked])

  function handleSubmit(feedback: ReactionFeedback) {
    setFormMode(null)
    if (message.messageId) bridgeVote(message.messageId, 'dislike', feedback)
  }

  return (
    <>
      <div className="message-meta">
        <span className="message-time">{formatTime(message.timestamp)}</span>
        <div className="message-actions">
          <CopyButton message={message} />
          <VoteButtons
            message={message}
            reasonOpen={formMode !== null}
            onDislikeReasonRequest={() => setFormMode(disliked ? 'edit' : 'new')}
          />
        </div>
      </div>
      {formMode && (
        <DislikeReasonForm
          initial={formMode === 'edit' ? message.userFeedback : null}
          pending={pending}
          onSubmit={handleSubmit}
          onCancel={() => setFormMode(null)}
        />
      )}
    </>
  )
}

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const formatLinkLabel = useChatStore((s) => s.config?.formatLinkLabel)
  const referenceDisplay = useChatStore((s) => {
    const cfg = s.config
    if (cfg?.referenceDisplay) return cfg.referenceDisplay
    // Backward-compat: map showReferences → referenceDisplay
    return cfg?.showReferences === false ? 'none' : 'full'
  })

  // divider — separates history from new session
  if (message.type === 'divider') {
    return (
      <div className="session-divider" role="separator">
        <span className="session-divider__label">Cuộc trò chuyện mới</span>
      </div>
    )
  }

  // news cards — articles injected after greeting
  if (message.type === 'news') {
    return (
      <div className="message-row assistant">
        <NewsCards message={message} />
      </div>
    )
  }

  // notice / system / error → inline banner, no timestamp
  if (message.type === 'notice' || message.type === 'system' || message.type === 'error') {
    // Guardrail rejection notice — centered muted text (SDK-injected)
    if (message.metadata?.guardrailNotice) {
      return (
        <div className="guardrail-notice" role="alert">
          {message.content}
        </div>
      )
    }
    return (
      <div className="message-row assistant">
        <NoticeBanner message={message} />
      </div>
    )
  }

  // thinking / tool_use / tool_result → collapsible pill
  if (message.type === 'thinking' || message.type === 'tool_use' || message.type === 'tool_result') {
    const meta = COLLAPSIBLE_META[message.type]
    return (
      <div className="message-row assistant">
        <CollapsibleBlock
          icon={meta.icon}
          label={meta.label}
          content={message.content}
        />
      </div>
    )
  }

  // user message → bubble
  if (isUser) {
    return (
      <div className="message-row user" >
        <div className={`message-bubble status-${message.status}${message.metadata?.guardrailBlocked ? ' guardrail-blocked' : ''}`}>
          {message.content}
          {message.attachments.length > 0 && (
            <div className="message-attachments">
              {message.attachments.map((att, i) => <AttachmentChip key={i} attachment={att} />)}
            </div>
          )}
        </div>
        <div className="message-meta">
          <span className="message-time">{formatTime(message.timestamp)}</span>
          <span className={`message-status-icon${message.status === 'failed' ? ' failed' : ''}`}>
            {message.status === 'sending' && '···'}
            {message.status === 'sent' && '✓✓'}
            {message.status === 'failed' && '✗'}
          </span>
        </div>
      </div>
    )
  }

  // assistant message → full-width, no bubble
  return (
    <div className="message-row assistant">
      <div className="agent-content">
        <div className="md-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content, { formatLinkLabel }) }} />
        {message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((att, i) => <AttachmentChip key={i} attachment={att} />)}
          </div>
        )}
      </div>

      {referenceDisplay !== 'none' && message.sources.length > 0 && (
        <SourcesPanel sources={message.sources} mode={referenceDisplay === 'url' ? 'url' : 'full'} />
      )}

      <AssistantFooter message={message} />
    </div>
  )
}
