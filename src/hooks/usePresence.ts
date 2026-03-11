import { useChatStore } from '../store/chatStore'

export function usePresence() {
  const presence = useChatStore((s) => s.presence)
  const isOnline = presence.status === 'online'

  return { presence, isOnline }
}
