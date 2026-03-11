import { SDK_STYLES } from '../styles/injectStyles'

export function createShadowHost(themeAttr?: string): {
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

  const mountPoint = document.createElement('div')
  mountPoint.id = 'sai-chat-mount'
  shadowRoot.appendChild(mountPoint)

  return { hostEl, shadowRoot, mountPoint }
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
