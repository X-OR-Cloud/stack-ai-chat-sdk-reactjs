import { SDK_STYLES } from '../styles/injectStyles'
import type { CustomStylesConfig } from '../types'

export function createShadowHost(themeAttr?: string, customStyles?: CustomStylesConfig): {
  hostEl: HTMLElement
  shadowRoot: ShadowRoot
  mountPoint: HTMLElement
} {
  const hostEl = document.createElement('div')
  hostEl.id = 'sai-chat-widget-host'
  if (themeAttr) hostEl.setAttribute('data-theme', themeAttr)
  document.body.appendChild(hostEl)

  const shadowRoot = hostEl.attachShadow({ mode: 'open' })

  // Inject all styles into Shadow Root so they are fully isolated
  const styleEl = document.createElement('style')
  styleEl.textContent = SDK_STYLES
  shadowRoot.appendChild(styleEl)

  // Inject custom styles after defaults so they can override
  if (customStyles) {
    const customCss = buildCustomCss(customStyles)
    if (customCss) {
      const customStyleEl = document.createElement('style')
      customStyleEl.id = 'sai-custom-styles'
      customStyleEl.textContent = customCss
      shadowRoot.appendChild(customStyleEl)
    }
  }

  const mountPoint = document.createElement('div')
  mountPoint.id = 'sai-chat-mount'
  shadowRoot.appendChild(mountPoint)

  return { hostEl, shadowRoot, mountPoint }
}

function buildCustomCss(styles: CustomStylesConfig): string {
  const parts: string[] = []
  if (styles.chatButton) parts.push(styles.chatButton)
  if (styles.chatWindow) parts.push(styles.chatWindow)
  if (styles.chatHeader) parts.push(styles.chatHeader)
  if (styles.messageList) parts.push(styles.messageList)
  if (styles.messageBubble) parts.push(styles.messageBubble)
  if (styles.messageInput) parts.push(styles.messageInput)
  if (styles.preChatForm) parts.push(styles.preChatForm)
  if (styles.typingIndicator) parts.push(styles.typingIndicator)
  if (styles.global) parts.push(styles.global)
  return parts.join('\n')
}

export function setTheme(hostEl: HTMLElement, mode: 'light' | 'dark' | 'auto') {
  if (mode === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    hostEl.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  } else {
    hostEl.setAttribute('data-theme', mode)
  }
}

export function watchSystemTheme(
  hostEl: HTMLElement,
  onChange?: (theme: 'light' | 'dark') => void
): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  function handler(e: MediaQueryListEvent) {
    const theme = e.matches ? 'dark' : 'light'
    hostEl.setAttribute('data-theme', theme)
    onChange?.(theme)
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
