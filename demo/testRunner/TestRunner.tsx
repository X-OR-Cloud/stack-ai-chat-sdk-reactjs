import { useRef, useState } from 'react'
import type { SDKConfig } from '../../src/types'
import { DEFAULT_SYSTEM_PROMPT } from './defaultSystemPrompt'
import { Report } from './Report'
import type { LLMJudgeConfig, TestScenario } from './types'
import { useTestRunner } from './useTestRunner'

const DEFAULT_SCENARIO: TestScenario = {
  name: 'Basic flow test',
  description: 'Test kết nối, gửi tin và reload lịch sử hội thoại',
  skipForm: true,
  formData: { fullName: 'Test User', phone: '0901234567', idCard: '123456789' },
  messages: [
    { text: 'Xin chào, tôi muốn hỏi về sản phẩm', delayAfter: 8000 },
    { text: 'Cho tôi biết giá dịch vụ cơ bản', delayAfter: 8000 },
    { text: 'Cảm ơn bạn', delayAfter: 3000 },
  ],
  testReopen: true,
  reopenDelay: 2000,
}

interface Props {
  sdkConfig: Partial<SDKConfig>
}

export function TestRunner({ sdkConfig }: Props) {
  // LLM config
  const [llmEndpoint, setLlmEndpoint] = useState('https://api.openai.com/v1/chat/completions')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmModel, setLlmModel] = useState('gpt-4o')
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [showPrompt, setShowPrompt] = useState(false)

  // Scenario
  const [scenarioJson, setScenarioJson] = useState(JSON.stringify(DEFAULT_SCENARIO, null, 2))
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { status, liveEvents, result, run, reset } = useTestRunner()

  const llmConfig: LLMJudgeConfig = {
    endpoint: llmEndpoint,
    apiKey: llmApiKey,
    model: llmModel,
    systemPrompt,
  }

  function parseScenario(): TestScenario | null {
    try {
      const parsed = JSON.parse(scenarioJson)
      setScenarioError(null)
      return parsed as TestScenario
    } catch (e) {
      setScenarioError(`JSON không hợp lệ: ${e}`)
      return null
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setScenarioJson(text)
      setScenarioError(null)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleRun() {
    const scenario = parseScenario()
    if (!scenario) return
    run(scenario, sdkConfig)
  }

  function downloadScenarioTemplate() {
    const blob = new Blob([JSON.stringify(DEFAULT_SCENARIO, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'test-scenario.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const isRunning = status === 'running'

  return (
    <div className="tr-layout">
      {/* ── Left panel: config ─────────────────────────────────────────────── */}
      <div className="tr-panel tr-panel--left">

        {/* LLM Judge */}
        <section className="tr-section">
          <div className="tr-section__title">🤖 LLM Judge Config</div>

          <label className="demo-label">Endpoint (OpenAI-compatible)</label>
          <input
            className="demo-input"
            value={llmEndpoint}
            onChange={(e) => setLlmEndpoint(e.target.value)}
            placeholder="https://api.openai.com/v1/chat/completions"
          />

          <label className="demo-label">API Key</label>
          <input
            className="demo-input"
            type="password"
            value={llmApiKey}
            onChange={(e) => setLlmApiKey(e.target.value)}
            placeholder="sk-..."
          />

          <label className="demo-label">Model</label>
          <input
            className="demo-input"
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            placeholder="gpt-4o"
          />

          <button
            className="demo-btn demo-btn--ghost demo-btn--xs"
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
            onClick={() => setShowPrompt((v) => !v)}
          >
            {showPrompt ? '▲ Ẩn System Prompt' : '▼ Xem / Sửa System Prompt'}
          </button>

          {showPrompt && (
            <textarea
              className="demo-input demo-textarea"
              rows={12}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              spellCheck={false}
            />
          )}
        </section>

        {/* Scenario */}
        <section className="tr-section">
          <div className="tr-section__title">📋 Test Scenario</div>

          <div className="tr-scenario-actions">
            <button className="demo-btn demo-btn--ghost demo-btn--xs" onClick={() => fileInputRef.current?.click()}>
              📂 Upload JSON
            </button>
            <button className="demo-btn demo-btn--ghost demo-btn--xs" onClick={downloadScenarioTemplate}>
              ⬇ Download template
            </button>
            <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleUpload} />
          </div>

          <textarea
            className={`demo-input demo-textarea tr-scenario-editor ${scenarioError ? 'tr-scenario-editor--error' : ''}`}
            rows={18}
            value={scenarioJson}
            onChange={(e) => { setScenarioJson(e.target.value); setScenarioError(null) }}
            spellCheck={false}
          />

          {scenarioError && <div className="tr-error-inline">{scenarioError}</div>}

          <div className="tr-hint">
            <strong>Format:</strong> messages[].delayAfter = ms chờ sau mỗi tin.
            testReopen: true → destroy + reinit để test history.
          </div>
        </section>

        {/* Run */}
        <div className="tr-run-area">
          {isRunning ? (
            <div className="tr-running-badge">
              <span className="tr-spinner" /> Đang chạy test...
            </div>
          ) : (
            <button
              className="demo-btn demo-btn--primary"
              style={{ width: '100%' }}
              onClick={handleRun}
              disabled={isRunning}
            >
              ▶ Chạy Test
            </button>
          )}

          {(status === 'done' || status === 'error') && (
            <button className="demo-btn demo-btn--ghost" style={{ width: '100%' }} onClick={reset}>
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Right panel: live log + report ─────────────────────────────────── */}
      <div className="tr-panel tr-panel--right">

        {/* Live event log */}
        <div className="tr-section" style={{ flex: result ? '0 0 220px' : '1' }}>
          <div className="tr-section__title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>📡 Live Event Log {liveEvents.length > 0 && `(${liveEvents.length})`}</span>
            {status === 'done' && <span className="tr-badge tr-badge--done">Done</span>}
            {status === 'error' && <span className="tr-badge tr-badge--error">Error</span>}
            {status === 'running' && <span className="tr-badge tr-badge--running">Running</span>}
          </div>
          <div className="tr-live-log">
            {liveEvents.length === 0
              ? <span className="demo-log__empty">Chưa có event nào...</span>
              : liveEvents.map((ev) => (
                <div key={ev.id} className={`tr-live-line tr-live-line--${ev.kind.split(':')[0]}`}>
                  <span className="tr-live-ts">{new Date(ev.ts).toLocaleTimeString('vi-VN', { hour12: false })}</span>
                  <span className="tr-live-kind">{ev.kind}</span>
                  {ev.responseTimeMs != null && <span className="tr-live-rt">{ev.responseTimeMs}ms</span>}
                </div>
              ))
            }
          </div>
        </div>

        {/* Report */}
        {result && <Report result={result} llmConfig={llmConfig} />}
      </div>
    </div>
  )
}
