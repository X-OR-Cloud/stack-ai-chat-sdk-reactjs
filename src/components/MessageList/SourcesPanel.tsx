import { useState } from 'react'
import type { MessageSource } from '../../types'
import { renderMarkdown } from '../../utils/renderMarkdown'

function sourceIcon(type: MessageSource['type']) {
  switch (type) {
    case 'rag':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      )
    case 'web':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    case 'tool':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      )
    case 'memory':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      )
  }
}

function sourceLabel(source: MessageSource): string {
  if (source.label) return source.label
  switch (source.type) {
    case 'rag': return 'Tài liệu'
    case 'web': return source.url ? new URL(source.url).hostname : 'Web'
    case 'tool': return source.toolName ?? 'Tool'
    case 'memory': return 'Memory'
  }
}

interface SourceDetailModalProps {
  source: MessageSource
  onClose: () => void
}

function SourceDetailModal({ source, onClose }: SourceDetailModalProps) {
  return (
    <div className="source-modal-overlay" onClick={onClose}>
      <div className="source-modal" onClick={(e) => e.stopPropagation()}>
        <div className="source-modal__header">
          <div className="source-modal__icon">{sourceIcon(source.type)}</div>
          <span className="source-modal__title">{sourceLabel(source)}</span>
          {source.score !== undefined && (
            <span className="source-modal__score">{Math.round(source.score * 100)}%</span>
          )}
          <button className="source-modal__close" onClick={onClose} aria-label="Đóng">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {source.url && (
          <a className="source-modal__url" href={source.url} target="_blank" rel="noopener noreferrer">
            {source.url}
          </a>
        )}
        <div
          className="source-modal__content md-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(source.content) }}
        />
      </div>
    </div>
  )
}

interface SourcesPanelProps {
  sources: MessageSource[]
}

export function SourcesPanel({ sources }: SourcesPanelProps) {
  const [activeSource, setActiveSource] = useState<MessageSource | null>(null)

  if (!sources.length) return null

  return (
    <>
      <div className="sources-panel">
        <span className="sources-panel__label">Nguồn tham khảo:</span>
        <div className="sources-panel__chips">
          {sources.map((src, i) => (
            <button
              key={i}
              className="source-chip"
              onClick={() => setActiveSource(src)}
              title={sourceLabel(src)}
            >
              <span className="source-chip__icon">{sourceIcon(src.type)}</span>
              <span className="source-chip__label">{sourceLabel(src)}</span>
              {src.score !== undefined && (
                <span className="source-chip__score">{Math.round(src.score * 100)}%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeSource && (
        <SourceDetailModal source={activeSource} onClose={() => setActiveSource(null)} />
      )}
    </>
  )
}
