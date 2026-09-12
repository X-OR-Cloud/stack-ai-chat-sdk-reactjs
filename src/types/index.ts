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

// ─── Custom Styles ──────────────────────────────────────────────────────────

export interface CustomStylesConfig {
  chatButton?: string
  chatWindow?: string
  chatHeader?: string
  messageList?: string
  messageBubble?: string
  messageInput?: string
  preChatForm?: string
  typingIndicator?: string
  /** Arbitrary CSS / CSS variable overrides */
  global?: string
}

// ─── SDK Config ──────────────────────────────────────────────────────────────

export type Position = 'bottom-right' | 'bottom-left'

export interface SDKConfig {
  // Connection (required)
  wsUrl: string
  token: string
  /** Optional: pass known conversationId to resume. Anonymous flow will get it from server via presence:update. */
  conversationId?: string
  /**
   * Authenticated-user flow (user JWT): agent to chat with.
   * SDK emits `agent:connect { agentId }` — server find-or-creates the conversation and joins the room.
   * Not needed for anonymous tokens (agentId is embedded in the token, server auto-joins).
   */
  agentId?: string
  /**
   * Socket.IO handshake path override. By default it is derived from wsUrl:
   * last path segment + '/socket.io' (e.g. wss://host/ws/chat → '/chat/socket.io').
   */
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

  // Visible message types — which action types from WS to render in the chat box.
  // Default: ['message']
  visibleMessageTypes?: MessageType[]

  // Hidden content patterns — regex patterns to filter out messages by content.
  // Useful when server sends internal messages (e.g. tool calls) with type: 'message'.
  // Default: none. Example: [/^🧠\s?\*\*Knowledge Search\*\*/, /^Retrieved \d+ knowledge chunk/, /^No relevant knowledge found/]
  hiddenPatterns?: RegExp[]

  // Custom styles — per-component CSS overrides injected into Shadow DOM
  customStyles?: CustomStylesConfig

  // References — show/hide agent reference documents attached to responses.
  // Default: true
  showReferences?: boolean

  /**
   * Reference display mode — controls how source references are rendered:
   * - 'none': No sources panel shown
   * - 'url':  Show source chips only; clicking opens source.url in a new tab (if available).
   *           No modal, no content preview. Sources without a url are shown as disabled chips.
   * - 'full': Show source chips + modal with full content (markdown, score, url). Default behavior.
   *
   * Default: 'full' (or mapped from showReferences for backward compatibility).
   * If both referenceDisplay and showReferences are set, referenceDisplay takes precedence.
   */
  referenceDisplay?: 'none' | 'url' | 'full'

  /**
   * Vote (like/dislike) on agent answers via the WS `reaction:toggle` event.
   * Default: { enabled: false } — opt-in, so existing apps do not sprout new UI on upgrade.
   */
  voting?: VotingConfig

  // Greeting — message shown immediately after connection, before any user input.
  greeting?: string

  // Max characters allowed in message input. Default: 1000. Hard cap: 2000.
  maxInputLength?: number

  /** Streaming reveal tuning. Default: { smooth: true, tickMs: 30, wordsPerTick: 1, catchupCharsPerWord: 120, finishingExtraWords: 2 } */
  streaming?: StreamingConfig

  /**
   * Token refresh callback — called by SDK on every Socket.IO reconnect_attempt.
   * Return the latest token (sync or async). If not provided, SDK uses the token
   * from init()/updateToken() (which may be stale if it expired while disconnected).
   */
  tokenRefresh?: () => string | Promise<string>

