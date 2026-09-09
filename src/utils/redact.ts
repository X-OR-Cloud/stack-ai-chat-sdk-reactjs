export function redactValue(value: unknown, tokens: Iterable<string>): unknown {
  let out = value
  for (const token of tokens) {
    if (token) out = redactOne(out, token)
  }
  return out
}

function redactOne(value: unknown, token: string): unknown {
  if (typeof value === 'string') return value.split(token).join('[REDACTED]')
  if (Array.isArray(value)) return value.map((v) => redactOne(v, token))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = redactOne(v, token)
    return out
  }
  return value
}

export function truncateForDisplay(value: unknown, maxLen = 500): unknown {
  if (typeof value === 'string') return value.length > maxLen ? value.slice(0, maxLen) + '…' : value
  if (Array.isArray(value)) return value.map((v) => truncateForDisplay(v, maxLen))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = truncateForDisplay(v, maxLen)
    return out
  }
  return value
}
