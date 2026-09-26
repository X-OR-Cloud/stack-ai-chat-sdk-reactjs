import { SDK_VERSION } from '../version'

// ─── Types ───────────────────────────────────────────────────────────────────

type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface TelemetryEntry {
  level: TelemetryLevel
  errorType: string
  message: string
  stackTrace?: string
  stage?: string
  conversationId?: string
  metadata?: Record<string, unknown>
  at?: string
}

// ─── Service ─────────────────────────────────────────────────────────────────

class TelemetryService {
  private apiUrl = ''
  private token = ''
  private conversationId = ''
  private enabled = true

  // Client-side rate limit: match server-side 10 req/min/agent
  private timestamps: number[] = []
  private readonly RATE_LIMIT = 10
  private readonly RATE_WINDOW_MS = 60_000

  /**
   * Configure telemetry service. Called at SDK init() and when config changes.
   * Telemetry auto-enables when apiUrl is provided, auto-disables when missing.
   */
  configure(opts: { apiUrl: string; token: string; enabled?: boolean }) {
    this.apiUrl = opts.apiUrl.replace(/\/+$/, '') // strip trailing slash
    this.token = opts.token
    this.enabled = opts.enabled !== false && !!this.apiUrl
  }

  /** Update token (e.g. after tokenRefresh) */
  setToken(token: string) {
    this.token = token
  }

  /** Update conversationId (e.g. after presence:update) */
  setConversationId(id: string) {
    this.conversationId = id
  }

  /**
   * Push a telemetry entry. Fire-and-forget — never throws, never blocks UI.
   * Silently drops if disabled, rate-limited, or missing apiUrl/token.
   */
  push(entry: {
    level: TelemetryLevel
    errorType: string
    message: string
    stackTrace?: string
    stage?: string
    conversationId?: string
    metadata?: Record<string, unknown>
  }) {
    if (!this.enabled || !this.apiUrl || !this.token) return
    if (!this.checkRateLimit()) return

    const body: TelemetryEntry = {
      level: entry.level,
      errorType: entry.errorType,
      message: entry.message.slice(0, 2000), // match server-side truncation
      stackTrace: entry.stackTrace?.slice(0, 10000),
      stage: entry.stage,
      conversationId: entry.conversationId || this.conversationId || undefined,
      metadata: {
        ...entry.metadata,
        clientEnv: {
          sdkVersion: SDK_VERSION,
          runtime: 'browser',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        },
      },
      at: new Date().toISOString(),
    }

    // Fire-and-forget — catch to suppress unhandled rejection
    fetch(`${this.apiUrl}/client-telemetries/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    }).catch(() => {
      // Silent fail — telemetry should never affect chat functionality
    })
  }

  /** Reset state on destroy() */
  reset() {
    this.apiUrl = ''
    this.token = ''
    this.conversationId = ''
    this.enabled = true
    this.timestamps = []
  }

  private checkRateLimit(): boolean {
    const now = Date.now()
    this.timestamps = this.timestamps.filter(t => now - t < this.RATE_WINDOW_MS)
    if (this.timestamps.length >= this.RATE_LIMIT) return false
    this.timestamps.push(now)
    return true
  }
}

/** Singleton — import and use across the entire SDK */
export const telemetry = new TelemetryService()
