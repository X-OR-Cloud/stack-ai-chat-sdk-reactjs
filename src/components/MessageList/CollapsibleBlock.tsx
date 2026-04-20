import { useState } from 'react'
import { renderMarkdown } from '../../utils/renderMarkdown'

interface CollapsibleBlockProps {
  icon: string
  label: string
  content: string
  defaultOpen?: boolean
}

export function CollapsibleBlock({ icon, label, content, defaultOpen = false }: CollapsibleBlockProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="collapsible-block">
      <button
        className={`collapsible-block__trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="collapsible-block__icon">{icon}</span>
        <span className="collapsible-block__label">{label}</span>
        <svg className="collapsible-block__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {open && (
        <div
          className="collapsible-block__body md-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}
    </div>
  )
}
