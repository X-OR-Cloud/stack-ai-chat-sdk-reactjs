import { useEffect } from 'react'
import { useChatStore } from './store/chatStore'
import { ChatButton } from './components/ChatButton/ChatButton'
import { ChatWindow } from './components/ChatWindow/ChatWindow'
import { useSession } from './hooks/useSession'
import type { SDKConfig } from './types'

interface ChatWidgetProps {
  config: SDKConfig
}

export function ChatWidget({ config }: ChatWidgetProps) {
  const setConfig = useChatStore((s) => s.setConfig)
  const setPhase = useChatStore((s) => s.setPhase)
  const isOpen = useChatStore((s) => s.isOpen)

  const session = useSession(config.session)

  useEffect(() => {
    setConfig(config)

    // If session has saved data and persist is on, skip form
    const savedFields = session.load()
    if (savedFields && config.session?.persist) {
      useChatStore.getState().setUserFields(savedFields)
      // Phase will jump to form then connect immediately handled in ChatWindow
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update config if it changes (e.g. updateConfig call)
  useEffect(() => {
    setConfig(config)
  }, [config, setConfig])

  const position = config.position ?? 'bottom-right'

  return (
    <>
      <ChatButton position={position} />
      {isOpen && <ChatWindow position={position} />}
    </>
  )
}
