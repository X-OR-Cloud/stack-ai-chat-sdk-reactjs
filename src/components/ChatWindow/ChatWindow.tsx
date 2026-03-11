import { useChatStore } from '../../store/chatStore'
import { MessageList } from '../MessageList/MessageList'
import { MessageInput } from '../MessageInput/MessageInput'
import { PreChatForm } from '../PreChatForm/PreChatForm'
import { AgentStatus } from '../AgentStatus/AgentStatus'
import { useSocket } from '../../hooks/useSocket'
import { useSession } from '../../hooks/useSession'
import type { AttachmentItem } from '../../types'

interface ChatWindowProps {
  position: 'bottom-right' | 'bottom-left'
}

export function ChatWindow({ position }: ChatWindowProps) {
  const config = useChatStore((s) => s.config)
  const phase = useChatStore((s) => s.phase)
  const setPhase = useChatStore((s) => s.setPhase)
  const setUserFields = useChatStore((s) => s.setUserFields)
  const close = useChatStore((s) => s.close)

  const { connect, sendMessage } = useSocket()
  const session = useSession(config?.session)

  function handleFormSubmit(values: Record<string, string>) {
    setUserFields(values)
    session.save(values)
    config?.onFormSubmit?.(values)
    connect()
  }

  function handleSend(content: string, attachments: AttachmentItem[]) {
    sendMessage({ role: 'user', content, attachments })
  }

  function handleClose() {
    close()
    config?.onClose?.()
  }

  if (!config) return null

  // Resolve initial values from session
  const savedFields = session.load()

  return (
    <div className={`chat-window ${position}`} role="dialog" aria-modal="true" aria-label={config.title ?? 'Chat'}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header__left">
          <span className="chat-header__title">{config.title ?? 'Hỗ trợ khách hàng'}</span>
          {phase === 'chat' ? (
            <AgentStatus />
          ) : config.subtitle ? (
            <span className="chat-header__subtitle">{config.subtitle}</span>
          ) : null}
        </div>
        <div className="chat-header__right">
          <button
            className="chat-header__btn"
            onClick={handleClose}
            title="Đóng"
            aria-label="Đóng chat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {phase === 'form' && (
        <PreChatForm
          fields={config.fields ?? []}
          title="Bắt đầu trò chuyện"
          subtitle={config.subtitle ?? 'Vui lòng điền thông tin để tiếp tục'}
          initialValues={savedFields ?? {}}
          onSubmit={handleFormSubmit}
        />
      )}

      {phase === 'connecting' && (
        <div className="chat-connecting">
          <div className="chat-connecting__spinner" />
          <span>Đang kết nối...</span>
        </div>
      )}

      {phase === 'chat' && (
        <>
          <MessageList />
          <MessageInput
            onSend={handleSend}
            attachmentsConfig={config.attachments}
          />
        </>
      )}
    </div>
  )
}