  // Callbacks
  onOpen?: () => void
  onClose?: () => void
  onConnected?: () => void
  onConversationJoined?: (conversationId: string) => void
  onDisconnected?: () => void
  onError?: (message: string, detail?: Record<string, unknown>) => void
  onMessage?: (message: Message) => void
  /** Debug: raw WebSocket payload before filtering. Useful for inspecting server data. */
  onRawMessage?: (payload: Record<string, unknown>) => void
  onFormSubmit?: (data: Record<string, string>) => void
  /** Called once the server confirms the vote */
  onVote?: (event: VoteEvent) => void
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

// ─── Sources (from server message:new) ───────────────────────────────────────

export type SourceType = 'rag' | 'web' | 'tool' | 'memory'

export interface MessageSource {
  type: SourceType
  content: string
  score?: number        // relevance score (rag/web)
  collectionId?: string // rag only
  url?: string          // web only
  toolName?: string     // tool only
  label?: string        // optional display name
}

// ─── Vote / Reaction (WS: reaction:toggle — AIWM v1.56.0+) ──────────────────
//
// A widget authenticated with an anonymous token CANNOT call the REST endpoint
// /aiwm/actions/:id/react — JwtAuthGuard rejects it with "Invalid token payload".
// For anonymous clients WebSocket is the only channel; see the AIWM reaction
// integration guide, §1 and §9.

export type VoteType = 'like' | 'dislike'

/** Toggle outcome decided by the server — never derived on the client */
export type VoteAction = 'created' | 'updated' | 'removed'

/**
 * How a streamed answer (`message:chunk`) is revealed.
 * Defaults to word-by-word reveal to avoid jerkiness when server chunks are large or uneven.
 */
export interface StreamingConfig {
  /** Reveal content word by word instead of painting each chunk on arrival. Default: true */
  smooth?: boolean
  /** Interval (ms) between reveals. Default: 100 */
  tickMs?: number
  /** Words revealed per tick when caught up with the server. Default: 1 */
  wordsPerTick?: number
  /**
   * Adaptive catch-up: for every N unrevealed characters (backlog = received - displayed),
   * reveal one extra word per tick. Keeps the UI from lagging behind a fast server while
   * staying slow and smooth when nearly caught up. Default: 120
   */
  catchupCharsPerWord?: number
  /** Extra words per tick once the final message has arrived, so the final bubble swaps in sooner. Default: 2 */
  finishingExtraWords?: number
}

export interface VotingConfig {
  /** Show vote buttons under agent answers. Default: false (opt-in) */
  enabled?: boolean
}

/** Payload emitted to the server as `reaction:toggle` */
export interface ReactionTogglePayload {
  conversationId: string
  actionId: string
  type: VoteType
}

/** ACK returned for `reaction:toggle` */
export interface ReactionToggleAck {
  success: boolean
  error?: string
  actionId?: string
  conversationId?: string
  resultAction?: VoteAction
  /** Counts AFTER the operation — always use these absolute values, never +1/-1 */
  likes?: number
  dislikes?: number
  /** Final state for the SENDER only. null when the vote was just removed */
  userReaction?: VoteType | null
}

/**
 * Broadcast to every client in the room whenever someone reacts.
 * ⚠️ There is no `userReaction` here: `type` belongs to WHOEVER JUST CLICKED, not to the
 * client receiving the event (docs §6 and §12). Only read likes/dislikes from this payload.
 */
export interface ReactionUpdatedPayload {
  conversationId: string
  actionId: string
  likes: number
  dislikes: number
  type: VoteType | null
  actor?: { userId?: string; agentId?: string }
  resultAction: VoteAction
  nonce?: string
  timestamp?: string
}

/** Payload handed to the host app's onVote callback */
export interface VoteEvent {
  actionId: string
  /** State AFTER the operation — null means the vote was just removed */
  vote: VoteType | null
  action: VoteAction
  likes?: number
  dislikes?: number
}

// ─── Messages ────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant'
export type MessageStatus = 'sending' | 'sent' | 'failed'
export type MessageType = 'message' | 'system' | 'error' | 'tool_use' | 'tool_result' | 'thinking' | 'notice' | 'divider'

export interface Message {
  /** Local temp id before server confirms */
  localId?: string
  messageId?: string
  conversationId?: string
  role: MessageRole
  content: string
  type: MessageType
  status: MessageStatus
  attachments: AttachmentItem[]
  sources: MessageSource[]
  timestamp?: string
  /** The CURRENT user's own vote on this message (null = not voted) */
  userReaction?: VoteType | null
  /** Total votes from everyone — server-provided; the SDK never increments them itself */
  likes?: number
  dislikes?: number
  /** Waiting for the server to confirm — locks the buttons against double submits */
  votePending?: boolean
}

/** Structured reference attached to an outgoing message (doc: message:send.references) */
export interface MessageReference {
  resourceType: string
  resourceId: string
  label?: string
}

export interface SendMessagePayload {
  role: 'user'
  content: string
  attachments?: AttachmentItem[]
  references?: MessageReference[]
  workId?: string
}

/** Streaming delta from server while the agent is composing an answer */
export interface MessageChunkPayload {
  actionId: string
  agentId?: string
  conversationId?: string
  delta: string
  chunkIndex: number
}

// ─── Store state ─────────────────────────────────────────────────────────────

export type ChatPhase =
  | 'idle'        // widget closed, no connection
  | 'form'        // pre-chat form visible
  | 'connecting'  // socket connecting
  | 'chat'        // connected, chatting

