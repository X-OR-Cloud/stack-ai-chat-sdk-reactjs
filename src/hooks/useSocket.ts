import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useChatStore } from '../store/chatStore'
import {
  registerSendMessage, unregisterSendMessage,
  registerTyping, unregisterTyping,
  registerLoadOlder, unregisterLoadOlder,
  registerUpdateToken, unregisterUpdateToken,
} from '../sendMessageBridge'
import type {
  Message,
  MessageSource,
  MessageChunkPayload,
  PresenceUpdatePayload,
  MessageSentPayload,
  SendMessagePayload,
} from '../types'

let typingTimeout: ReturnType<typeof setTimeout> | null = null
let lastAssistantMessageAt = 0

// Server-internal action types — chỉ xin từ server khi host app muốn hiển thị chúng
const INTERNAL_TYPES = ['thinking', 'tool_use', 'tool_result']
// Luôn hiển thị bất kể visibleMessageTypes: guardrail block / agent sleep / lỗi
// đến dưới dạng system|error — ẩn chúng đi thì user gửi tin mà không thấy phản hồi gì.
const ALWAYS_VISIBLE_TYPES = ['system', 'notice', 'error']

// wsUrl "https://ws.hydrabyte.co/chat" → origin "https://ws.hydrabyte.co", path "/chat/socket.io"
// wsUrl "http://10.10.0.80:3407"       → origin "http://10.10.0.80:3407",   path "/socket.io"
export function resolveSocketParams(wsUrl: string, socketPathOverride?: string): { serverOrigin: string; socketPath: string } {
  try {
    const u = new URL(wsUrl)
    const base = u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : ''
    return {
      serverOrigin: u.origin,
      socketPath: socketPathOverride ?? (base + '/socket.io'),
    }
  } catch {
    return { serverOrigin: wsUrl, socketPath: socketPathOverride ?? '/socket.io' }
  }
}

/** Server gửi shape: { _id, role, content, type, createdAt, sources, attachments, isFinal, ... } */
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
  /** true = câu trả lời cuối cùng của turn (agent messages) */
  isFinal?: boolean
  attachments?: Message['attachments']
  sources?: MessageSource[]
}

interface HistoryResponse {
  success: boolean
  data?: ServerMessage[]
  hasMore?: boolean
}

interface SendAck {
  success: boolean
  error?: string
  guardrailBlocked?: boolean
  message?: { _id?: string; createdAt?: string }
}

interface JoinAck {
  success: boolean
  conversationId?: string
  error?: string
}

function isHiddenByPattern(content: string | undefined, patterns: RegExp[]): boolean {
  if (!content || !patterns.length) return false
  return patterns.some((re) => re.test(content))
}

