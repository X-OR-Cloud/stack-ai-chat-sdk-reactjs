import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'

interface StreamTarget {
  actionId: string
  content: string
}

export interface SmoothStream {
  actionId: string
  content: string
}

/** Default reveal pace when the server is not the bottleneck (config.streaming.wordsPerSecond) */
export const DEFAULT_WORDS_PER_SECOND = 10

// Reveal cadence — lower is smoother but runs renderMarkdown more often
const TICK_MS = 100
// For every N unrevealed characters (backlog), reveal +1 word per tick to catch up with the server
const CATCHUP_CHARS_PER_WORD = 120
// Once the server has finalized, reveal the remainder faster so the final bubble swaps in sooner
const FINISHING_EXTRA_WORDS = 2

// Invalid/missing → default; 0 means smoothing is disabled
function resolveWordsPerSecond(v: number | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return DEFAULT_WORDS_PER_SECOND
  return v
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'
}

// End position of the next word starting at pos — split on whitespace to reveal word by word
function nextWordEnd(text: string, pos: number): number {
  const len = text.length
  let i = pos
  while (i < len && isSpace(text[i])) i++
  while (i < len && !isSpace(text[i])) i++
  return i
}

/**
 * Smooths streaming: `streaming` from the store is the real content received so far
 * (per chunk); the hook returns the displayed content, revealed word by word. When the
 * store sets it to null (final message arrived) the hook keeps revealing the remainder
 * before returning null — the caller keeps the streaming bubble until then to avoid a
 * layout jump.
 *
 * Pace comes from `config.streaming.wordsPerSecond`; `0` returns the store content as-is
 * (previous behaviour: paint each chunk on arrival).
 */
export function useSmoothStream(streaming: StreamTarget | null): SmoothStream | null {
  const smooth = useChatStore((s) => resolveWordsPerSecond(s.config?.streaming?.wordsPerSecond) > 0)
  const [shown, setShown] = useState<SmoothStream | null>(null)
  const targetRef = useRef<StreamTarget | null>(null)
  const shownLenRef = useRef(0)
  const shownTextRef = useRef('')
  // Fractional words carried over between ticks (e.g. 15 wps at 100ms = 1.5 words/tick)
  const carryRef = useRef(0)
  const finishingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!smooth) return
    if (streaming) {
      if (targetRef.current?.actionId !== streaming.actionId) {
        // New stream (or the first one) — start from scratch
        shownLenRef.current = 0
        shownTextRef.current = ''
        carryRef.current = 0
        setShown({ actionId: streaming.actionId, content: '' })
      }
      targetRef.current = streaming
      finishingRef.current = false
    } else if (targetRef.current) {
      finishingRef.current = true
    }

    if (timerRef.current !== null) return

    const tick = () => {
      const target = targetRef.current
      if (!target) {
        timerRef.current = null
        return
      }

      const text = target.content
      // Guard against the target changing in the middle (a late chunk inserted before
      // already-revealed text): fall back to the common prefix and re-reveal from there
      // instead of showing mismatched text
      if (!text.startsWith(shownTextRef.current)) {
        let k = 0
        const prev = shownTextRef.current
        while (k < prev.length && k < text.length && prev[k] === text[k]) k++
        shownLenRef.current = k
        shownTextRef.current = text.slice(0, k)
      }
      const backlog = text.length - shownLenRef.current

      if (backlog > 0) {
        // Read config on every tick (no caching) so updateConfig() takes effect immediately
        const wps = resolveWordsPerSecond(useChatStore.getState().config?.streaming?.wordsPerSecond)
        const budget = carryRef.current
          + wps * (TICK_MS / 1000)
          + Math.floor(backlog / CATCHUP_CHARS_PER_WORD)
          + (finishingRef.current ? FINISHING_EXTRA_WORDS : 0)
        let words = Math.floor(budget)
        carryRef.current = budget - words
        let pos = shownLenRef.current
        while (words-- > 0 && pos < text.length) pos = nextWordEnd(text, pos)
        shownLenRef.current = pos
        shownTextRef.current = text.slice(0, pos)
        setShown({ actionId: target.actionId, content: shownTextRef.current })
      } else if (finishingRef.current) {
        // Everything revealed and the server has finalized → hand over to the final message
        targetRef.current = null
        shownLenRef.current = 0
        shownTextRef.current = ''
        carryRef.current = 0
        finishingRef.current = false
        setShown(null)
        timerRef.current = null
        return
      }

      timerRef.current = setTimeout(tick, TICK_MS)
    }

    timerRef.current = setTimeout(tick, TICK_MS)
  }, [streaming, smooth])

  // Unmount → stop the ticker
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Smoothing disabled → return store content as-is (previous behaviour: paint each chunk on arrival)
  return smooth ? shown : streaming
}
