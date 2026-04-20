import type { Message } from '../../types'

const NOTICE_META: Record<string, { icon: string }> = {
  notice: { icon: 'ℹ️' },
  system: { icon: '⚙️' },
}

interface NoticeBannerProps {
  message: Message
}

export function NoticeBanner({ message }: NoticeBannerProps) {
  const meta = NOTICE_META[message.type] ?? { icon: 'ℹ️' }

  return (
    <div className="notice-banner">
      <span className="notice-banner__icon">{meta.icon}</span>
      <span className="notice-banner__content">{message.content}</span>
    </div>
  )
}
