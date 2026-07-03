import type { SendMessagePayload } from './types'

type SendFn = (payload: SendMessagePayload) => void
type ConnectFn = () => void
type TypingFn = (isTyping: boolean) => void
type LoadOlderFn = () => void
type UpdateTokenFn = (token: string) => void

let _sendFn: SendFn | null = null
let _connectFn: ConnectFn | null = null
let _typingFn: TypingFn | null = null
let _loadOlderFn: LoadOlderFn | null = null
let _updateTokenFn: UpdateTokenFn | null = null

export function registerSendMessage(fn: SendFn) { _sendFn = fn }
export function unregisterSendMessage() { _sendFn = null }
export function bridgeSendMessage(content: string, opts?: Pick<SendMessagePayload, 'attachments' | 'references' | 'workId'>) {
  _sendFn?.({ role: 'user', content, ...opts })
}

export function registerConnect(fn: ConnectFn) { _connectFn = fn }
export function unregisterConnect() { _connectFn = null }
export function bridgeConnect() { _connectFn?.() }

export function registerTyping(fn: TypingFn) { _typingFn = fn }
export function unregisterTyping() { _typingFn = null }
export function bridgeTyping(isTyping: boolean) { _typingFn?.(isTyping) }

export function registerLoadOlder(fn: LoadOlderFn) { _loadOlderFn = fn }
export function unregisterLoadOlder() { _loadOlderFn = null }
export function bridgeLoadOlder() { _loadOlderFn?.() }

export function registerUpdateToken(fn: UpdateTokenFn) { _updateTokenFn = fn }
export function unregisterUpdateToken() { _updateTokenFn = null }
export function bridgeUpdateToken(token: string) { _updateTokenFn?.(token) }
