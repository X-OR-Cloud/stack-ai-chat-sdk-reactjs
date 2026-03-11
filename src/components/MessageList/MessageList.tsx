import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from '../TypingIndicator/TypingIndicator'
import { useChatStore } from '../../store/chatStore'

export function MessageList() {
  const messages = useChatStore((s) => s.messages)
  const isAgentTyping = useChatStore((s) => s.isAgentTyping)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages or typing
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAgentTyping])

  return (
    <div className="message-list" role="log" aria-live="polite">
      {messages.map((msg, i) => (
        <MessageBubble key={msg.messageId ?? msg.localId ?? i} message={msg} />
      ))}

      {isAgentTyping && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  )
}
