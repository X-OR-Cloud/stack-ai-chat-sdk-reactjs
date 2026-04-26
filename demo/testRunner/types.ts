import type { Message, SDKConfig } from '../../src/types'

export interface TestMessage {
  text: string
  delayAfter?: number // ms to wait after sending before sending next
}

export interface TestScenario {
  name: string
  description?: string
  skipForm?: boolean
  formData?: Record<string, string>
  messages: TestMessage[]
  testReopen?: boolean // destroy + reinit after all messages to test history reload
  reopenDelay?: number // ms before reinit (default 1000)
}

export type EventKind =
  | 'sdk:init'
  | 'sdk:destroy'
  | 'sdk:reopen'
  | 'socket:connected'
  | 'socket:disconnected'
  | 'socket:error'
  | 'conversation:joined'
  | 'presence:update'
  | 'form:submit'
  | 'message:sent'
  | 'message:received'
  | 'message:raw'
  | 'history:loaded'
  | 'test:start'
  | 'test:done'

export interface CapturedEvent {
  id: number
  ts: number           // Date.now()
  kind: EventKind
  data?: unknown
  // timing helpers
  responseTimeMs?: number  // only on message:received - ms since last user message:sent
}

export interface TestResult {
  scenario: TestScenario
  sdkConfig: Partial<SDKConfig>
  events: CapturedEvent[]
  startedAt: number
  finishedAt: number
  historyAfterReopen?: Message[]
  // computed
  stats: TestStats
}

export interface TestStats {
  totalMessages: number
  userMessages: number
  assistantMessages: number
  avgResponseTimeMs: number | null
  maxResponseTimeMs: number | null
  minResponseTimeMs: number | null
  errors: number
  historyMessageCount: number | null
  visibleTypesViolations: number  // messages received that shouldn't appear given visibleMessageTypes
}

export interface LLMJudgeConfig {
  endpoint: string
  apiKey: string
  model: string
  systemPrompt: string
}

export interface JudgeReport {
  markdown: string
  generatedAt: number
}

export interface TestRunnerBundle {
  connection: {
    wsUrl: string
    socketPath?: string
    token: string
  }
  llmJudge: {
    endpoint: string
    apiKey: string
    model: string
    systemPrompt: string
  }
  scenario: TestScenario
}
