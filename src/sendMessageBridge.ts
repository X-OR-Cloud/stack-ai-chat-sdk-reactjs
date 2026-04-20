type SendFn = (payload: { role: 'user'; content: string }) => void
type ConnectFn = () => void

let _sendFn: SendFn | null = null
let _connectFn: ConnectFn | null = null

export function registerSendMessage(fn: SendFn) { _sendFn = fn }
export function unregisterSendMessage() { _sendFn = null }
export function bridgeSendMessage(content: string) { _sendFn?.({ role: 'user', content }) }

export function registerConnect(fn: ConnectFn) { _connectFn = fn }
export function unregisterConnect() { _connectFn = null }
export function bridgeConnect() { _connectFn?.() }
