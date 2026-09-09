import { useCallback } from 'react'
import { useChatStore } from '../store/chatStore'
import { bridgeToggleReaction, bridgeGetToken } from '../sendMessageBridge'
import { redactValue, truncateForDisplay } from '../utils/redact'
import type { VoteType, ReactionToggleAck } from '../types'

/**
 * `actionId` is the message `_id`. Rejecting malformed ids on the client keeps the
 * greeting (which only has a `localId`) and the streaming bubble from reaching the server.
 */
const OBJECT_ID = /^[0-9a-fA-F]{24}$/

export function isVotableId(id: string | undefined): boolean {
  return !!id && OBJECT_ID.test(id)
}

// Docs §7: the server allows 10 toggles per 10s per socket and asks clients to
// debounce by ~300ms. `votePending` already blocks double-clicks on the SAME message;
// this guard covers rapid clicks spread across different messages.
const MIN_TOGGLE_INTERVAL_MS = 300
let lastToggleAt = 0

// If the ACK never arrives (zombie socket), release the button instead of locking it forever.
const ACK_TIMEOUT_MS = 10_000

/**
 * Errors that are permanent for the current session — retrying fails identically, so hide
 * the buttons rather than let the user keep clicking. Rate limiting is NOT one of these:
 * it is transient and the buttons must stay usable.
 */
const FATAL_ERROR_PATTERNS = [
  /not available for agent clients/i,
  /unauthenticated socket/i,
  /invalid token payload/i,
]

function isFatalError(error: string | undefined): boolean {
  return !!error && FATAL_ERROR_PATTERNS.some((re) => re.test(error))
}

export function useVote() {
  const config = useChatStore((s) => s.config)
  const setReaction = useChatStore((s) => s.setReaction)
  const setVotingUnavailable = useChatStore((s) => s.setVotingUnavailable)

  const reportError = useCallback((message: string, detail?: Record<string, unknown>) => {
    // Redact FIRST, truncate AFTER — see src/utils/redact.ts
    const tokens = [bridgeGetToken(), config?.token].filter(Boolean) as string[]
    const safeMessage = truncateForDisplay(redactValue(message, tokens)) as string
    const safeDetail = detail
      ? (truncateForDisplay(redactValue(detail, tokens)) as Record<string, unknown>)
      : undefined
    if (config?.onError) config.onError(safeMessage, safeDetail)
    else console.error('[SDKChat]', safeMessage, safeDetail ?? '')
  }, [config])

  const vote = useCallback((actionId: string, type: VoteType) => {
    if (!config?.voting?.enabled) return
    if (!isVotableId(actionId)) return

    const state = useChatStore.getState()
    if (state.votingUnavailable) return

    const conversationId = state.conversationId
    if (!conversationId) return

    const target = state.messages.find((m) => m.messageId === actionId)
    if (!target || target.votePending) return

    const now = Date.now()
    if (now - lastToggleAt < MIN_TOGGLE_INTERVAL_MS) return
    lastToggleAt = now

    const previous = target.userReaction ?? null
    // Predict the server's toggle rule (§5) so the UI responds instantly, but the FINAL
    // state always comes from the ACK — never derived locally.
    const optimistic: VoteType | null = previous === type ? null : type

    setReaction(actionId, { userReaction: optimistic, votePending: true })

    let settled = false
    const rollback = () => setReaction(actionId, { userReaction: previous, votePending: false })

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      // destroy() / a new conversation wipes the message list while the vote is in flight.
      // rollback() is already a no-op then; do not wake the host with a phantom error either.
      const stillPresent = useChatStore.getState().messages.some((m) => m.messageId === actionId)
      if (!stillPresent) return
      rollback()
      reportError('Không gửi được vote: server không phản hồi sau 10s')
    }, ACK_TIMEOUT_MS)

    bridgeToggleReaction({ conversationId, actionId, type }, (ack: ReactionToggleAck | undefined) => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      if (!ack?.success) {
        // §12: always roll back when success === false, otherwise the UI drifts from the server
        rollback()
        const error = ack?.error ?? 'lỗi không xác định'
        if (isFatalError(error)) setVotingUnavailable(true)
        reportError(`Không gửi được vote: ${error}`, { error })
        return
      }

      // The ACK is the source of truth for both userReaction and the counts
      const confirmed = ack.userReaction ?? null
      setReaction(actionId, {
        userReaction: confirmed,
        ...(typeof ack.likes === 'number' ? { likes: ack.likes } : {}),
        ...(typeof ack.dislikes === 'number' ? { dislikes: ack.dislikes } : {}),
        votePending: false,
      })
      config.onVote?.({
        actionId,
        vote: confirmed,
        action: ack.resultAction ?? 'created',
        likes: ack.likes,
        dislikes: ack.dislikes,
      })
    })
  }, [config, setReaction, setVotingUnavailable, reportError])

  return { vote }
}
