import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from '../TypingIndicator/TypingIndicator'
import { useChatStore } from '../../store/chatStore'
import { bridgeLoadOlder } from '../../sendMessageBridge'
import { useSmoothStream } from '../../hooks/useSmoothStream'
import type { Message } from '../../types'

export function MessageList() {
  const messages = useChatStore((s) => s.messages)
  const isAgentTyping = useChatStore((s) => s.isAgentTyping)
  const isWaitingForAgent = useChatStore((s) => s.isWaitingForAgent)
  const rawStreaming = useChatStore((s) => s.streaming)
  // Word-by-word reveal instead of dumping whole chunks — keeps the bubble until the remainder is revealed after final
  const streaming = useSmoothStream(rawStreaming)
  const historyHasMore = useChatStore((s) => s.historyHasMore)
  const isLoadingHistory = useChatStore((s) => s.isLoadingHistory)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll chỉ khi có nội dung MỚI ở cuối (message mới / streaming / typing) —
  // prepend history cũ hơn không được kéo xuống đáy
  const last = messages[messages.length - 1]
  const lastKey = last ? last.messageId ?? last.localId : null
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lastKey, streaming?.content, isAgentTyping, isWaitingForAgent])

  const streamingMessage: Message | null = streaming
    ? {
        localId: `stream_${streaming.actionId}`,
        role: 'assistant',
        content: streaming.content,
        type: 'message',
        status: 'sent',
        attachments: [],
        sources: [],
      }
    : null

  return (
    <div className="message-list" role="log" aria-live="polite">
      {historyHasMore && (
        <button
          className="load-older-btn"
          type="button"
          onClick={() => bridgeLoadOlder()}
          disabled={isLoadingHistory}
        >
          {isLoadingHistory ? 'Đang tải…' : 'Xem tin nhắn cũ hơn'}
        </button>
      )}

      {messages.map((msg, i) => {
        // Final message arrived but the streaming bubble is still revealing → hide it to avoid duplicates
        if (streaming && msg.messageId === streaming.actionId) return null
        return <MessageBubble key={msg.messageId ?? msg.localId ?? i} message={msg} />
      })}

      {streamingMessage && <MessageBubble message={streamingMessage} />}

      {(isAgentTyping || isWaitingForAgent) && !streamingMessage && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  )
}
