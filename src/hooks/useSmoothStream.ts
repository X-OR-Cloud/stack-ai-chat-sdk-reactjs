import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import type { StreamingConfig } from '../types'

interface StreamTarget {
  actionId: string
  content: string
}

export interface SmoothStream {
  actionId: string
  content: string
}

export const DEFAULT_STREAMING_CONFIG: Required<StreamingConfig> = {
  smooth: true,
  // Reveal cadence — lower is smoother but runs renderMarkdown more often
  tickMs: 100,
  wordsPerTick: 1,
  // For every N unrevealed characters (backlog), reveal +1 word per tick to catch up with the server
  catchupCharsPerWord: 120,
  // Once the server has finalized, reveal the remainder faster so the final bubble swaps in sooner
  finishingExtraWords: 2,
}

// Read config on every tick (no caching) so updateConfig() takes effect at runtime immediately
function resolveStreamingConfig(): Required<StreamingConfig> {
  const cfg = useChatStore.getState().config?.streaming
  const num = (v: number | undefined, def: number, min: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min ? v : def
  return {
    smooth: cfg?.smooth ?? DEFAULT_STREAMING_CONFIG.smooth,
    tickMs: num(cfg?.tickMs, DEFAULT_STREAMING_CONFIG.tickMs, 8),
    wordsPerTick: num(cfg?.wordsPerTick, DEFAULT_STREAMING_CONFIG.wordsPerTick, 1),
    catchupCharsPerWord: num(cfg?.catchupCharsPerWord, DEFAULT_STREAMING_CONFIG.catchupCharsPerWord, 1),
    finishingExtraWords: num(cfg?.finishingExtraWords, DEFAULT_STREAMING_CONFIG.finishingExtraWords, 0),
  }
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
 * Tuning comes from `config.streaming` (see DEFAULT_STREAMING_CONFIG); `smooth: false`
 * returns the store content as-is (previous behaviour: paint each chunk on arrival).
 */
export function useSmoothStream(streaming: StreamTarget | null): SmoothStream | null {
  const smooth = useChatStore((s) => s.config?.streaming?.smooth ?? DEFAULT_STREAMING_CONFIG.smooth)
  const [shown, setShown] = useState<SmoothStream | null>(null)
  const targetRef = useRef<StreamTarget | null>(null)
  const shownLenRef = useRef(0)
  const shownTextRef = useRef('')
  const finishingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!smooth) return
    if (streaming) {
      if (targetRef.current?.actionId !== streaming.actionId) {
        // New stream (or the first one) — start from scratch
        shownLenRef.current = 0
        shownTextRef.current = ''
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

      const opts = resolveStreamingConfig()
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
        let words = opts.wordsPerTick + Math.floor(backlog / opts.catchupCharsPerWord)
        if (finishingRef.current) words += opts.finishingExtraWords
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
        finishingRef.current = false
        setShown(null)
        timerRef.current = null
        return
      }

      timerRef.current = setTimeout(tick, opts.tickMs)
    }

    timerRef.current = setTimeout(tick, resolveStreamingConfig().tickMs)
  }, [streaming, smooth])

  // Unmount → stop the ticker
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Smooth disabled → return store content as-is (previous behaviour: paint each chunk on arrival)
  return smooth ? shown : streaming
}
