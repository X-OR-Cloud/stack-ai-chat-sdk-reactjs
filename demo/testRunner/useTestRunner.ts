import { useCallback, useRef, useState } from 'react'
import { StackAIChat } from '../../src/index'
import type { SDKConfig } from '../../src/types'
import type {
  CapturedEvent,
  EventKind,
  TestResult,
  TestScenario,
  TestStats,
} from './types'

let eventCounter = 0

function makeEvent(kind: EventKind, data?: unknown, responseTimeMs?: number): CapturedEvent {
  return { id: ++eventCounter, ts: Date.now(), kind, data, responseTimeMs }
}

function computeStats(
  events: CapturedEvent[],
  sdkConfig: Partial<SDKConfig>,
  historyAfterReopen?: Message[],
): TestStats {
  const sent = events.filter((e) => e.kind === 'message:sent')
  const received = events.filter((e) => e.kind === 'message:received')
  const responseTimes = received
    .map((e) => e.responseTimeMs)
    .filter((t): t is number => t != null)

  const userMessages = sent.length
  const assistantMessages = received.filter((e) => {
    const d = e.data as { role?: string } | undefined
    return d?.role === 'assistant'
  }).length

  const visibleTypes = sdkConfig.visibleMessageTypes ?? ['message']
  const visibleTypesViolations = received.filter((e) => {
    const d = e.data as { type?: string } | undefined
    return d?.type && !visibleTypes.includes(d.type as any)
  }).length

  return {
    totalMessages: userMessages + assistantMessages,
    userMessages,
    assistantMessages,
    avgResponseTimeMs: responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null,
    maxResponseTimeMs: responseTimes.length ? Math.max(...responseTimes) : null,
    minResponseTimeMs: responseTimes.length ? Math.min(...responseTimes) : null,
    errors: events.filter((e) => e.kind === 'socket:error').length,
    historyMessageCount: historyAfterReopen?.length ?? null,
    visibleTypesViolations,
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export type RunnerStatus = 'idle' | 'running' | 'done' | 'error'

export function useTestRunner() {
  const [status, setStatus] = useState<RunnerStatus>('idle')
  const [liveEvents, setLiveEvents] = useState<CapturedEvent[]>([])
  const [result, setResult] = useState<TestResult | null>(null)
  const eventsRef = useRef<CapturedEvent[]>([])
  const lastSentTsRef = useRef<number | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const connectedResolveRef = useRef<(() => void) | null>(null)
  const conversationResolveRef = useRef<(() => void) | null>(null)

  const pushEvent = useCallback((ev: CapturedEvent) => {
    eventsRef.current = [...eventsRef.current, ev]
    setLiveEvents([...eventsRef.current])
  }, [])

  const run = useCallback(
    async (scenario: TestScenario, sdkConfig: Partial<SDKConfig>) => {
      if (!sdkConfig.wsUrl || !sdkConfig.token) {
        alert('Cần có wsUrl và token trong SDK config để chạy test')
        return
      }

      setStatus('running')
      setResult(null)
      eventsRef.current = []
      conversationIdRef.current = null
      lastSentTsRef.current = null
      setLiveEvents([])

      const startedAt = Date.now()
      pushEvent(makeEvent('test:start', { scenario: scenario.name }))

      // ── Build SDK config with test interceptors ──────────────────────────────

      const connectedPromise = new Promise<void>((resolve) => {
        connectedResolveRef.current = resolve
      })
      const conversationPromise = new Promise<void>((resolve) => {
        conversationResolveRef.current = resolve
      })

      const testConfig: SDKConfig = {
        ...(sdkConfig as SDKConfig),
        onConnected: () => {
          pushEvent(makeEvent('socket:connected'))
          connectedResolveRef.current?.()
          ;(sdkConfig as SDKConfig).onConnected?.()
        },
        onDisconnected: () => {
          pushEvent(makeEvent('socket:disconnected'))
          ;(sdkConfig as SDKConfig).onDisconnected?.()
        },
        onError: (msg) => {
          pushEvent(makeEvent('socket:error', { message: msg }))
          ;(sdkConfig as SDKConfig).onError?.(msg)
        },
        onConversationJoined: (id) => {
          conversationIdRef.current = id
          pushEvent(makeEvent('conversation:joined', { conversationId: id }))
          conversationResolveRef.current?.()
          ;(sdkConfig as SDKConfig).onConversationJoined?.(id)
        },
        onPresenceUpdate: (p) => {
          pushEvent(makeEvent('presence:update', p))
          ;(sdkConfig as SDKConfig).onPresenceUpdate?.(p)
        },
        onFormSubmit: (data) => {
          pushEvent(makeEvent('form:submit', data))
          ;(sdkConfig as SDKConfig).onFormSubmit?.(data)
        },
        onMessage: (msg) => {
          const responseTimeMs =
            lastSentTsRef.current != null ? Date.now() - lastSentTsRef.current : undefined
          pushEvent(makeEvent('message:received', msg, responseTimeMs))
          lastSentTsRef.current = null
          ;(sdkConfig as SDKConfig).onMessage?.(msg)
        },
        onRawMessage: (raw) => {
          pushEvent(makeEvent('message:raw', raw))
          ;(sdkConfig as SDKConfig).onRawMessage?.(raw)
        },
      }

      try {
        // ── Init SDK ────────────────────────────────────────────────────────────
        StackAIChat.destroy()
        StackAIChat.init(testConfig)
        pushEvent(makeEvent('sdk:init', { config: sdkConfig }))
        StackAIChat.open()

        // ── Handle connection ───────────────────────────────────────────────────
        await sleep(600) // wait for React to mount ChatWindow + register connect bridge

        if (scenario.skipForm) {
          // Bypass form, connect directly
          StackAIChat.connect()
        } else if (scenario.formData) {
          // Auto-fill + submit form via Shadow DOM
          await sleep(400)
          const host = document.getElementById('sai-chat-widget-host')
          const shadow = host?.shadowRoot
          if (shadow) {
            for (const [name, value] of Object.entries(scenario.formData)) {
              const input = shadow.querySelector(`input[name="${name}"]`) as HTMLInputElement | null
              if (input) {
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
                setter?.call(input, value)
                input.dispatchEvent(new Event('input', { bubbles: true }))
              }
            }
            await sleep(200)
            const submitBtn = shadow.querySelector('button[type="submit"]') as HTMLButtonElement | null
            submitBtn?.click()
          }
        }

        // Wait for connection + conversation (max 20s)
        await Promise.race([
          Promise.all([connectedPromise, conversationPromise]),
          sleep(20000).then(() => {
            throw new Error('Timeout waiting for connection / conversation')
          }),
        ])

        // ── Send messages sequentially via StackAIChat.sendMessage ─────────────
        for (const msg of scenario.messages) {
          await sleep(500)

          lastSentTsRef.current = Date.now()
          StackAIChat.sendMessage(msg.text)
          pushEvent(makeEvent('message:sent', { text: msg.text }))

          if (msg.delayAfter) await sleep(msg.delayAfter)
        }

        // ── Test reopen (history reload) ────────────────────────────────────────
        let historyAfterReopen: Message[] | undefined

        if (scenario.testReopen) {
          const reopenDelay = scenario.reopenDelay ?? 2000
          await sleep(reopenDelay)

          // Re-init with same conversationId to test history loading
          const savedConvId = conversationIdRef.current

          // Reset promises
          const connectedPromise2 = new Promise<void>((resolve) => {
            connectedResolveRef.current = resolve
          })
          const conversationPromise2 = new Promise<void>((resolve) => {
            conversationResolveRef.current = resolve
          })

          StackAIChat.destroy()
          pushEvent(makeEvent('sdk:destroy'))
          await sleep(800)

          const reopenConfig: SDKConfig = {
            ...testConfig,
            conversationId: savedConvId ?? undefined,
          }

          StackAIChat.init(reopenConfig)
          StackAIChat.open()
          pushEvent(makeEvent('sdk:reopen', { conversationId: savedConvId }))

          await Promise.race([
            Promise.all([connectedPromise2, conversationPromise2]),
            sleep(12000),
          ])

          // Wait for history to load via prependMessages (store-based, not onMessage)
          await sleep(3000)
          historyAfterReopen = StackAIChat.getMessages()
          pushEvent(makeEvent('history:loaded', { count: historyAfterReopen.length, messages: historyAfterReopen }))
        }

        // ── Finalize ────────────────────────────────────────────────────────────
        const finishedAt = Date.now()
        pushEvent(makeEvent('test:done', { durationMs: finishedAt - startedAt }))

        const stats = computeStats(eventsRef.current, sdkConfig, historyAfterReopen)
        const testResult: TestResult = {
          scenario,
          sdkConfig,
          events: [...eventsRef.current],
          startedAt,
          finishedAt,
          historyAfterReopen,
          stats,
        }

        setResult(testResult)
        setStatus('done')
      } catch (err) {
        pushEvent(makeEvent('socket:error', { message: String(err) }))
        setStatus('error')
      }
    },
    [pushEvent],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setLiveEvents([])
    setResult(null)
    eventsRef.current = []
  }, [])

  return { status, liveEvents, result, run, reset }
}
