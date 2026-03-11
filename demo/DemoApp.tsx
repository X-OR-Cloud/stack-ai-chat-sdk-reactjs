import { useState, useRef } from 'react'
import { StackAIChat } from '../src/index'
import type { FieldConfig } from '../src/types'

const DEFAULT_WS_URL = 'wss://skt.x-or.cloud/ws/chat'
const DEFAULT_TOKEN = ''
const DEFAULT_CONVERSATION_ID = '69b1897d7c01771e6fce5198'

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
  const [token, setToken]               = useState(DEFAULT_TOKEN)
  const [conversationId, setConversationId] = useState(DEFAULT_CONVERSATION_ID)
  const [title, setTitle]               = useState('Hỗ trợ khách hàng')
  const [subtitle, setSubtitle]         = useState('Thường trả lời trong vài phút')
  const [position, setPosition]         = useState<'bottom-right' | 'bottom-left'>('bottom-right')
  const [themeMode, setThemeMode]       = useState<'light' | 'dark' | 'auto'>('light')
  const [primaryColor, setPrimaryColor] = useState('#0066FF')
  const [persistSession, setPersistSession] = useState(true)
  const [attachEnabled, setAttachEnabled]   = useState(true)
  const [fields, setFields]             = useState<FieldRow[]>(DEFAULT_FIELDS)
  const [initialized, setInitialized]   = useState(false)
  const [log, setLog]                   = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  function addLog(msg: string) {
    setLog((prev) => {
      const next = [...prev, `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`]
      setTimeout(() => logRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
      return next
    })
  }

  function handleInit() {
    if (initialized) {
      StackAIChat.destroy()
      setInitialized(false)
      addLog('Widget destroyed.')
      return
    }

    if (!wsUrl || !token || !conversationId) {
      alert('Vui lòng điền đủ WS URL, Token và Conversation ID')
      return
    }

    const sdkFields: FieldConfig[] = fields
      .filter((f) => f.name.trim() && f.label.trim())
      .map(({ name, label, type, required }) => ({ name, label, type, required }))

    StackAIChat.init({
      wsUrl,
      token,
      conversationId,
      title,
      subtitle,
      position,
      fields: sdkFields,
      session: { persist: persistSession, ttl: 86400 },
      attachments: { enabled: attachEnabled, maxSize: 5, accept: ['image/*', 'application/pdf'], maxCount: 5 },
      theme: { mode: themeMode, primaryColor },
      onConnected:          () => addLog('✅ Socket connected'),
      onConversationJoined: (id) => addLog(`📨 emit conversation:join → ${id}`),
      onDisconnected:       () => addLog('🔌 Socket disconnected'),
      onError:              (msg) => addLog(`❌ Error: ${msg}`),
      onOpen:         () => addLog('📂 Widget opened'),
      onClose:        () => addLog('📁 Widget closed'),
      onFormSubmit:   (data) => addLog(`📋 Form submitted: ${JSON.stringify(data)}`),
      onMessage:      (msg) => addLog(`💬 New message [${msg.role}]: ${msg.content.slice(0, 60)}`),
    })

    setInitialized(true)
    addLog('🚀 Widget initialized')
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

  return (
    <div className="demo-layout">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="demo-sidebar">
        <div className="demo-logo-banner">
          <img src="./xor-stack-ai.png" alt="X-OR Stack AI" className="demo-logo-banner__img" />
        </div>
        <div className="demo-logo-divider" />
        <div className="demo-logo">
          <span className="demo-logo__icon">💬</span>
          <div>
            <div className="demo-logo__title">Stack AI Chat SDK</div>
            <div className="demo-logo__sub">Demo & Config Playground</div>
          </div>
        </div>

        <div className="demo-form">

          {/* Connection */}
          <section className="demo-section">
            <h3 className="demo-section__title">🔌 Kết nối</h3>

            <label className="demo-label">WebSocket URL</label>
            <input className="demo-input" value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} placeholder="wss://..." />

            <label className="demo-label">Token <span className="demo-required">*</span></label>
            <input className="demo-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />

            <label className="demo-label">Conversation ID <span className="demo-required">*</span></label>
            <input className="demo-input" value={conversationId} onChange={(e) => setConversationId(e.target.value)} placeholder="69b1897d..." />
          </section>

          {/* UI */}
          <section className="demo-section">
            <h3 className="demo-section__title">🎨 Giao diện</h3>

            <label className="demo-label">Tiêu đề</label>
            <input className="demo-input" value={title} onChange={(e) => setTitle(e.target.value)} />

            <label className="demo-label">Phụ đề</label>
            <input className="demo-input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />

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
              <button className="demo-btn demo-btn--ghost" onClick={() => { StackAIChat.open(); addLog('open() called') }}>Open</button>
              <button className="demo-btn demo-btn--ghost" onClick={() => { StackAIChat.close(); addLog('close() called') }}>Close</button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="demo-main">
        <div className="demo-preview-header">
          <h2>Preview</h2>
          <p>Widget sẽ xuất hiện ở góc {position === 'bottom-right' ? 'phải' : 'trái'} dưới màn hình sau khi khởi tạo.</p>
        </div>

        <div className="demo-mockup">
          <div className="demo-mockup__browser">
            <div className="demo-mockup__bar">
              <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
              <span className="demo-mockup__url">https://your-app.com</span>
            </div>
            <div className="demo-mockup__content">
              <div className="demo-mockup__page">
                <div className="demo-page-skeleton">
                  <div className="skel skel--nav" />
                  <div className="skel skel--hero" />
                  <div className="skel-row">
                    <div className="skel skel--card" />
                    <div className="skel skel--card" />
                    <div className="skel skel--card" />
                  </div>
                </div>
                {!initialized && (
                  <div className="demo-mockup__hint">
                    ← Điền thông tin và nhấn <strong>Khởi tạo Widget</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Event log */}
        <div className="demo-log-panel">
          <div className="demo-log-header">
            <span>📡 Event Log</span>
            <button className="demo-btn demo-btn--ghost demo-btn--xs" onClick={() => setLog([])}>Clear</button>
          </div>
          <div className="demo-log" ref={logRef}>
            {log.length === 0
              ? <span className="demo-log__empty">Chưa có sự kiện nào...</span>
              : log.map((l, i) => <div key={i} className="demo-log__line">{l}</div>)
            }
          </div>
        </div>
      </main>
    </div>
  )
}