function isTypeVisible(type: string | undefined, allowedTypes: string[]): boolean {
  if (!type) return true
  return allowedTypes.includes(type) || ALWAYS_VISIBLE_TYPES.includes(type)
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
  const myUserIdRef = useRef<string | null>(null)
  const connectFailuresRef = useRef(0)
  const tokenRef = useRef<string | null>(null)
  // Chunk buffer per actionId — chunkIndex có thể đến không đúng thứ tự (doc CWS)
  const chunksRef = useRef<Map<string, Map<number, string>>>(new Map())
  // Cursor phân trang history: _id của message cũ nhất đã load
  const historyCursorRef = useRef<string | null>(null)
  const config = useChatStore((s) => s.config)
  const setPhase = useChatStore((s) => s.setPhase)
  const addMessage = useChatStore((s) => s.addMessage)
  const prependMessages = useChatStore((s) => s.prependMessages)
  const confirmMessage = useChatStore((s) => s.confirmMessage)
  const failMessage = useChatStore((s) => s.failMessage)
  const setAgentTyping = useChatStore((s) => s.setAgentTyping)
  const setConversationId = useChatStore((s) => s.setConversationId)
  const setWaitingForAgent = useChatStore((s) => s.setWaitingForAgent)
  const setStreaming = useChatStore((s) => s.setStreaming)
  const setHistoryHasMore = useChatStore((s) => s.setHistoryHasMore)
  const setLoadingHistory = useChatStore((s) => s.setLoadingHistory)

  // Giữ token mới nhất — updateToken() ghi đè trực tiếp, config.token là giá trị khởi tạo
  useEffect(() => {
    if (config?.token) tokenRef.current = config.token
  }, [config?.token])

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

  const loadHistory = useCallback((socket: Socket, convId: string, before?: string) => {
    const allowedTypes = config?.visibleMessageTypes ?? ['message']
    const hiddenPatterns = config?.hiddenPatterns ?? []
    // Host app muốn xem trace (thinking/tool_*) → phải xin server trả cả internal actions
    const includeInternal = allowedTypes.some((t) => INTERNAL_TYPES.includes(t))

    // Sync seenIdsRef từ messages đang có trong store (tránh duplicate sau reconnect)
    const existingMessages = useChatStore.getState().messages
    existingMessages.forEach((m) => { if (m.messageId) seenIdsRef.current.add(m.messageId) })

    setLoadingHistory(true)
    socket.emit('conversation:history', {
      conversationId: convId,
      limit: 50,
      includeInternal,
      ...(before ? { before } : {}),
    }, (res: HistoryResponse) => {
      setLoadingHistory(false)
      setHistoryHasMore(!!res?.hasMore)

      // Doc CWS: FE tự sort oldest → newest
      const rawMessages = [...(res?.data ?? [])].sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0
        return ta - tb
      })
      if (rawMessages.length && rawMessages[0]._id) {
        historyCursorRef.current = rawMessages[0]._id
      }

      const messages = rawMessages
        .filter((m) => isTypeVisible(m.type, allowedTypes))
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .filter((m) => !m.skipAgent)
        .filter((m) => !isHiddenByPattern(m.content, hiddenPatterns))
        .map((m) => {
          const mapped = mapServerMessage(m)
          if (mapped.messageId) seenIdsRef.current.add(mapped.messageId)
          return mapped
        })

      // Trang cũ hơn (load more): chỉ prepend, không divider/greeting
      if (before) {
        if (messages.length) prependMessages(messages)
        return
      }

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
  }, [config, prependMessages, injectGreeting, addMessage, setHistoryHasMore, setLoadingHistory])

  const loadOlderMessages = useCallback(() => {
    const socket = socketRef.current
    const state = useChatStore.getState()
    if (!socket?.connected || !state.conversationId || !historyCursorRef.current) return
    if (state.isLoadingHistory || !state.historyHasMore) return
    loadHistory(socket, state.conversationId, historyCursorRef.current)
  }, [loadHistory])

  const connect = useCallback(() => {
    if (!config) return
    isIntentionalDisconnectRef.current = false
    if (socketRef.current?.connected) return
    if (isConnectingRef.current) return

    // Cleanup socket cũ nếu có
    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.disconnect()
      socketRef.current = null
    }

    isConnectingRef.current = true
    connectFailuresRef.current = 0
    setPhase('connecting')

    const { serverOrigin, socketPath } = resolveSocketParams(config.wsUrl, config.socketPath)
    const token = tokenRef.current ?? config.token

    const socket = io(serverOrigin, {
      path: socketPath,
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      forceNew: true,
      multiplex: false,
    })

    socketRef.current = socket

    // ── Connection events ────────────────────────────────────────────────────

    socket.on('connect', () => {
      isConnectingRef.current = false
      connectFailuresRef.current = 0
      config.onConnected?.()

      // Room membership mất khi reconnect → phải join lại mỗi lần connect (doc CWS).
      // - User flow (config.agentId): agent:connect — server find-or-create conversation.
      // - Resume flow (conversationId đã biết): conversation:join.
      // - Anonymous: server tự resolve + join, conversationId về qua presence:update.
      const knownConvId = useChatStore.getState().conversationId || config.conversationId

      const onJoined = (res: JoinAck) => {
        if (res?.success && res.conversationId) {
          const currentConvId = useChatStore.getState().conversationId
          setConversationId(res.conversationId)
          // Only load history if this is a new conversation (not a reconnect to same session)
          if (currentConvId !== res.conversationId) {
            config.onConversationJoined?.(res.conversationId)
            loadHistory(socket, res.conversationId)
          }
        } else if (res && !res.success && res.error) {
          config.onError?.(res.error)
        }
        setPhase('chat')
      }

      if (config.agentId && !knownConvId) {
        socket.emit('agent:connect', { agentId: config.agentId }, onJoined)
      } else if (knownConvId) {
        socket.emit('conversation:join', { conversationId: knownConvId }, onJoined)
      } else {
        // Anonymous / new session — greeting sẽ inject sau loadHistory (qua presence:update)
        setPhase('chat')
      }
    })

    socket.on('disconnect', (reason) => {
      isConnectingRef.current = false
      config.onDisconnected?.()
      setWaitingForAgent(false)
      setAgentTyping(false)
      // Chunk buffer mất tính liên tục khi rớt kết nối — bỏ bubble streaming dở dang,
      // câu trả lời final sẽ về qua message:new / history sau khi reconnect
      setStreaming(null)
      chunksRef.current.clear()
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
      setWaitingForAgent(false)
      connectFailuresRef.current += 1
      // Socket.IO tiếp tục retry với backoff (1s → 5s). Sau nhiều lần thất bại liên tiếp
      // (token sai / server down) → về form để user có thể chủ động kết nối lại.
      if (connectFailuresRef.current >= 5) {
        setPhase('form')
      }

      const e = err as Error & {
        data?: unknown
        type?: string
        context?: { status?: number; responseText?: string }
      }
      const detail: Record<string, unknown> = { type: e.type ?? 'connect_error' }
      if (e.context?.status)       detail.httpStatus    = e.context.status
      if (e.context?.responseText) detail.httpResponse  = e.context.responseText.slice(0, 500)
      if (e.data !== undefined)    detail.serverData    = e.data

      config.onError?.(e.message, detail)
    })

    // ── Business events ──────────────────────────────────────────────────────

    socket.on('presence:update', (payload: PresenceUpdatePayload) => {
      config.onPresenceUpdate?.(payload)

      if (payload.type === 'anonymous' && payload.conversationId) {
        // Ghi nhớ userId của chính mình từ event đầu tiên
        if (!myUserIdRef.current && payload.userId) {
          myUserIdRef.current = payload.userId
        }
        // Bỏ qua event của user khác (server broadcast cho cả agent)
        if (payload.userId && myUserIdRef.current && payload.userId !== myUserIdRef.current) return

        const currentConvId = useChatStore.getState().conversationId

        // Same conversation reconnect — skip load history, messages already in store
        if (currentConvId === payload.conversationId) return

        // Different or no conversationId: new session assigned by server.
        // Clear messages and seenIds so history isn't duplicated across sessions.
        if (currentConvId && currentConvId !== payload.conversationId) {
          useChatStore.getState().resetSession()
          seenIdsRef.current = new Set()
          greetingInjectedRef.current = false
          historyCursorRef.current = null
        }

        setConversationId(payload.conversationId)
        config.onConversationJoined?.(payload.conversationId)
        loadHistory(socket, payload.conversationId)
      }
    })

    socket.on('message:error', (payload: { error: string }) => {
      config.onError?.(payload.error)
      setWaitingForAgent(false)
    })

    // Fallback confirm cho server không trả ack trên message:send
    socket.on('message:sent', (payload: MessageSentPayload) => {
      const messages = useChatStore.getState().messages
      const pending = [...messages].reverse().find((m) => m.status === 'sending')
      if (pending?.localId) {
        confirmMessage(pending.localId, payload.messageId, String(payload.timestamp))
      }
    })

    socket.on('agent:typing', () => {
      // Ignore late typing events that arrive after a final assistant message
      if (Date.now() - lastAssistantMessageAt < 2000) return
      // Đang stream → bubble streaming đã thay cho typing dots
      if (useChatStore.getState().streaming) return
      setAgentTyping(true)
      if (typingTimeout) clearTimeout(typingTimeout)
      typingTimeout = setTimeout(() => setAgentTyping(false), 10000)
    })

    // Streaming delta — agent gõ từng chunk trước khi có message:new final
    socket.on('message:chunk', (payload: MessageChunkPayload) => {
      if (!payload?.actionId || typeof payload.delta !== 'string') return

      // Chunk thay thế typing dots bằng bubble nội dung thật
      setAgentTyping(false)
      if (typingTimeout) clearTimeout(typingTimeout)

      let entry = chunksRef.current.get(payload.actionId)
      if (!entry) {
        entry = new Map()
        chunksRef.current.set(payload.actionId, entry)
      }
      entry.set(payload.chunkIndex, payload.delta)

      const content = [...entry.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, delta]) => delta)
        .join('')
      setStreaming({ actionId: payload.actionId, content })
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

      // 2. Clear typing for any assistant message before type filtering —
      //    filtered messages (tool_use, thinking, etc.) also signal agent activity
      if (payload.role === 'assistant' && !payload.skipAgent) {
        lastAssistantMessageAt = Date.now()
        setAgentTyping(false)
        if (typingTimeout) clearTimeout(typingTimeout)

        // Turn kết thúc khi server đánh dấu isFinal; fallback theo type cho server cũ
        const isFinal = payload.isFinal ?? (payload.type === 'message' || !payload.type)
        if (isFinal) {
          setWaitingForAgent(false)
          // Replace bubble streaming bằng nội dung final (actionId của chunks == _id của final)
          if (payload._id) chunksRef.current.delete(payload._id)
          setStreaming(null)
        }
      }

      // 3. Skip non-user-visible content — system/notice/error luôn hiển thị
      //    (guardrail block, agent sleep, lỗi từ agent)
      if (payload.role === 'assistant' && payload.skipAgent) return
      const allowedTypes = config?.visibleMessageTypes ?? ['message']
      if (!isTypeVisible(payload.type, allowedTypes)) return
      if (isHiddenByPattern(payload.content, config?.hiddenPatterns ?? [])) return

      // 4. Process
      if (payload.role === 'assistant') {
        const message = mapServerMessage(payload)
        addMessage(message)
        config.onMessage?.(message)
      }
      // user messages từ server (echo) không cần add lại vì đã có optimistic
    })
  }, [config, setPhase, addMessage, prependMessages, confirmMessage, setAgentTyping, setConversationId, loadHistory, setWaitingForAgent, setStreaming])

  const disconnect = useCallback(() => {
    isIntentionalDisconnectRef.current = true
    isConnectingRef.current = false
    greetingInjectedRef.current = false
    myUserIdRef.current = null
    chunksRef.current.clear()
    socketRef.current?.disconnect()        // fires 'disconnect' event — flag=true guards the handler
    socketRef.current?.removeAllListeners()
    socketRef.current = null
    useChatStore.getState().setWaitingForAgent(false)
    useChatStore.getState().setStreaming(null)
  }, [])

  const sendMessage = useCallback((payload: SendMessagePayload) => {
    const socket = socketRef.current
    if (!socket?.connected) return

    setWaitingForAgent(true)

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

    let acked = false

    // KHÔNG gửi conversationId trong DTO — server sẽ dùng client.data.conversationId
    // đã được resolve đúng per-user để tránh ghi message vào conversation sai.
    socket.emit('message:send', {
      role: 'user',
      content: payload.content,
      type: 'message',
      ...(payload.attachments?.length ? { attachments: payload.attachments } : {}),
      ...(payload.references?.length ? { references: payload.references } : {}),
      ...(payload.workId ? { workId: payload.workId } : {}),
    }, (res: SendAck | undefined) => {
      acked = true
      if (res?.success) {
        confirmMessage(localId, res.message?._id ?? '', res.message?.createdAt ?? new Date().toISOString())
        return
      }
      setWaitingForAgent(false)
      if (res?.guardrailBlocked) {
        // Guardrail chặn: server broadcast system notice giải thích —
        // gỡ optimistic message để không hiển thị nội dung bị chặn (doc CWS)
        useChatStore.getState().removeMessage(localId)
      } else {
        failMessage(localId)
      }
      if (res?.error) config?.onError?.(res.error)
    })

    // Fallback: mark failed nếu 60s không nhận ack (missing confirm / server issue)
    setTimeout(() => {
      if (!acked) {
        const current = useChatStore.getState().messages.find(
          (m) => m.localId === localId && m.status === 'sending'
        )
        if (current) failMessage(localId)
      }
      // Safety valve: không khóa input vô hạn nếu agent không bao giờ trả lời
      useChatStore.getState().setWaitingForAgent(false)
    }, 60_000)
  }, [addMessage, confirmMessage, failMessage, setWaitingForAgent, config])

  // Typing indicator của user — doc CWS: một event duy nhất với cờ isTyping
  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current
    const convId = useChatStore.getState().conversationId
    if (!socket?.connected || !convId) return
    socket.emit('message:typing', { conversationId: convId, isTyping })
  }, [])

  // Token refresh (doc CWS): gán auth mới rồi reconnect để handshake lại
  const updateToken = useCallback((token: string) => {
    tokenRef.current = token
    const socket = socketRef.current
    if (socket) {
      ;(socket as Socket & { auth: Record<string, unknown> }).auth = { token }
      socket.disconnect().connect()
    }
  }, [])

  useEffect(() => {
    registerSendMessage((payload) => sendMessage(payload))
    registerTyping(sendTyping)
    registerLoadOlder(loadOlderMessages)
    registerUpdateToken(updateToken)
    return () => {
      unregisterSendMessage()
      unregisterTyping()
      unregisterLoadOlder()
      unregisterUpdateToken()
      disconnect()
      if (typingTimeout) clearTimeout(typingTimeout)
    }
  }, [disconnect, sendMessage, sendTyping, loadOlderMessages, updateToken])

  return { connect, disconnect, sendMessage }
}
