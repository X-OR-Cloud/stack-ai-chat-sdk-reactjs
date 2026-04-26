import { useState, useRef } from 'react'
import { StackAIChat } from '../src/index'
import { resolveSocketParams } from '../src/hooks/useSocket'
import type { Message, MessageType, PresenceUpdatePayload, SDKConfig } from '../src/types'
import { TestRunner } from './testRunner/TestRunner'
import xorStackAiLogo from './xor-stack-ai.png'

// ─── Log entry ────────────────────────────────────────────────────────────────

export type LogEventKind =
  | 'widget:init'
  | 'widget:destroy'
  | 'socket:connected'
  | 'socket:disconnected'
  | 'socket:error'
  | 'conversation:joined'
  | 'presence:update'
  | 'widget:open'
  | 'widget:close'
  | 'form:submit'
  | 'message:new'
  | 'message:raw'
  | 'reference:set'

export interface LogEntry {
  id: number
  ts: number               // Unix ms
  kind: LogEventKind
  // human-readable summary
  summary: string
  // structured payload — everything that could help debug
  data?: Record<string, unknown>
}

let _logSeq = 0

const DEFAULT_WS_URL = 'wss://skt.x-or.cloud/ws/chat'
const DEFAULT_TOKEN = ''

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

interface FieldRow {
  id: number
  name: string
  label: string
  type: 'text' | 'tel' | 'email' | 'number'
  required: boolean
}

let fieldRowCounter = 3

const DEFAULT_FIELDS: FieldRow[] = [
  { id: 1, name: 'fullName', label: 'Họ và tên',      type: 'text', required: true },
  { id: 2, name: 'phone',    label: 'Số điện thoại',   type: 'tel',  required: true },
  { id: 3, name: 'idCard',   label: 'CCCD',            type: 'text', required: false },
]

