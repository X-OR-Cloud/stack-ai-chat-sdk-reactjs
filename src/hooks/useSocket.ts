import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useChatStore } from '../store/chatStore'
import type {
  Message,
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

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const isConnectingRef = useRef(false)
  const config = useChatStore((s) => s.config)
  const setPhase = useChatStore((s) => s.setPhase)
  const addMessage = useChatStore((s) => s.addMessage)
  const confirmMessage = useChatStore((s) => s.confirmMessage)
  const failMessage = useChatStore((s) => s.failMessage)
  const setAgentTyping = useChatStore((s) => s.setAgentTyping)
  const setPresence = useChatStore((s) => s.setPresence)

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

    // NestJS Socket.IO: origin + namespace tách từ wsUrl
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
      socket.emit('conversation:join', { conversationId: config.conversationId })
      config.onConversationJoined?.(config.conversationId)
      setPhase('chat')
      config.onConnected?.()
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
      if (payload.type === 'agent' && payload.agentId) {
        setPresence({
          agentId: payload.agentId,
          status: payload.status,
          lastSeen: payload.timestamp,
        })
      }
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

    // Server broadcast message object trực tiếp (không wrap trong { event, data })
    socket.on('message:new', (payload: Partial<Message>) => {
      if (payload.role === 'assistant') {
        setAgentTyping(false)
        if (typingTimeout) clearTimeout(typingTimeout)

        const message: Message = {
          messageId: payload.messageId,
          conversationId: payload.conversationId,
          role: 'assistant',
          content: payload.content ?? '',
          type: 'text',
          status: 'sent',
          attachments: payload.attachments ?? [],
          toolCalls: payload.toolCalls ?? [],
          toolResults: payload.toolResults ?? [],
          timestamp: payload.timestamp,
        }

        addMessage(message)
        config.onMessage?.(message)
      }
    })
  }, [config, setPhase, addMessage, confirmMessage, setAgentTyping, setPresence])

  const disconnect = useCallback(() => {
    isConnectingRef.current = false
    socketRef.current?.removeAllListeners()
    socketRef.current?.disconnect()
    socketRef.current = null
  }, [])

  const sendMessage = useCallback((payload: SendMessagePayload) => {
    if (!socketRef.current?.connected) return

    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`

    addMessage({
      localId,
      role: 'user',
      content: payload.content,
      type: 'text',
      status: 'sending',
      attachments: payload.attachments ?? [],
      toolCalls: [],
      toolResults: [],
      timestamp: new Date().toISOString(),
    })

    // Server lắng nghe "message:send" (không phải message:new)
    socketRef.current.emit('message:send', {
      role: 'user',
      content: payload.content,
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
