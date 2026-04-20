import { useState } from 'react'
import { marked } from 'marked'
import type { JudgeReport, LLMJudgeConfig, TestResult } from './types'
import { callLLMJudge } from './llmJudge'

interface Props {
  result: TestResult
  llmConfig: LLMJudgeConfig
}

function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string
  return html
    .replace(/✅/g, '<span class="tr-pass">✅</span>')
    .replace(/❌/g, '<span class="tr-fail">❌</span>')
    .replace(/⚠/g, '<span class="tr-warn">⚠</span>')
}

function StatCard({ label, value, unit = '', warn = false }: { label: string; value: string | number | null; unit?: string; warn?: boolean }) {
  return (
    <div className={`tr-stat-card ${warn ? 'tr-stat-card--warn' : ''}`}>
      <div className="tr-stat-card__value">{value == null ? '—' : `${value}${unit}`}</div>
      <div className="tr-stat-card__label">{label}</div>
    </div>
  )
}

export function Report({ result, llmConfig }: Props) {
  const [judging, setJudging] = useState(false)
  const [report, setReport] = useState<JudgeReport | null>(null)
  const [judgeError, setJudgeError] = useState<string | null>(null)
  const { stats } = result

  async function handleJudge() {
    if (!llmConfig.endpoint || !llmConfig.apiKey) {
      alert('Vui lòng điền LLM Endpoint và API Key trong phần cấu hình')
      return
    }
    setJudging(true)
    setJudgeError(null)
    try {
      const r = await callLLMJudge(llmConfig, result)
      setReport(r)
    } catch (err) {
      setJudgeError(String(err))
    } finally {
      setJudging(false)
    }
  }

  const durationSec = ((result.finishedAt - result.startedAt) / 1000).toFixed(1)

  return (
    <div className="tr-report">
      <div className="tr-report__header">
        <div>
          <div className="tr-report__title">Kết quả: {result.scenario.name}</div>
          <div className="tr-report__meta">
            {new Date(result.startedAt).toLocaleString('vi-VN')} · {durationSec}s
          </div>
        </div>
        <button
          className={`demo-btn demo-btn--primary ${judging ? 'demo-btn--loading' : ''}`}
          onClick={handleJudge}
          disabled={judging || !llmConfig.endpoint}
        >
          {judging ? '⏳ Đang phân tích...' : '🤖 Phân tích với LLM'}
        </button>
      </div>

      {/* Stats grid */}
      <div className="tr-stats-grid">
        <StatCard label="Tin user gửi" value={stats.userMessages} />
        <StatCard label="Phản hồi agent" value={stats.assistantMessages} />
        <StatCard label="Avg response" value={stats.avgResponseTimeMs} unit="ms" warn={(stats.avgResponseTimeMs ?? 0) > 8000} />
        <StatCard label="Min / Max" value={stats.minResponseTimeMs != null ? `${stats.minResponseTimeMs} / ${stats.maxResponseTimeMs}` : null} unit="ms" />
        <StatCard label="Lỗi" value={stats.errors} warn={stats.errors > 0} />
        <StatCard label="Filter violations" value={stats.visibleTypesViolations} warn={stats.visibleTypesViolations > 0} />
        {stats.historyMessageCount != null && (
          <StatCard label="History sau reopen" value={stats.historyMessageCount} unit=" msgs" />
        )}
      </div>

      {/* Events timeline */}
      <div className="tr-section">
        <div className="tr-section__title">Timeline events ({result.events.length})</div>
        <div className="tr-event-list">
          {result.events.map((ev) => (
            <div key={ev.id} className={`tr-event tr-event--${ev.kind.split(':')[0]}`}>
              <span className="tr-event__ts">{new Date(ev.ts).toLocaleTimeString('vi-VN', { hour12: false })}</span>
              <span className="tr-event__kind">{ev.kind}</span>
              {ev.responseTimeMs != null && (
                <span className="tr-event__rt">{ev.responseTimeMs}ms</span>
              )}
              {ev.data != null && (
                <span className="tr-event__data">
                  {typeof ev.data === 'object'
                    ? (() => {
                        const d = ev.data as Record<string, unknown>
                        if (d.content) return String(d.content).slice(0, 80)
                        if (d.text) return String(d.text).slice(0, 80)
                        if (d.message) return String(d.message)
                        if (d.conversationId) return `conv: ${d.conversationId}`
                        if (d.count != null) return `${d.count} messages`
                        return ''
                      })()
                    : String(ev.data).slice(0, 80)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* LLM Judge error */}
      {judgeError && (
        <div className="tr-error-box">❌ {judgeError}</div>
      )}

      {/* LLM Report */}
      {report && (
        <div className="tr-section">
          <div className="tr-section__title">
            Báo cáo LLM · {new Date(report.generatedAt).toLocaleTimeString('vi-VN')}
          </div>
          <div
            className="tr-report-md"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(report.markdown) }}
          />
        </div>
      )}
    </div>
  )
}
