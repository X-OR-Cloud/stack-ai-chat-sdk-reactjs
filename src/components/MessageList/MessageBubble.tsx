import type { Message, AttachmentItem } from '../../types'
import { renderMarkdown } from '../../utils/renderMarkdown'

function formatTime(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
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

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`message-row ${message.role}`}>
      <div className={`message-bubble status-${message.status}`}>
        {isUser
          ? message.content
          : <div className="md-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
        }

        {message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((att, i) => (
              <AttachmentChip key={i} attachment={att} />
            ))}
          </div>
        )}
      </div>

      <div className={`message-meta ${isUser ? '' : ''}`}>
        <span className="message-time">{formatTime(message.timestamp)}</span>
        {isUser && (
          <span className={`message-status-icon ${message.status === 'failed' ? 'failed' : ''}`}>
            {message.status === 'sending' && '···'}
            {message.status === 'sent' && '✓✓'}
            {message.status === 'failed' && '✗'}
          </span>
        )}
      </div>
    </div>
  )
}
