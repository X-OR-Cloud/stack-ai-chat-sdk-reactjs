import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useChatStore } from '../store/chatStore'
import { registerSendMessage, unregisterSendMessage } from '../sendMessageBridge'
import type {
  Message,
  MessageSource,
  PresenceUpdatePayload,
  MessageSentPayload,
  SendMessagePayload,
} from '../types'

let typingTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * NestJS Socket.IO gateway dùng namespace /ws/chat
 * wsUrl ví dụ: "wss://skt.x-or.cloud/ws/chat"
 * → connect tới origin "wss://skt.x-or.cloud" với namespace "/ws/chat"
 */
function parseWsUrl(wsUrl: string): { origin: string; namespace: string } {
  try {
    const u = new URL(wsUrl)
    const namespace = u.pathname && u.pathname !== '/' ? u.pathname : '/'
    const origin = `${u.protocol}//${u.host}`
    return { origin, namespace }
  } catch {
    return { origin: wsUrl, namespace: '/' }
  }
}

/** Server gửi shape: { _id, role, content, type, createdAt, sources, attachments, ... } */
interface ServerMessage {
  _id?: string
  messageId?: string
  conversationId?: string
  role: 'user' | 'assistant'
  content?: string
  type?: string
  createdAt?: string
  timestamp?: string
  skipAgent?: boolean
  attachments?: Message['attachments']
  sources?: MessageSource[]
}

function isHiddenByPattern(content: string | undefined, patterns: RegExp[]): boolean {
  if (!content || !patterns.length) return false
  return patterns.some((re) => re.test(content))
}