export function DemoApp() {
  const [wsUrl, setWsUrl]               = useState(DEFAULT_WS_URL)
  const [socketPath, setSocketPath]     = useState('')
  const [token, setToken]               = useState(DEFAULT_TOKEN)
  const [title, setTitle]               = useState('Hỗ trợ khách hàng')
  const [subtitle, setSubtitle]         = useState('Thường trả lời trong vài phút')
  const [greeting, setGreeting]         = useState('Xin chào! Tôi có thể giúp gì cho bạn?')
  const [position, setPosition]         = useState<'bottom-right' | 'bottom-left'>('bottom-right')
  const [themeMode, setThemeMode]       = useState<'light' | 'dark' | 'auto'>('light')
  const [primaryColor, setPrimaryColor] = useState('#0066FF')
  const [persistSession, setPersistSession] = useState(true)
  const [attachEnabled, setAttachEnabled]   = useState(true)
  const [showReferences, setShowReferences] = useState(true)
  const [maxInputLength, setMaxInputLength] = useState(1000)
  const [fields, setFields]             = useState<FieldRow[]>(DEFAULT_FIELDS)

  // Visible message types
  const ALL_MSG_TYPES = ['message', 'thinking', 'tool_use', 'tool_result', 'notice', 'system'] as const
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(['message']))
  function toggleType(type: string) {
    setVisibleTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) { if (next.size > 1) next.delete(type) } else next.add(type)
      return next
    })
  }

  // Hidden patterns
  const [hideKnowledgeSearch, setHideKnowledgeSearch] = useState(true)

  // Custom styles
  const [customStylesEnabled, setCustomStylesEnabled] = useState(false)
  const [customGlobalCss, setCustomGlobalCss] = useState(':host {\n  --sai-primary: #7c3aed;\n  --sai-primary-hover: #6d28d9;\n}')
  const [initialized, setInitialized]   = useState(false)
  const [log, setLog]                   = useState<LogEntry[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab]       = useState<'preview' | 'test'>('preview')
  const [copyFeedback, setCopyFeedback] = useState(false)

  const tokenInfo = decodeJwtPayload(token)

  function addLog(kind: LogEventKind, summary: string, data?: Record<string, unknown>) {
    setLog((prev) => {
      const entry: LogEntry = { id: ++_logSeq, ts: Date.now(), kind, summary, data }
      setTimeout(() => logRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
      return [...prev, entry]
    })
  }

  function copyLog() {
    const text = JSON.stringify(log, null, 2)
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 1500)
    })
  }

  function handleInit() {
    if (initialized) {
      StackAIChat.destroy()
      setInitialized(false)
      addLog('widget:destroy', '🗑 Widget destroyed')
      return
    }

    if (!wsUrl || !token) {
      alert('Vui lòng điền đủ WS URL và Token')
      return
    }

    StackAIChat.init({
      ...(sdkConfig as SDKConfig),
      onConnected: () => {
        const { serverOrigin, socketPath: effectivePath } = resolveSocketParams(wsUrl, socketPath.trim() || undefined)
        addLog('socket:connected', `✅ Socket connected  origin=${serverOrigin}  path=${effectivePath}`, {
          serverOrigin,
          socketPath: effectivePath,
        })
      },

      onConversationJoined: (id) =>
        addLog('conversation:joined', `📨 Conversation ready → ${id}`, { conversationId: id }),

      onPresenceUpdate: (p: PresenceUpdatePayload) =>
        addLog('presence:update', `👁 presence:update [${p.type}] ${p.status}`, {
          type: p.type,
          status: p.status,
          agentId: p.agentId,
          userId: p.userId,
          conversationId: p.conversationId,
          timestamp: p.timestamp,
        }),

      onDisconnected: () =>
        addLog('socket:disconnected', '🔌 Socket disconnected'),

      onError: (msg, detail) => {
        const { serverOrigin, socketPath: effectivePath } = resolveSocketParams(wsUrl, socketPath.trim() || undefined)
        addLog('socket:error', `❌ Error: ${msg}  origin=${serverOrigin}  path=${effectivePath}`, {
          message: msg,
          serverOrigin,
          socketPath: effectivePath,
          ...detail,
        })
      },

      onOpen: () =>
        addLog('widget:open', '📂 Widget opened'),

      onClose: () =>
        addLog('widget:close', '📁 Widget closed'),

      onFormSubmit: (data) =>
        addLog('form:submit', `📋 Form submitted`, { fields: data }),

      onMessage: (msg: Message) => {
        const sourcesInfo = msg.sources.length ? ` · ${msg.sources.length} src` : ''
        addLog('message:new', `💬 [${msg.role}/${msg.type}] ${msg.content.slice(0, 60)}${sourcesInfo}`, {
          messageId: msg.messageId,
          localId: msg.localId,
          conversationId: msg.conversationId,
          role: msg.role,
          type: msg.type,
          status: msg.status,
          contentLength: msg.content.length,
          contentPreview: msg.content.slice(0, 200),
          sourcesCount: msg.sources.length,
          sources: msg.sources,
          attachmentsCount: msg.attachments.length,
          timestamp: msg.timestamp,
        })
      },

      onRawMessage: (raw) => {
        const r = raw as Record<string, unknown>
        const content = typeof r.content === 'string' ? r.content : undefined
        addLog('message:raw', `🔍 RAW [${r.role}/${r.type ?? '?'}] skip=${r.skipAgent ?? false} id=${r._id ?? '?'}: ${content?.slice(0, 60) ?? ''}`, {
          _id: r._id,
          role: r.role,
          type: r.type,
          skipAgent: r.skipAgent,
          contentLength: content?.length,
          contentPreview: content?.slice(0, 200),
          conversationId: r.conversationId,
          timestamp: r.timestamp,
          sources: r.sources,
          attachments: r.attachments,
          extraKeys: Object.keys(r).filter(
            (k) => !['_id','role','type','skipAgent','content','conversationId','timestamp','sources','attachments'].includes(k)
          ),
          fullPayload: r,
        })
      },
    })

    setInitialized(true)
    addLog('widget:init', `🚀 Widget initialized v${StackAIChat.version}`, {
      version: StackAIChat.version,
      wsUrl,
      title: sdkConfig.title,
      position: sdkConfig.position ?? 'bottom-right',
      themeMode: sdkConfig.theme?.mode ?? 'light',
      primaryColor: sdkConfig.theme?.primaryColor,
      visibleMessageTypes: sdkConfig.visibleMessageTypes ?? ['message'],
      showReferences: sdkConfig.showReferences ?? true,
      attachmentsEnabled: sdkConfig.attachments?.enabled ?? false,
      fieldsCount: sdkConfig.fields?.length ?? 0,
      persistSession: sdkConfig.session?.persist ?? false,
      maxInputLength: sdkConfig.maxInputLength ?? 1000,
      greeting: sdkConfig.greeting,
    })
  }

  // ── Field editor ───────────────────────────────────────────────────────────

  function addField() {
    fieldRowCounter++
    setFields((prev) => [...prev, { id: fieldRowCounter, name: '', label: '', type: 'text', required: false }])
  }

  function removeField(id: number) {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  function updateField(id: number, key: keyof FieldRow, value: string | boolean) {
    setFields((prev) => prev.map((f) => f.id === id ? { ...f, [key]: value } : f))
  }

  const sdkConfig: Partial<SDKConfig> = {
    wsUrl,
    token,
    ...(socketPath.trim() ? { socketPath: socketPath.trim() } : {}),
    title,
    subtitle,
    position,
    fields: fields
      .filter((f) => f.name.trim() && f.label.trim())
      .map(({ name, label, type, required }) => ({ name, label, type, required })),
    session: { persist: persistSession, ttl: 86400 },
    attachments: { enabled: attachEnabled, maxSize: 5, accept: ['image/*', 'application/pdf'], maxCount: 5 },
    theme: { mode: themeMode, primaryColor },
    visibleMessageTypes: [...visibleTypes] as MessageType[],
    ...(hideKnowledgeSearch ? {
      hiddenPatterns: [
        /^🧠\s?\*\*Knowledge Search\*\*/,
        /^Retrieved \d+ knowledge chunk/,
        /^No relevant knowledge found/,
      ],
    } : {}),
    showReferences,
    maxInputLength,
    ...(greeting.trim() ? { greeting: greeting.trim() } : {}),
    ...(customStylesEnabled ? { customStyles: { global: customGlobalCss } } : {}),
  }

  return (
    <div className="demo-layout">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="demo-sidebar">
        <div className="demo-logo-banner">
          <img src={xorStackAiLogo} alt="X-OR Stack AI" className="demo-logo-banner__img" />
        </div>
        <div className="demo-logo-divider" />
        <div className="demo-logo">
          <span className="demo-logo__icon">💬</span>
          <div>
            <div className="demo-logo__title">
              Stack AI Chat SDK
              <span className="demo-version-badge">v{StackAIChat.version}</span>
            </div>
            <div className="demo-logo__sub">Demo & Config Playground</div>
          </div>
        </div>

        <div className="demo-form">

          {/* Connection */}
          <section className="demo-section">
            <h3 className="demo-section__title">🔌 Kết nối</h3>

            <label className="demo-label">WebSocket URL</label>
            <input className="demo-input" value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} placeholder="wss://..." />

            <label className="demo-label">Socket Path <span className="demo-hint">(tuỳ chọn, mặc định /socket.io)</span></label>
            <input className="demo-input" value={socketPath} onChange={(e) => setSocketPath(e.target.value)} placeholder="/socket.io" />

            <label className="demo-label">Token <span className="demo-required">*</span></label>
            <input className="demo-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token" />

            {tokenInfo && (
              <div className="demo-token-info">
                <div className="demo-token-info__row">
                  <span className="demo-token-info__key">type</span>
                  <span className={`demo-token-info__badge demo-token-info__badge--${String(tokenInfo.type ?? 'unknown')}`}>
                    {String(tokenInfo.type ?? 'unknown')}
                  </span>
                </div>
                {!!tokenInfo.sub    && <div className="demo-token-info__row"><span className="demo-token-info__key">sub</span><span className="demo-token-info__val">{String(tokenInfo.sub)}</span></div>}
                {!!tokenInfo.anonymousId && <div className="demo-token-info__row"><span className="demo-token-info__key">anonymousId</span><span className="demo-token-info__val">{String(tokenInfo.anonymousId)}</span></div>}
                {!!tokenInfo.agentId && <div className="demo-token-info__row"><span className="demo-token-info__key">agentId</span><span className="demo-token-info__val">{String(tokenInfo.agentId)}</span></div>}
                {!!tokenInfo.orgId   && <div className="demo-token-info__row"><span className="demo-token-info__key">orgId</span><span className="demo-token-info__val">{String(tokenInfo.orgId)}</span></div>}
                {!!tokenInfo.exp     && <div className="demo-token-info__row"><span className="demo-token-info__key">exp</span><span className="demo-token-info__val">{new Date(Number(tokenInfo.exp) * 1000).toLocaleString('vi-VN')}</span></div>}
              </div>
            )}
            {token && !tokenInfo && (
              <div className="demo-token-info demo-token-info--error">⚠ Token không hợp lệ</div>
            )}

          </section>

          {/* UI */}
          <section className="demo-section">
            <h3 className="demo-section__title">🎨 Giao diện</h3>

            <label className="demo-label">Tiêu đề</label>
            <input className="demo-input" value={title} onChange={(e) => setTitle(e.target.value)} />

            <label className="demo-label">Phụ đề</label>
            <input className="demo-input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />

            <label className="demo-label">Lời chào (greeting)</label>
            <input className="demo-input" value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Để trống nếu không dùng" />

            <div className="demo-row">
              <div className="demo-col">
                <label className="demo-label">Vị trí</label>
                <select className="demo-input" value={position} onChange={(e) => setPosition(e.target.value as 'bottom-right' | 'bottom-left')}>
                  <option value="bottom-right">Phải</option>
                  <option value="bottom-left">Trái</option>
                </select>
              </div>
              <div className="demo-col">
                <label className="demo-label">Theme</label>
                <select className="demo-input" value={themeMode} onChange={(e) => setThemeMode(e.target.value as 'light' | 'dark' | 'auto')}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto (OS)</option>
                </select>
              </div>
            </div>

            <label className="demo-label">Primary Color</label>
            <div className="demo-color-row">
              <input type="color" className="demo-color-picker" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              <input className="demo-input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1 }} />
            </div>
          </section>

          {/* Options */}
          <section className="demo-section">
            <h3 className="demo-section__title">⚙️ Tùy chọn</h3>

            <label className="demo-toggle">
              <input type="checkbox" checked={persistSession} onChange={(e) => setPersistSession(e.target.checked)} />
              <span>Lưu session (localStorage)</span>
            </label>

            <label className="demo-toggle">
              <input type="checkbox" checked={attachEnabled} onChange={(e) => setAttachEnabled(e.target.checked)} />
              <span>Cho phép đính kèm file</span>
            </label>

            <label className="demo-toggle">
              <input type="checkbox" checked={hideKnowledgeSearch} onChange={(e) => setHideKnowledgeSearch(e.target.checked)} />
              <span>Ẩn Knowledge Search / Retrieved chunks</span>
            </label>

            <label className="demo-toggle">
              <input type="checkbox" checked={showReferences} onChange={(e) => setShowReferences(e.target.checked)} />
              <span>Hiển thị tài liệu tham chiếu</span>
            </label>

            <label className="demo-label">Giới hạn ký tự input (max 2000)</label>
            <div className="demo-row" style={{ alignItems: 'center', gap: '8px' }}>
              <input
                type="range"
                min={100}
                max={2000}
                step={100}
                value={maxInputLength}
                onChange={(e) => setMaxInputLength(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ minWidth: '40px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{maxInputLength}</span>
            </div>
          </section>

          {/* Visible message types */}
          <section className="demo-section">
            <h3 className="demo-section__title">📡 Visible Message Types</h3>
            <p className="demo-hint">Chọn loại action từ WS hiển thị trên chat box</p>
            <div className="demo-type-grid">
              {ALL_MSG_TYPES.map((t) => (
                <label key={t} className="demo-toggle demo-toggle--chip">
                  <input type="checkbox" checked={visibleTypes.has(t)} onChange={() => toggleType(t)} />
                  <span className={`demo-chip ${visibleTypes.has(t) ? 'demo-chip--active' : ''}`}>{t}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Custom styles */}
          <section className="demo-section">
            <h3 className="demo-section__title">🎭 Custom Styles</h3>

            <label className="demo-toggle">
              <input type="checkbox" checked={customStylesEnabled} onChange={(e) => setCustomStylesEnabled(e.target.checked)} />
              <span>Bật custom CSS</span>
            </label>

            {customStylesEnabled && (
              <>
                <label className="demo-label">Global CSS (inject vào Shadow DOM)</label>
                <textarea
                  className="demo-input demo-textarea"
                  rows={5}
                  value={customGlobalCss}
                  onChange={(e) => setCustomGlobalCss(e.target.value)}
                  spellCheck={false}
                />
              </>
            )}
          </section>

          {/* Form fields */}
          <section className="demo-section">
            <h3 className="demo-section__title">📋 Fields Pre-chat Form</h3>

            {fields.map((field) => (
              <div key={field.id} className="demo-field-row">
                <input
                  className="demo-input demo-input--sm"
                  placeholder="name (key)"
                  value={field.name}
                  onChange={(e) => updateField(field.id, 'name', e.target.value)}
                />
                <input
                  className="demo-input demo-input--sm"
                  placeholder="Label hiển thị"
                  value={field.label}
                  onChange={(e) => updateField(field.id, 'label', e.target.value)}
                />
                <select
                  className="demo-input demo-input--xs"
                  value={field.type}
                  onChange={(e) => updateField(field.id, 'type', e.target.value)}
                >
                  <option value="text">text</option>
                  <option value="tel">tel</option>
                  <option value="email">email</option>
                  <option value="number">number</option>
                </select>
                <label className="demo-toggle demo-toggle--inline" title="Required">
                  <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, 'required', e.target.checked)} />
                  <span>*</span>
                </label>
                <button className="demo-btn-icon" onClick={() => removeField(field.id)} title="Xóa field">✕</button>
              </div>
            ))}

            <button className="demo-btn demo-btn--ghost" onClick={addField}>+ Thêm field</button>
          </section>

          {/* Init button */}
          <button
            className={`demo-btn demo-btn--primary ${initialized ? 'demo-btn--destroy' : ''}`}
            onClick={handleInit}
          >
            {initialized ? '🗑 Destroy Widget' : '🚀 Khởi tạo Widget'}
          </button>

          {initialized && (
            <div className="demo-quick-actions">
              <button className="demo-btn demo-btn--ghost" onClick={() => { StackAIChat.open(); addLog('widget:open', '📂 open() called manually') }}>Open</button>
              <button className="demo-btn demo-btn--ghost" onClick={() => { StackAIChat.close(); addLog('widget:close', '📁 close() called manually') }}>Close</button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="demo-main">

        {/* Tabs */}
        <div className="demo-tabs">
          <button
            className={`demo-tab ${activeTab === 'preview' ? 'demo-tab--active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            👁 Preview
          </button>
          <button
            className={`demo-tab ${activeTab === 'test' ? 'demo-tab--active' : ''}`}
            onClick={() => setActiveTab('test')}
          >
            🧪 Test Runner
          </button>
        </div>

        {activeTab === 'preview' && (
          <>
            <div className="demo-preview-header">
              <p>
                Widget xuất hiện góc {position === 'bottom-right' ? 'phải' : 'trái'} dưới màn hình.
                {initialized && <> <strong>Bôi đen đoạn văn bản</strong> bất kỳ bên dưới để gửi tham chiếu vào chat.</>}
              </p>
            </div>

            <div className="demo-mockup">
              <div className="demo-mockup__browser">
                <div className="demo-mockup__bar">
                  <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
                  <span className="demo-mockup__url">https://your-app.com</span>
                </div>
                <div className="demo-mockup__content">
                  <div className="demo-mockup__page">
                    <div
                      className="demo-sample-page"
                      onMouseUp={() => {
                        if (!initialized) return
                        const sel = window.getSelection()
                        const text = sel?.toString().trim()
                        if (text) {
                          StackAIChat.setReference(text)
                          StackAIChat.open()
                          addLog('reference:set', `📌 Reference set: "${text.slice(0, 50)}${text.length > 50 ? '…' : ''}"`, { text, length: text.length })
                          sel?.removeAllRanges()
                        }
                      }}
                    >
                      <nav className="demo-page__nav">
                        <span className="demo-page__brand">⚡ Your Company</span>
                        <span className="demo-page__navlinks">Sản phẩm · Giá cả · Tài liệu · Blog</span>
                      </nav>

                      <section className="demo-page__hero">
                        <h1>Nền tảng AI thông minh cho doanh nghiệp</h1>
                        <p>Tự động hóa quy trình, nâng cao trải nghiệm khách hàng và tăng hiệu suất vận hành với giải pháp AI toàn diện của chúng tôi.</p>
                        <div className="demo-page__cta-row">
                          <button className="demo-page__cta demo-page__cta--primary">Dùng thử miễn phí</button>
                          <button className="demo-page__cta demo-page__cta--ghost">Xem demo</button>
                        </div>
                      </section>

                      <section className="demo-page__cards">
                        <div className="demo-page__card">
                          <div className="demo-page__card-icon">🤖</div>
                          <h3>AI Chatbot</h3>
                          <p>Triển khai chatbot thông minh hỗ trợ khách hàng 24/7, tích hợp đa kênh và xử lý ngôn ngữ tự nhiên tiếng Việt.</p>
                        </div>
                        <div className="demo-page__card">
                          <div className="demo-page__card-icon">📊</div>
                          <h3>Phân tích dữ liệu</h3>
                          <p>Dashboard thời gian thực với báo cáo chi tiết về hiệu suất, xu hướng khách hàng và cơ hội tăng trưởng doanh thu.</p>
                        </div>
                        <div className="demo-page__card">
                          <div className="demo-page__card-icon">🔗</div>
                          <h3>Tích hợp linh hoạt</h3>
                          <p>Kết nối dễ dàng với CRM, ERP và hơn 200 ứng dụng phổ biến thông qua API RESTful và webhook tiêu chuẩn.</p>
                        </div>
                      </section>

                      {!initialized && (
                        <div className="demo-mockup__hint">
                          ← Điền thông tin và nhấn <strong>Khởi tạo Widget</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Event log */}
            <div className="demo-log-panel">
              <div className="demo-log-header">
                <span>📡 Event Log <span className="demo-log-count">{log.length > 0 ? `(${log.length})` : ''}</span></span>
                <div className="demo-log-actions">
                  <button
                    className="demo-btn demo-btn--ghost demo-btn--xs"
                    onClick={copyLog}
                    disabled={log.length === 0}
                    title="Copy toàn bộ log dạng JSON array để debug"
                  >
                    {copyFeedback ? '✅ Copied!' : '📋 Copy JSON'}
                  </button>
                  <button className="demo-btn demo-btn--ghost demo-btn--xs" onClick={() => setLog([])}>Clear</button>
                </div>
              </div>
              <div className="demo-log" ref={logRef}>
                {log.length === 0
                  ? <span className="demo-log__empty">Chưa có sự kiện nào...</span>
                  : log.map((entry) => (
                    <div key={entry.id} className={`demo-log__line demo-log__line--${entry.kind.split(':')[0]}`}>
                      <span className="demo-log__time">{new Date(entry.ts).toLocaleTimeString('vi-VN')}</span>
                      {' '}
                      <span className="demo-log__kind">[{entry.kind}]</span>
                      {' '}
                      {entry.summary}
                    </div>
                  ))
                }
              </div>
            </div>
          </>
        )}

        {activeTab === 'test' && (
          <TestRunner sdkConfig={sdkConfig} />
        )}

      </main>
    </div>
  )
}
