import { MAX_VOTE_COMMENT_LENGTH, MAX_VOTE_REASONS } from '../types'
import type { ReactionReason, VoteType } from '../types'

export interface ReactionReasonSet {
  reasons: ReactionReason[]
  commentMaxLength: number
  reasonsMax: number
}

/**
 * Copy of the label sets from `GET /reactions/reasons` (version 1). Used until the request
 * resolves, and for good when it cannot be made — no `apiUrl`, or an anonymous token the
 * REST guard rejects. The codes must stay in sync with the server: an unknown code is a 400.
 */
const DEFAULT_REASONS: Record<VoteType, ReactionReason[]> = {
  like: [
    { code: 'accurate', label: 'Chính xác' },
    { code: 'helpful', label: 'Hữu ích, giải quyết được vấn đề' },
    { code: 'well_formatted', label: 'Trình bày rõ ràng' },
    { code: 'good_source', label: 'Nguồn trích dẫn tốt' },
    { code: 'other', label: 'Khác' },
  ],
  dislike: [
    { code: 'inaccurate', label: 'Sai thông tin / bịa' },
    { code: 'incomplete', label: 'Thiếu, chưa trả lời hết' },
    { code: 'off_topic', label: 'Lạc đề, hiểu sai câu hỏi' },
    { code: 'not_following_instruction', label: 'Không làm đúng yêu cầu' },
    { code: 'bad_source', label: 'Trích nguồn sai / không liên quan' },
    { code: 'tool_failure', label: 'Không thực hiện được thao tác / gọi tool sai' },
    { code: 'bad_format', label: 'Trình bày khó đọc / quá dài' },
    { code: 'unsafe', label: 'Nội dung không phù hợp' },
    { code: 'other', label: 'Khác', hint: 'Vui lòng mô tả thêm trong góp ý' },
  ],
}

export function defaultReasonSet(type: VoteType): ReactionReasonSet {
  return { reasons: DEFAULT_REASONS[type], commentMaxLength: MAX_VOTE_COMMENT_LENGTH, reasonsMax: MAX_VOTE_REASONS }
}

function isReason(value: unknown): value is ReactionReason {
  const r = value as ReactionReason | null
  return !!r && typeof r.code === 'string' && typeof r.label === 'string'
}

function positive(value: unknown, fallback: number): number {
  return typeof value === 'number' && value > 0 ? value : fallback
}

// One request per apiUrl + type for the whole page; a failed request is not retried
const cache = new Map<string, Promise<ReactionReasonSet>>()

/** Loads the label set from `{apiUrl}/reactions/reasons`, falling back to the built-in copy */
export function loadReactionReasons(apiUrl: string | undefined, token: string | null, type: VoteType): Promise<ReactionReasonSet> {
  const base = apiUrl?.replace(/\/+$/, '')
  if (!base) return Promise.resolve(defaultReasonSet(type))

  const key = `${base}|${type}`
  let pending = cache.get(key)
  if (!pending) {
    pending = fetch(`${base}/reactions/reasons?type=${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((body: Record<string, unknown>) => {
        const list = Array.isArray(body?.[type]) ? (body[type] as unknown[]).filter(isReason) : []
        if (!list.length) return defaultReasonSet(type)
        const limits = (body.limits ?? {}) as Record<string, unknown>
        return {
          reasons: list,
          commentMaxLength: positive(limits.commentMaxLength, MAX_VOTE_COMMENT_LENGTH),
          reasonsMax: positive(limits.reasonsMax, MAX_VOTE_REASONS),
        }
      })
      .catch(() => defaultReasonSet(type))
    cache.set(key, pending)
  }
  return pending
}