function mapServerMessage(payload: ServerMessage): Message {
  return {
    messageId: payload._id ?? payload.messageId,
    conversationId: payload.conversationId,
    role: payload.role,
    content: payload.content ?? '',
    type: (payload.type as Message['type']) || 'message',
    status: 'sent',
    attachments: payload.attachments ?? [],
    sources: payload.sources ?? [],
    timestamp: payload.createdAt ?? payload.timestamp,
  }
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const isConnectingRef = useRef(false)
  const isIntentionalDisconnectRef = useRef(false)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const greetingInjectedRef = useRef(false)
  const config = useChatStore((s) => s.config)
  const setPhase = useChatStore((s) => s.setPhase)
  const addMessage = useChatStore((s) => s.addMessage)
  const prependMessages = useChatStore((s) => s.prependMessages)
  const confirmMessage = useChatStore((s) => s.confirmMessage)
  const failMessage = useChatStore((s) => s.failMessage)
  const setAgentTyping = useChatStore((s) => s.setAgentTyping)
  const setConversationId = useChatStore((s) => s.setConversationId)

  const injectGreeting = useCallback(() => {
    const greeting = config?.greeting
    if (!greeting || greetingInjectedRef.current) return
    greetingInjectedRef.current = true
    addMessage({
      localId: `greeting_${Date.now()}`,
      role: 'assistant',
      content: greeting,
      type: 'message',
      status: 'sent',
      attachments: [],
      sources: [],
      timestamp: new Date().toISOString(),
    })
  }, [config, addMessage])

  const loadHistory = useCallback((socket: Socket, convId: string) => {
    const allowedTypes = config?.visibleMessageTypes ?? ['message']
    const hiddenPatterns = config?.hiddenPatterns ?? []

    // Sync seenIdsRef từ messages đang có trong store (tránh duplicate sau reconnect)
    const existingMessages = useChatStore.getState().messages
    existingMessages.forEach((m) => { if (m.messageId) seenIdsRef.current.add(m.messageId) })

    socket.emit('conversation:history', { conversationId: convId, limit: 50 }, (res: {
      success: boolean
      data?: ServerMessage[]
    }) => {
      const rawMessages = res?.data ?? []
      const messages = rawMessages
        .filter((m) => !m.type || allowedTypes.includes(m.type as any))
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .filter((m) => !m.skipAgent)
        .filter((m) => !isHiddenByPattern(m.content, hiddenPatterns))
        .map((m) => {
          const mapped = mapServerMessage(m)
          if (mapped.messageId) seenIdsRef.current.add(mapped.messageId)
          return mapped
        })
      if (messages.length) {
        prependMessages(messages)
        // Divider separates history from new session
        addMessage({
          localId: `divider_${Date.now()}`,
          role: 'assistant',
          content: '',
          type: 'divider',
          status: 'sent',
          attachments: [],
          sources: [],
        })
        injectGreeting()
      } else {
        // No history → fresh conversation, show greeting only
        injectGreeting()
      }
    })
  }, [config, prependMessages, injectGreeting])

  const connect = useCallback(() => {
    if (!config) return
    if (socketRef.current?.connected) return
    if (isConnectingRef.current) return

    // Cleanup socket cũ nếu có
    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.disconnect()
      socketRef.current = null
    }

    isConnectingRef.current = true
    setPhase('connecting')

    const { origin, namespace } = parseWsUrl(config.wsUrl)

    const socket = io(`${origin}${namespace}`, {
      auth: { token: config.token },
      query: { token: config.token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    socketRef.current = socket

    // ── Connection events ────────────────────────────────────────────────────

    socket.on('connect', () => {
      isConnectingRef.current = false
      config.onConnected?.()

      // Token đã chứa agentId — server tự associate agent cho conversation.
      // Chỉ join lại conversation nếu host app truyền explicit conversationId qua config.
      // KHÔNG dùng store.conversationId vì nó có thể là stale/shared từ session trước.
      const knownConvId = config.conversationId
      if (knownConvId) {
        socket.emit('conversation:join', { conversationId: knownConvId }, (res: { success: boolean; conversationId?: string }) => {
          if (res.success && res.conversationId) {
            const currentConvId = useChatStore.getState().conversationId
            setConversationId(res.conversationId)
            // Only load history if this is a new conversation (not a reconnect to same session)
            if (currentConvId !== res.conversationId) {
              config.onConversationJoined?.(res.conversationId)
              loadHistory(socket, res.conversationId)
            }
          }
          setPhase('chat')
        })
      } else {
        // Anonymous / new session — greeting sẽ inject sau loadHistory (qua presence:update)
        setPhase('chat')
      }
    })

    socket.on('disconnect', (reason) => {
      isConnectingRef.current = false
      config.onDisconnected?.()
      // Chỉ log error, KHÔNG set phase về form — để Socket.IO tự reconnect
      // Nếu là intentional disconnect (destroy/close) thì bỏ qua
      if (!isIntentionalDisconnectRef.current) {
        config.onError?.(`Disconnected: ${reason}`)
        // Nếu server cắt kỳ do idle hoặc network, set phase connecting
        // để UI show spinner thay vì để người dùng gõ vào void
        setPhase('connecting')
      }
    })

    socket.on('connect_error', (err) => {
      isConnectingRef.current = false
      // Sau nhiều lần retry thất bại → về form để user có thể reconnect
      setPhase('form')
      config.onError?.(err.message)
    })

    // ── Business events ──────────────────────────────────────────────────────

    socket.on('presence:update', (payload: PresenceUpdatePayload) => {
      config.onPresenceUpdate?.(payload)

      if (payload.type === 'anonymous' && payload.conversationId) {
        const currentConvId = useChatStore.getState().conversationId

        // Same conversation reconnect — skip load history, messages already in store
        if (currentConvId === payload.conversationId) return

        // Different or no conversationId: new session assigned by server.
        // Clear messages and seenIds so history isn't duplicated across sessions.
        if (currentConvId && currentConvId !== payload.conversationId) {
          useChatStore.getState().resetConversation()
          seenIdsRef.current = new Set()
          greetingInjectedRef.current = false
        }

        setConversationId(payload.conversationId)
        config.onConversationJoined?.(payload.conversationId)
        loadHistory(socket, payload.conversationId)
      }
    })

    socket.on('message:error', (payload: { error: string }) => {
      config.onError?.(payload.error)
    })

    socket.on('message:sent', (payload: MessageSentPayload) => {
      const messages = useChatStore.getState().messages
      const pending = [...messages].reverse().find((m) => m.status === 'sending')
      if (pending?.localId) {
        confirmMessage(pending.localId, payload.messageId, String(payload.timestamp))
      }
    })

    socket.on('agent:typing', () => {
      setAgentTyping(true)
      if (typingTimeout) clearTimeout(typingTimeout)
      typingTimeout = setTimeout(() => setAgentTyping(false), 10000)
    })

    socket.on('message:new', (payload: ServerMessage) => {
      // Debug: emit raw payload for inspection
      config.onRawMessage?.(payload as unknown as Record<string, unknown>)

      // 1. Dedup
      const id = payload._id ?? payload.messageId
      if (id) {
        if (seenIdsRef.current.has(id)) return
        seenIdsRef.current.add(id)
      }

      // 2. Skip non-user-visible content
      if (payload.role === 'assistant' && payload.skipAgent) return
      const allowedTypes = config?.visibleMessageTypes ?? ['message']
      if (payload.type && !allowedTypes.includes(payload.type as any)) return
      if (isHiddenByPattern(payload.content, config?.hiddenPatterns ?? [])) return

      // 3. Process
      if (payload.role === 'assistant') {
        setAgentTyping(false)
        if (typingTimeout) clearTimeout(typingTimeout)

        const message = mapServerMessage(payload)
        addMessage(message)
        config.onMessage?.(message)
      }
      // user messages từ server (echo) không cần add lại vì đã có optimistic
    })
  }, [config, setPhase, addMessage, prependMessages, confirmMessage, setAgentTyping, setConversationId, loadHistory])

  const disconnect = useCallback(() => {
    isIntentionalDisconnectRef.current = true
    isConnectingRef.current = false
    greetingInjectedRef.current = false
    socketRef.current?.removeAllListeners()
    socketRef.current?.disconnect()
    socketRef.current = null
    isIntentionalDisconnectRef.current = false
  }, [])

  const sendMessage = useCallback((payload: SendMessagePayload) => {
    if (!socketRef.current?.connected) return

    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`

    addMessage({
      localId,
      role: 'user',
      content: payload.content,
      type: 'message',
      status: 'sending',
      attachments: payload.attachments ?? [],
      sources: [],
      timestamp: new Date().toISOString(),
    })

    // KHÔNG gửi conversationId trong DTO — server sẽ dùng client.data.conversationId
    // đã được resolve đúng per-user để tránh ghi message vào conversation sai.
    socketRef.current.emit('message:send', {
      role: 'user',
      content: payload.content,
      type: 'message',
      ...(payload.attachments?.length ? { attachments: payload.attachments } : {}),
    })

    // Fallback: mark failed nếu 60s không nhận ack (missing confirm / server issue)
    setTimeout(() => {
      const current = useChatStore.getState().messages.find(
        (m) => m.localId === localId && m.status === 'sending'
      )
      if (current) failMessage(localId)
    }, 60_000)
  }, [addMessage, failMessage])

  useEffect(() => {
    registerSendMessage((payload) => sendMessage(payload))
    return () => {
      unregisterSendMessage()
      disconnect()
      if (typingTimeout) clearTimeout(typingTimeout)
    }
  }, [disconnect, sendMessage])

  return { connect, disconnect, sendMessage }
}
