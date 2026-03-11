import { usePresence } from '../../hooks/usePresence'

export function AgentStatus() {
  const { isOnline } = usePresence()

  return (
    <div className="agent-status">
      <span className={`agent-status__dot ${isOnline ? 'online' : 'offline'}`} />
      <span className="agent-status__label">
        {isOnline ? 'Đang trực tuyến' : 'Ngoại tuyến'}
      </span>
    </div>
  )
}
