// ─── Field config ────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'tel' | 'email' | 'number'

export interface FieldConfig {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface SessionConfig {
  persist?: boolean
  storageKey?: string
  /** TTL in seconds. 0 = forever. Default: 86400 (24h) */
  ttl?: number
}

export interface SessionData {
  fields: Record<string, string>
  savedAt: number
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export interface AttachmentsConfig {
  enabled?: boolean
  /** Max file size in MB. Default: 5 */
  maxSize?: number
  /** MIME types or wildcards e.g. ['image/*', 'application/pdf'] */
  accept?: string[]
  /** Max number of files per message. Default: 5 */
  maxCount?: number
}

export interface AttachmentItem {
  name: string
  type: string
  size: number
  data: string // base64
}

// ─── Theme ───────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface ThemeConfig {
  mode?: ThemeMode
  primaryColor?: string
  borderRadius?: string
}

// ─── SDK Config ──────────────────────────────────────────────────────────────

export type Position = 'bottom-right' | 'bottom-left'

export interface SDKConfig {
  // Connection (required)
  wsUrl: string
  token: string
  /** Optional: pass known conversationId to resume. Anonymous flow will get it from server via presence:update. */
  conversationId?: string
  /** Socket.IO server path. Default: '/ws/chat' */
  socketPath?: string

  // Pre-chat form
  fields?: FieldConfig[]

  // Session
  session?: SessionConfig

  // Attachments
  attachments?: AttachmentsConfig

  // UI
  position?: Position
  title?: string
  subtitle?: string

  // Theme
  theme?: ThemeConfig

  // Callbacks
  onOpen?: () => void
  onClose?: () => void
  onConnected?: () => void
  onConversationJoined?: (conversationId: string) => void
  onDisconnected?: () => void
  onError?: (message: string) => void
  onMessage?: (message: Message) => void
  onFormSubmit?: (data: Record<string, string>) => void
  onPresenceUpdate?: (payload: PresenceUpdatePayload) => void
}

// ─── Socket.IO payloads ──────────────────────────────────────────────────────

export interface PresenceUpdatePayload {
  type: 'agent' | 'user' | 'anonymous'
  agentId?: string
  userId?: string | null
  conversationId?: string
  status: 'online' | 'offline'
  timestamp: string
}

export interface MessageErrorPayload {
  success: false
  error: string
  timestamp: string
}

export interface MessageSentPayload {
  success: boolean
  messageId: string
  timestamp: string
}

export interface AgentTypingPayload {
  type: 'agent'
  userId: string | null
  agentId: string
  conversationId: string
  timestamp: string
}

// ─── Messages ────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant'
export type MessageStatus = 'sending' | 'sent' | 'failed'

export interface Message {
  /** Local temp id before server confirms */
  localId?: string
  messageId?: string
  conversationId?: string
  role: MessageRole
  content: string
  type: 'text'
  status: MessageStatus
  attachments: AttachmentItem[]
  toolCalls: unknown[]
  toolResults: unknown[]
  timestamp?: string
}

export interface SendMessagePayload {
  role: 'user'
  content: string
  attachments?: AttachmentItem[]
}

// ─── Store state ─────────────────────────────────────────────────────────────

export type ChatPhase =
  | 'idle'        // widget closed, no connection
  | 'form'        // pre-chat form visible
  | 'connecting'  // socket connecting
  | 'chat'        // connected, chatting

export interface AgentPresence {
  agentId: string | null
  status: 'online' | 'offline'
  lastSeen: string | null
}
