import type { LLMJudgeConfig, JudgeReport, TestResult } from './types'

export async function callLLMJudge(
  config: LLMJudgeConfig,
  result: TestResult,
): Promise<JudgeReport> {
  const userContent = `## Dữ liệu test cần đánh giá

### SDK Config
\`\`\`json
${JSON.stringify(result.sdkConfig, null, 2)}
\`\`\`

### Kịch bản test: "${result.scenario.name}"
${result.scenario.description ? `> ${result.scenario.description}` : ''}

**Tin nhắn kịch bản:**
${result.scenario.messages.map((m, i) => `${i + 1}. "${m.text}" (chờ ${m.delayAfter ?? 0}ms)`).join('\n')}

**testReopen:** ${result.scenario.testReopen ? 'Có' : 'Không'}

---

### Thống kê tổng hợp
\`\`\`json
${JSON.stringify(result.stats, null, 2)}
\`\`\`

### Thời gian chạy test
- Bắt đầu: ${new Date(result.startedAt).toLocaleString('vi-VN')}
- Kết thúc: ${new Date(result.finishedAt).toLocaleString('vi-VN')}
- Tổng thời gian: ${((result.finishedAt - result.startedAt) / 1000).toFixed(1)}s

---

### Danh sách events (${result.events.length} events)
\`\`\`json
${JSON.stringify(
  result.events.map((e) => ({
    kind: e.kind,
    ts: new Date(e.ts).toLocaleTimeString('vi-VN'),
    ...(e.responseTimeMs != null ? { responseTimeMs: e.responseTimeMs } : {}),
    data: e.data,
  })),
  null,
  2,
)}
\`\`\`

${
  result.historyAfterReopen != null
    ? `---

### Lịch sử sau khi reopen (${result.historyAfterReopen.length} messages)
\`\`\`json
${JSON.stringify(
  result.historyAfterReopen.map((m) => ({
    role: m.role,
    type: m.type,
    content: m.content.slice(0, 200),
  })),
  null,
  2,
)}
\`\`\``
    : ''
}

---

Hãy phân tích và tạo báo cáo đánh giá chi tiết theo hướng dẫn trong system prompt.`

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`LLM API error ${response.status}: ${err}`)
  }

  const json = await response.json()
  const markdown: string =
    json.choices?.[0]?.message?.content ??
    json.content?.[0]?.text ??
    json.message?.content ??
    '_(Không có nội dung phản hồi từ LLM)_'

  return { markdown, generatedAt: Date.now() }
}
