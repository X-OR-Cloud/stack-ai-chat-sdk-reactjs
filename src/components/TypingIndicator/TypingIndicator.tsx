
export function TypingIndicator() {
  return (
    <div className="message-row assistant" style={{ animation: 'sai-fade-in 200ms ease' }}>
      <div className="typing-indicator message-bubble">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}
