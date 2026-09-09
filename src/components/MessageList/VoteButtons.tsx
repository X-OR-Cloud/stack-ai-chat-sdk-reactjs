import { useChatStore } from '../../store/chatStore'
import { isVotableId } from '../../hooks/useVote'
import { bridgeVote } from '../../sendMessageBridge'
import type { Message, VoteType } from '../../types'

interface VoteButtonsProps {
  message: Message
}

export function VoteButtons({ message }: VoteButtonsProps) {
  const enabled = useChatStore((s) => !!s.config?.voting?.enabled)
  const votingUnavailable = useChatStore((s) => s.votingUnavailable)

  // Only messages carrying a real server `_id` can be voted on: this rules out the greeting
  // (localId only), the streaming bubble (not finalized yet) and anything that is not an
  // ObjectId — the server returns 500 on a malformed id.
  if (!enabled || votingUnavailable || !isVotableId(message.messageId)) return null

  const current = message.userReaction ?? null
  const pending = !!message.votePending

  // One vote() lives in ChatWindow and is registered into the bridge; every bubble
  // shares it instead of building its own callbacks and config subscription.
  function handleClick(type: VoteType) {
    if (pending || !message.messageId) return
    bridgeVote(message.messageId, type)
  }

  return (
    <>
      <button
        type="button"
        className={`msg-action-btn vote-btn${current === 'like' ? ' is-active' : ''}`}
        onClick={() => handleClick('like')}
        disabled={pending}
        aria-pressed={current === 'like'}
        aria-label={current === 'like' ? 'Bỏ đánh giá hữu ích' : 'Câu trả lời hữu ích'}
        title={current === 'like' ? 'Bỏ đánh giá hữu ích' : 'Câu trả lời hữu ích'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
          <path d="M7 10l4.2-7.1a1.6 1.6 0 0 1 2.9 1.1L13.5 9h5.1a2 2 0 0 1 1.95 2.45l-1.6 7A2 2 0 0 1 17 20H7" />
        </svg>
      </button>

      <button
        type="button"
        className={`msg-action-btn vote-btn${current === 'dislike' ? ' is-active is-dislike' : ''}`}
        onClick={() => handleClick('dislike')}
        disabled={pending}
        aria-pressed={current === 'dislike'}
        aria-label={current === 'dislike' ? 'Bỏ đánh giá chưa tốt' : 'Câu trả lời chưa tốt'}
        title={current === 'dislike' ? 'Bỏ đánh giá chưa tốt' : 'Câu trả lời chưa tốt'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1z" />
          <path d="M17 14l-4.2 7.1a1.6 1.6 0 0 1-2.9-1.1l.6-5h-5.1a2 2 0 0 1-1.95-2.45l1.6-7A2 2 0 0 1 7 4h10" />
        </svg>
      </button>
    </>
  )
}
