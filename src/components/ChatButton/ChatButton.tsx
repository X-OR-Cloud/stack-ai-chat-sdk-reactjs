import { useChatStore } from '../../store/chatStore'

interface ChatButtonProps {
  position: 'bottom-right' | 'bottom-left'
  unreadCount?: number
}

export function ChatButton({ position, unreadCount = 0 }: ChatButtonProps) {
  const isOpen = useChatStore((s) => s.isOpen)
  const open = useChatStore((s) => s.open)
  const close = useChatStore((s) => s.close)
  const config = useChatStore((s) => s.config)

  function handleClick() {
    if (isOpen) {
      close()
      config?.onClose?.()
    } else {
      open()
      config?.onOpen?.()
    }
  }

  return (
    <div className={`chat-button-wrapper ${position}`}>
      <button
        className={`chat-button ${isOpen ? 'is-open' : ''}`}
        onClick={handleClick}
        aria-label={isOpen ? 'Đóng chat' : 'Mở chat'}
        title={isOpen ? 'Đóng chat' : 'Mở chat'}
      >
        {/* Chat icon */}
        <svg className="icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>

        {/* Close icon */}
        <svg className="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>

        {!isOpen && unreadCount > 0 && (
          <span className="chat-button-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
