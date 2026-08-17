import { createRoot, Root } from 'react-dom/client'
import { createElement } from 'react'
import { ChatWidget } from './ChatWidget'
import { useChatStore } from './store/chatStore'
import {
  bridgeSendMessage, unregisterSendMessage,
  bridgeConnect, unregisterConnect,
  bridgeUpdateToken, unregisterTyping, unregisterLoadOlder, unregisterUpdateToken,
} from './sendMessageBridge'
import { createShadowHost, setTheme, watchSystemTheme } from './utils/shadowDom'
import type { SDKConfig, SendMessagePayload } from './types'
import { SDK_VERSION } from './version'

// Re-export types for consumers
export type { SDKConfig, FieldConfig, ThemeConfig, AttachmentsConfig, SessionConfig, CustomStylesConfig, MessageType, Message, MessageReference, SendMessagePayload } from './types'

let root: Root | null = null
let hostEl: HTMLElement | null = null
let cleanupThemeWatcher: (() => void) | null = null
let currentConfig: SDKConfig | null = null

/**
 * Cấu hình sai (thiếu/không phải URL hợp lệ) phải hỏng NGAY và ỒN ÀO tại nơi gọi
 * `init()`/`updateConfig()`, thay vì âm thầm để `io(undefined, ...)` thử kết nối
 * tới origin của chính trang host rồi thất bại như một `connect_error` khó hiểu.
 * (Xem BUG-044 — cấu hình sai không kêu lên là lớp lỗi đã gây sự cố Production 7 tháng.)
 */
function assertValidWsUrl(wsUrl: unknown, caller: 'init' | 'updateConfig'): void {
  if (typeof wsUrl !== 'string' || wsUrl.trim() === '') {
    throw new Error(
      `[SDKChat] ${caller}() thiếu "wsUrl" (bắt buộc). Ví dụ: ` +
      `StackAIChat.${caller}({ wsUrl: 'wss://your-gateway.example.com/ws/chat', token: '...' })`
    )
  }
  try {
    // eslint-disable-next-line no-new
    new URL(wsUrl)
  } catch {
    throw new Error(
      `[SDKChat] ${caller}() nhận "wsUrl" không phải URL hợp lệ: "${wsUrl}". ` +
      `Cần một URL đầy đủ có scheme, ví dụ: 'wss://your-gateway.example.com/ws/chat'.`
    )
  }
}

export const StackAIChat = {
  version: SDK_VERSION,

  init(config: SDKConfig): void {
    if (root) {
      console.warn('[SDKChat] Already initialized. Call destroy() first or use updateConfig().')
      return
    }

    assertValidWsUrl(config.wsUrl, 'init')

    console.info(`[SDKChat] SDK v${SDK_VERSION}`)

    currentConfig = config

    // ── Shadow DOM setup ────────────────────────────────────────────────────
    const themeMode = config.theme?.mode ?? 'light'
    const initialTheme = themeMode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : themeMode

    const { hostEl: host, mountPoint } = createShadowHost(initialTheme, config.customStyles)
    hostEl = host

    // Apply custom CSS variables if provided
    if (config.theme?.primaryColor) {
      host.style.setProperty('--sai-primary', config.theme.primaryColor)
    }
    if (config.theme?.borderRadius) {
      host.style.setProperty('--sai-radius', config.theme.borderRadius)
    }

    // Watch system theme if mode === 'auto'
    if (themeMode === 'auto') {
      cleanupThemeWatcher = watchSystemTheme(host)
    }

    // ── React mount ─────────────────────────────────────────────────────────
    root = createRoot(mountPoint)
    root.render(createElement(ChatWidget, { config }))
  },

  open(): void {
    useChatStore.getState().open()
  },

  close(): void {
    useChatStore.getState().close()
    currentConfig?.onClose?.()
  },

  setReference(text: string): void {
    useChatStore.getState().setReference(text)
  },

  clearReference(): void {
    useChatStore.getState().setReference(null)
  },

  updateConfig(partial: Partial<SDKConfig>): void {
    if (!root || !currentConfig) {
      console.warn('[SDKChat] Not initialized.')
      return
    }
    if ('wsUrl' in partial) {
      assertValidWsUrl(partial.wsUrl, 'updateConfig')
    }
    currentConfig = { ...currentConfig, ...partial }

    // Update theme if changed
    if (partial.theme?.mode && hostEl) {
      setTheme(hostEl, partial.theme.mode)
    }
    if (partial.theme?.primaryColor && hostEl) {
      hostEl.style.setProperty('--sai-primary', partial.theme.primaryColor)
    }

    root.render(createElement(ChatWidget, { config: currentConfig }))
  },

  connect(): void {
    bridgeConnect()
  },

  sendMessage(content: string, opts?: Pick<SendMessagePayload, 'attachments' | 'references' | 'workId'>): void {
    bridgeSendMessage(content, opts)
  },

  /** Refresh JWT (e.g. sau khi IAM cấp accessToken mới) — reconnect với token mới */
  updateToken(token: string): void {
    if (currentConfig) currentConfig = { ...currentConfig, token }
    bridgeUpdateToken(token)
  },

  getMessages() {
    return useChatStore.getState().messages
  },

  getPhase() {
    return useChatStore.getState().phase
  },

  destroy(): void {
    if (!root) return
    root.unmount()
    root = null
    hostEl?.remove()
    hostEl = null
    cleanupThemeWatcher?.()
    cleanupThemeWatcher = null
    currentConfig = null
    unregisterSendMessage()
    unregisterConnect()
    unregisterTyping()
    unregisterLoadOlder()
    unregisterUpdateToken()
    useChatStore.getState().reset()
  },
}

export default StackAIChat
