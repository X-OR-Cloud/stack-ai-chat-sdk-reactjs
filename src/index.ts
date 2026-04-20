import { createRoot, Root } from 'react-dom/client'
import { createElement } from 'react'
import { ChatWidget } from './ChatWidget'
import { useChatStore } from './store/chatStore'
import { bridgeSendMessage, unregisterSendMessage, bridgeConnect, unregisterConnect } from './sendMessageBridge'
import { createShadowHost, setTheme, watchSystemTheme } from './utils/shadowDom'
import type { SDKConfig } from './types'
import { version } from '../package.json'

// Re-export types for consumers
export type { SDKConfig, FieldConfig, ThemeConfig, AttachmentsConfig, SessionConfig, CustomStylesConfig, MessageType, Message } from './types'

let root: Root | null = null
let hostEl: HTMLElement | null = null
let cleanupThemeWatcher: (() => void) | null = null
let currentConfig: SDKConfig | null = null

export const StackAIChat = {
  init(config: SDKConfig): void {
    if (root) {
      console.warn('[StackAIChat] Already initialized. Call destroy() first or use updateConfig().')
      return
    }

    console.info(`[StackAIChat] SDK v${version}`)

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

  sendMessage(content: string): void {
    bridgeSendMessage(content)
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
    useChatStore.getState().reset()
  },
}

export default StackAIChat
