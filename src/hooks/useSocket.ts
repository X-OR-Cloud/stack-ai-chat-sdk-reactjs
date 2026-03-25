import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useChatStore } from '../store/chatStore'
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

function mapServerMessage(payload: ServerMessage): Message {
  return {
    messageId: payload._id ?? payload.messageId,
    conversationId: payload.conversationId,
    role: payload.role,
    content: payload.content ?? '',
    type: 'message',
    status: 'sent',
    attachments: payload.attachments ?? [],
    sources: payload.sources ?? [],
    timestamp: payload.createdAt ?? payload.timestamp,
  }
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const isConnectingRef = useRef(false)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const config = useChatStore((s) => s.config)
  const setPhase = useChatStore((s) => s.setPhase)
  const addMessage = useChatStore((s) => s.addMessage)
  const prependMessages = useChatStore((s) => s.prependMessages)
  const confirmMessage = useChatStore((s) => s.confirmMessage)
  const failMessage = useChatStore((s) => s.failMessage)
  const setAgentTyping = useChatStore((s) => s.setAgentTyping)
  const setPresence = useChatStore((s) => s.setPresence)
  const setConversationId = useChatStore((s) => s.setConversationId)
  const conversationId = useChatStore((s) => s.conversationId)

  const loadHistory = useCallback((socket: Socket, convId: string) => {
    socket.emit('conversation:history', { conversationId: convId, limit: 50 }, (res: {
      success: boolean
      data?: ServerMessage[]
    }) => {
      if (res.success && res.data?.length) {
        // Filter chỉ lấy message/notice hiển thị với user
        const messages = res.data
          .filter((m) => !m.type || m.type === 'message')
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .filter((m) => !m.skipAgent)
          .map((m) => {
            const mapped = mapServerMessage(m)
            if (mapped.messageId) seenIdsRef.current.add(mapped.messageId)
            return mapped
          })
        if (messages.length) prependMessages(messages)
      }
    })
  }, [prependMessages])

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
      // Nếu có conversationId từ config/session, join lại để resume.
      const knownConvId = config.conversationId ?? useChatStore.getState().conversationId
      if (knownConvId) {
        socket.emit('conversation:join', { conversationId: knownConvId }, (res: { success: boolean; conversationId?: string }) => {
          if (res.success && res.conversationId) {
            setConversationId(res.conversationId)
            config.onConversationJoined?.(res.conversationId)
            loadHistory(socket, res.conversationId)
          }
          setPhase('chat')
        })
      } else {
        // Anonymous / new session: server sẽ tạo conversation và gửi conversationId qua presence:update
        setPhase('chat')
      }
    })

    socket.on('disconnect', (reason) => {
      isConnectingRef.current = false
      config.onDisconnected?.()
      config.onError?.(`Disconnected: ${reason}`)
    })

    socket.on('connect_error', (err) => {
      isConnectingRef.current = false
      setPhase('form')
      config.onError?.(err.message)
    })

    // ── Business events ──────────────────────────────────────────────────────

    socket.on('presence:update', (payload: PresenceUpdatePayload) => {
      config.onPresenceUpdate?.(payload)

      if (payload.type === 'anonymous' && payload.conversationId) {
        // Anonymous: server auto-creates conversation, gửi conversationId ở đây
        setConversationId(payload.conversationId)
        config.onConversationJoined?.(payload.conversationId)
        loadHistory(socket, payload.conversationId)
      } else if (payload.type === 'agent' && payload.agentId) {
        setPresence({
          agentId: payload.agentId,
          status: payload.status,
          lastSeen: payload.timestamp,
        })
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
      typingTimeout = setTimeout(() => setAgentTyping(false), 3000)
    })

    socket.on('message:new', (payload: ServerMessage) => {
      // 1. Dedup
      const id = payload._id ?? payload.messageId
      if (id) {
        if (seenIdsRef.current.has(id)) return
        seenIdsRef.current.add(id)
      }

      // 2. Skip non-user-visible content
      if (payload.role === 'assistant' && payload.skipAgent) return
      if (payload.type && payload.type !== 'message') return

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
  }, [config, setPhase, addMessage, prependMessages, confirmMessage, setAgentTyping, setPresence, setConversationId, conversationId, loadHistory])

  const disconnect = useCallback(() => {
    isConnectingRef.current = false
    socketRef.current?.removeAllListeners()
    socketRef.current?.disconnect()
    socketRef.current = null
  }, [])

  const sendMessage = useCallback((payload: SendMessagePayload) => {
    if (!socketRef.current?.connected) return

    const convId = useChatStore.getState().conversationId
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

    socketRef.current.emit('message:send', {
      ...(convId ? { conversationId: convId } : {}),
      role: 'user',
      content: payload.content,
      type: 'message',
      ...(payload.attachments?.length ? { attachments: payload.attachments } : {}),
    })

    // Fallback: mark failed nếu 10s không nhận confirm
    setTimeout(() => {
      const current = useChatStore.getState().messages.find(
        (m) => m.localId === localId && m.status === 'sending'
      )
      if (current) failMessage(localId)
    }, 10_000)
  }, [addMessage, failMessage])

  useEffect(() => {
    return () => {
      disconnect()
      if (typingTimeout) clearTimeout(typingTimeout)
    }
  }, [disconnect])

  return { connect, disconnect, sendMessage }
}
