import { useEffect, useId, useRef, useState } from 'react'
import { MAX_VOTE_REASON_LENGTH } from '../../types'

interface DislikeReasonFormProps {
  onSubmit: (reason: string) => void
  onCancel: () => void
}

/**
 * Shown after the user clicks 👎. Nothing reaches the server until "Gửi" is pressed —
 * cancelling leaves the vote untouched.
 */
export function DislikeReasonForm({ onSubmit, onCancel }: DislikeReasonFormProps) {
  const [reason, setReason] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Several answers can have the form open at once, so the id must be unique
  const inputId = useId()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const canSubmit = reason.trim().length > 0

  function submit() {
    if (!canSubmit) return
    onSubmit(reason.trim())
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Stop the event here so the host page / chat input never sees these keys
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="dislike-reason"
      onSubmit={(e) => { e.preventDefault(); submit() }}
    >
      <label className="dislike-reason__label" htmlFor={inputId}>
        Câu trả lời chưa tốt ở điểm nào?
      </label>
      <textarea
        id={inputId}
        ref={inputRef}
        className="dislike-reason__input"
        value={reason}
        maxLength={MAX_VOTE_REASON_LENGTH}
        placeholder="Nhập lý do để chúng tôi cải thiện..."
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="dislike-reason__footer">
        <span className="dislike-reason__count">{reason.length}/{MAX_VOTE_REASON_LENGTH}</span>
        <div className="dislike-reason__buttons">
          <button type="button" className="dislike-reason__btn" onClick={onCancel}>
            Hủy
          </button>
          <button
            type="submit"
            className="dislike-reason__btn dislike-reason__btn--primary"
            disabled={!canSubmit}
          >
            Gửi
          </button>
        </div>
      </div>
    </form>
  )
}
