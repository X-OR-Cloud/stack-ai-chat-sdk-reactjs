// ─── Shared config <-> query-string codec ─────────────────────────────────────
// Dùng chung bởi DemoApp (encode khi bấm "Mở ở cửa sổ mới") và WidgetPreview
// (decode khi trang widget.html load). Chỉ 1 nơi biết cách serialize —
// tránh lặp logic parse ở 2 chỗ rồi lệch nhau (bài học từ ops-portal: 3 bản
// hàm parse URL, 2 bản sai).
//
// Format: 1 query param duy nhất `c` chứa base64url(JSON.stringify(config)).
// Đây KHÔNG phải mã hoá bảo mật — chỉ là encoding. Token trong config vẫn
// đọc được bằng cách decode base64 thủ công. Chấp nhận vì đây là tool nội bộ
// (SDK Playground), không phải sản phẩm public-facing.

import type { SDKConfig } from '../src/types'

/**
 * RegExp dùng để ẩn nội dung Knowledge Search / Retrieved chunks nội bộ.
 * Dùng chung bởi DemoApp.tsx (checkbox "hideKnowledgeSearch") và WidgetPreview.tsx
 * để 2 nơi luôn ẩn đúng cùng 1 tập pattern — tránh lặp mảng RegExp ở 2 chỗ.
 */
export const KNOWLEDGE_SEARCH_HIDDEN_PATTERNS: RegExp[] = [
  /^🧠\s?\*\*Knowledge Search\*\*/,
  /^Retrieved \d+ knowledge chunk/,
  /^No relevant knowledge found/,
]

/**
 * Subset serializable của SDKConfig dùng cho link chia sẻ.
 * Loại bỏ mọi callback (onOpen, onMessage, ...) vì function không JSON hoá được,
 * và loại bỏ hiddenPatterns (RegExp[] không JSON hoá được) — thay bằng cờ ý định
 * `hideKnowledgeSearch` để trang đích tự suy ra lại RegExp, giống DemoApp.tsx.
 */
export type ShareableConfig = Partial<Omit<
  SDKConfig,
  | 'onOpen' | 'onClose' | 'onConnected' | 'onConversationJoined' | 'onDisconnected'
  | 'onError' | 'onMessage' | 'onRawMessage' | 'onFormSubmit' | 'onPresenceUpdate'
  | 'hiddenPatterns' | 'tokenRefresh'
>> & {
  hideKnowledgeSearch?: boolean
}

function base64UrlEncode(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  return decodeURIComponent(escape(atob(b64)))
}

/** Encode config thành 1 query string (không kèm dấu `?`), ví dụ: `c=eyJ3c1VybCI6...` */
export function encodeConfigToQuery(config: ShareableConfig): string {
  const json = JSON.stringify(config)
  return `c=${base64UrlEncode(json)}`
}

/** Build full URL absolute cho trang widget.html cùng origin, kèm config đã encode. */
export function buildWidgetPreviewUrl(config: ShareableConfig): string {
  const base = new URL('widget.html', window.location.href)
  base.search = encodeConfigToQuery(config)
  return base.toString()
}

/**
 * Decode config từ query string hiện tại (window.location.search).
 * Trả về `null` nếu không có param `c` hoặc parse lỗi — caller phải tự
 * báo lỗi rõ ràng cho người dùng (không được im lặng).
 */
export function decodeConfigFromQuery(search: string): ShareableConfig | null {
  const params = new URLSearchParams(search)
  const c = params.get('c')
  if (!c) return null
  try {
    const json = base64UrlDecode(c)
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as ShareableConfig
  } catch {
    return null
  }
}
