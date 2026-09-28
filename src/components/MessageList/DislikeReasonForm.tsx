import { useEffect, useId, useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { bridgeGetToken } from '../../sendMessageBridge'
import { defaultReasonSet, loadReactionReasons } from '../../services/reactionReasons'
import type { ReactionFeedback } from '../../types'

interface DislikeReasonFormProps {
  /** The viewer's existing feedback, used to pre-fill the form */
  initial?: ReactionFeedback | null
  /** The dislike is still being confirmed — feedback cannot be sent yet */
  pending?: boolean
  onSubmit: (feedback: Required<ReactionFeedback>) => void
  onCancel: () => void
}

/**
 * Shown after the user clicks 👎. Nothing reaches the server until "Gửi", which sends the
 * dislike together with the feedback; "Hủy" sends nothing. Also reused to edit the feedback
 * of an existing dislike, pre-filled with `initial`.
 */
export function DislikeReasonForm({ initial, pending = false, onSubmit, onCancel }: DislikeReasonFormProps) {
  const apiUrl = useChatStore((s) => s.config?.apiUrl)
  const configToken = useChatStore((s) => s.config?.token)
  const [reasonSet, setReasonSet] = useState(() => defaultReasonSet('dislike'))
  const [selected, setSelected] = useState<string[]>(initial?.reasons ?? [])
  const [comment, setComment] = useState(initial?.comment ?? '')
  // Several answers can have the form open at once, so the id must be unique
  const inputId = useId()

  useEffect(() => {
    let active = true
    void loadReactionReasons(apiUrl, bridgeGetToken() ?? configToken ?? null, 'dislike').then((set) => {
      if (active) setReasonSet(set)
    })
    return () => { active = false }
  }, [apiUrl, configToken])

  const { reasons, commentMaxLength, reasonsMax } = reasonSet
  const knownCodes = new Set(reasons.map((r) => r.code))
  // Drop codes the server no longer knows — sending one is a 400
  const validSelected = selected.filter((code) => knownCodes.has(code))
  // Picking "other" nudges (does not force) the user to explain in the comment
  const hint = validSelected.includes('other') ? reasons.find((r) => r.code === 'other')?.hint : undefined
  const canSubmit = !pending && (validSelected.length > 0 || comment.trim().length > 0)

  function toggle(code: string) {
    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code)
      if (prev.filter((c) => knownCodes.has(c)).length >= reasonsMax) return prev
      return [...prev, code]
    })
  }

  function submit() {
    if (!canSubmit) return
    // Send both keys so an edit can also clear a value the user removed
    onSubmit({ comment: comment.trim(), reasons: validSelected })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
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
      onKeyDown={handleKeyDown}
    >
      <span className="dislike-reason__label">Câu trả lời chưa tốt ở điểm nào?</span>
      <div className="dislike-reason__chips" role="group" aria-label="Lý do">
        {reasons.map((r) => {
          const active = validSelected.includes(r.code)
          return (
            <button
              key={r.code}
              type="button"
              className={`dislike-reason__chip${active ? ' is-active' : ''}`}
              aria-pressed={active}
              title={r.hint}
              disabled={!active && validSelected.length >= reasonsMax}
              onClick={() => toggle(r.code)}
            >
              {r.label}
            </button>
          )
        })}
      </div>
      <label className="dislike-reason__sr" htmlFor={inputId}>Góp ý thêm</label>
      <textarea
        id={inputId}
        className="dislike-reason__input"
        value={comment}
        maxLength={commentMaxLength}
        placeholder={hint ?? 'Góp ý thêm (không bắt buộc)...'}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="dislike-reason__footer">
        <span className="dislike-reason__count">{comment.length}/{commentMaxLength}</span>
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
