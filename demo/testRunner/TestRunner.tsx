import { useRef, useState } from 'react'
import type { SDKConfig } from '../../src/types'
import { Report } from './Report'
import type { CapturedEvent, LLMJudgeConfig, TestScenario } from './types'
import { useTestRunner } from './useTestRunner'

function summarizeEvent(ev: CapturedEvent): string {
  const d = ev.data as Record<string, unknown> | undefined
  switch (ev.kind) {
    case 'test:start':   return `Bắt đầu: "${String(d?.scenario ?? '')}"`
    case 'test:done':    return `Hoàn thành sau ${d?.durationMs}ms`
    case 'sdk:init':     return 'Widget khởi tạo'
    case 'sdk:destroy':  return 'Widget destroyed'
    case 'sdk:reopen':   return `Reopen  convId=${String(d?.conversationId ?? '?')}`
    case 'socket:connected':    return 'Kết nối socket thành công'
    case 'socket:disconnected': return 'Socket ngắt kết nối'
    case 'socket:error': return `Lỗi: ${String(d?.message ?? '')}`
    case 'conversation:joined': return `Joined ${String(d?.conversationId ?? '')}`
    case 'presence:update': {
      const p = ev.data as { type?: string; status?: string } | undefined
      return `[${p?.type ?? ''}] ${p?.status ?? ''}`
    }
    case 'form:submit':  return 'Form đã submit'
    case 'message:sent': return `→ "${String(d?.text ?? '').slice(0, 60)}"`
    case 'message:received': {
      const m = ev.data as { role?: string; type?: string; content?: string } | undefined
      return `← [${m?.role}/${m?.type}] ${m?.content?.slice(0, 60) ?? ''}`
    }
    case 'message:raw': {
      const r = ev.data as Record<string, unknown> | undefined
      return `RAW [${String(r?.role ?? '')}/${String(r?.type ?? '?')}]`
    }
    case 'history:loaded': return `Lịch sử: ${d?.count} tin nhắn`
    default: return ''
  }
}

interface Props {
  sdkConfig: Partial<SDKConfig>
  llmConfig: LLMJudgeConfig
  scenarioJson: string
}

export function TestRunner({ sdkConfig, llmConfig, scenarioJson }: Props) {
  const [parseError, setParseError] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const liveLogRef = useRef<HTMLDivElement>(null)

  const { status, liveEvents, result, run, reset, clearLiveLog } = useTestRunner()
  const isRunning = status === 'running'

  function handleRun() {
    try {
      const scenario = JSON.parse(scenarioJson) as TestScenario
      setParseError(null)
      run(scenario, sdkConfig)
    } catch (e) {
      setParseError(`Scenario JSON không hợp lệ: ${e}`)
    }
  }

  function copyLiveLog() {
    navigator.clipboard.writeText(JSON.stringify(liveEvents, null, 2)).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 1500)
    })
  }

  return (
    <div className="tr-main">

      {/* Action bar */}
      <div className="tr-action-row">
        <div className="tr-action-row__left">
          {isRunning ? (
            <div className="tr-running-badge">
              <span className="tr-spinner" /> Đang chạy test...
            </div>
          ) : (
            <button className="demo-btn demo-btn--primary" onClick={handleRun}>
              ▶ Chạy Test
            </button>
          )}
          {(status === 'done' || status === 'error') && (
            <button className="demo-btn demo-btn--ghost" onClick={reset}>↺ Reset</button>
          )}
        </div>
        <div className="tr-action-row__right">
          {status === 'running' && <span className="tr-badge tr-badge--running">Running</span>}
          {status === 'done'    && <span className="tr-badge tr-badge--done">Done</span>}
          {status === 'error'   && <span className="tr-badge tr-badge--error">Error</span>}
        </div>
      </div>

      {parseError && <div className="tr-error-inline">{parseError}</div>}

      {/* Live event log */}
      <div className="demo-log-panel tr-log-panel">
        <div className="demo-log-header">
          <span>
            📡 Live Event Log
            <span className="demo-log-count">{liveEvents.length > 0 ? ` (${liveEvents.length})` : ''}</span>
          </span>
          <div className="demo-log-actions">
            <button
              className="demo-btn demo-btn--ghost demo-btn--xs"
              onClick={copyLiveLog}
              disabled={liveEvents.length === 0}
              title="Copy log dạng JSON"
            >
              {copyFeedback ? '✅ Copied!' : '📋 Copy JSON'}
            </button>
            <button
              className="demo-btn demo-btn--ghost demo-btn--xs"
              onClick={clearLiveLog}
              disabled={isRunning || liveEvents.length === 0}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="demo-log tr-log-body" ref={liveLogRef}>
          {liveEvents.length === 0
            ? <span className="demo-log__empty">Chưa có event nào — nhấn ▶ Chạy Test để bắt đầu...</span>
            : liveEvents.map((ev) => (
              <div key={ev.id} className={`demo-log__line demo-log__line--${ev.kind.split(':')[0]}`}>
                <span className="demo-log__time">{new Date(ev.ts).toLocaleTimeString('vi-VN', { hour12: false })}</span>
                {' '}
                <span className="demo-log__kind">[{ev.kind}]</span>
                {' '}
                <span className="tr-log-summary">{summarizeEvent(ev)}</span>
                {ev.responseTimeMs != null && (
                  <span className="tr-live-rt" style={{ marginLeft: 8 }}>{ev.responseTimeMs}ms</span>
                )}
              </div>
            ))
          }
        </div>
      </div>

      {/* Report */}
      {result && <Report result={result} llmConfig={llmConfig} />}

    </div>
  )
}
