# Proposal: Nâng cấp SDK v0.13.2

> Ngày: 2026-09-03 · Tác giả: yuna · Trạng thái: chờ review

## 0. Bối cảnh

SDK `@xorcloud/stack-ai-chat-sdk` hiện ở v0.13.1 (đã commit, chưa publish). Tài liệu handoff từ team ops-portal (`chat-core`) lộ ra 4 hardening gaps và 3 quality-of-life improvements mà SDK chưa có. Anh Dũng (sponsor) duyệt Ưu tiên 1 + 2, bỏ qua Ưu tiên 3. Yêu cầu thêm: cấu hình hiển thị source tham chiếu theo 3 mode.

Lộ trình thay thế SDK trong 2 tuần — chỉ làm gì thật sự cần thiết.

---

## 1. Ưu tiên 1 — Hardening (sửa bug thật, ~45 dòng)

### 1.1 Token refresh tại `reconnect_attempt`

**Vấn đề:** Khi Socket.IO tự reconnect nền (mất mạng tạm thời), token bị đóng gói tĩnh lúc `io()` khởi tạo. Nếu access token hết hạn trong lúc disconnected, mọi lần retry nền sẽ fail mãi — SDK kẹt ở "connecting" không thoát.

**ops-portal làm:** Lắng nghe `socket.io.on('reconnect_attempt')`, lấy `getAccessToken()` mới nhất gán vào `socket.auth` + `socket.io.opts.query` (`useChatSocket.ts:311-317`).

**SDK hiện tại:** `updateToken()` chỉ gọi thủ công. Khi Socket.IO tự retry nền, token không được refresh.

**Đề xuất:**
- Thêm config field `tokenRefresh?: () => string | Promise<string>` — hàm do khách hàng cung cấp, trả về token mới nhất tại thời điểm gọi.
- Trong `useSocket.ts`, thêm listener `socket.io.on('reconnect_attempt', async () => { if (config.tokenRefresh) { const t = await config.tokenRefresh(); socket.auth = { token: t }; socket.io.opts.query = { ...socket.io.opts.query, token: t }; rememberToken(t) } })`.
- Nếu khách hàng không truyền `tokenRefresh` — giữ hành vi cũ (token tĩnh), không gãy.

**Backward-compatible:** Field mới optional, không phá config hiện có.

**Giới hạn:** SDK không thể biết khi nào token hết hạn — chỉ phản ứng khi Socket.IO đã bắt đầu retry. Nếu customer muốn chủ động refresh trước khi hết hạn, đó là việc của app khách hàng.

### 1.2 `message:send` ack timeout

**Vấn đề:** `message:send` có ack callback nhưng không có timeout. Nếu server im lặng (zombie socket), optimistic message kẹt ở trạng thái "sending" vĩnh viễn — user không biết gửi thất bại.

**ops-portal làm:** Set thủ công 10s timeout (`useChatSocket.ts:615`).

**Đề xuất:**
- Trong `useSocket.ts`, sau khi `socket.emit('message:send', payload, (ack) => { ... })`, thêm:
  ```ts
  const ackTimeout = setTimeout(() => {
    if (!ackReceived) { failMessage(localId); reportError('Gửi tin nhắn thất bại: không nhận được xác nhận từ server (timeout 10s)') }
  }, 10000)
  ```
- Clear timeout khi ack nhận được.

**Phạm vi:** ~10 dòng trong `sendMessage` handler.

### 1.3 `reconnect_failed` Manager event

**Vấn đề:** `socket.active` không tự về `false` khi Socket.IO hết lượt retry (Manager-level event, không phải Socket-level). SDK đếm `connectFailuresRef` tới 5 rồi phase → 'form', nhưng không nghe Manager event — có thể race condition.

**ops-portal làm:** Lắng nghe `socket.io.on('reconnect_failed')` riêng (`useChatSocket.ts:410-413`).

**Đề xuất:**
- Thêm `socket.io.on('reconnect_failed', () => { isConnectingRef.current = false; setPhase('form'); reportError('Không thể kết nối lại sau nhiều lần thử') })`.
- Giữ counter `connectFailuresRef` làm dự phòng.

**Phạm vi:** ~5 dòng.

### 1.4 Visibility/online watchdog

**Vấn đề:** OS có thể "đóng băng" WebSocket khi tab ẩn (mobile đặc biệt) — status vẫn "connected" cho đến ping-timeout ~45s. User gửi tin trong khoảng đó → tin biến mất.

**ops-portal làm:** Tab ẩn >30s → `forceReconnect()` khi quay lại (`useChatSocket.ts:461-496`).

**Đề xuất:**
- Thêm `document.addEventListener('visibilitychange', ...)` — khi `document.hidden` → ghi `hiddenAt`; khi quay lại + `hiddenFor > 30s` → `socket.disconnect().connect()`.
- Thêm `window.addEventListener('online', ...)` — khi mạng quay lại + chưa connected → reconnect.
- Cleanup trong `useEffect` return.

**Phạm vi:** ~25 dòng. Mobile user là segment lớn của SDK widget.

**Lưu ý:** 30s ngưỡng có thể cần điều chỉnh — quá ngắn → reconnect thừa khi user chỉ switched tab nhanh; quá dài → zombie WS kéo dài. 30s là giá trị ops-portal đã chọn và chạy thấy ổn.

---

## 2. Ưu tiên 2 — Quality of Life (~20 dòng)

### 2.1 Streaming cleanup trên reconnect

**Vấn đề:** `setStreaming(null)` có trong `disconnect` handler nhưng chưa clear ở đầu `connect` handler — orphan streaming từ connection cũ có thể collide với `message:new` của connection mới → bubble streaming kẹt không bao giờ finalize.

**Đề xuất:** Thêm `setStreaming(null); chunksRef.current.clear()` ở đầu `socket.on('connect', ...)` handler.

**Phạm vi:** ~3 dòng.

### 2.2 Optimistic dedupe fallback

**Vấn đề:** SDK dedupe theo `_id`. Nếu server echo user message với `_id` khác (server-generated), optimistic message (temp id) không bị thay thế → duplicate trong UI.

**ops-portal làm:** `findReconcileTarget`: primary match theo content, fallback match "oldest pending temp message" (`useChatSocket.ts:175-182`).

**Đề xuất:**
- Trong `message:new` handler, nếu incoming `role === 'user'`:
  1. Tìm optimistic message pending có `messageText(incoming) === message.content` → replace.
  2. Nếu không khớp content (server mutate — VD PII redaction) → tìm pending message cũ nhất (bắt đầu `temp-`) → replace.
  3. Không khớp → `addMessage` (tab khác gửi, hoặc server event không liên quan).

**Phạm vi:** ~15 dòng.

### 2.3 `agent:typing` timeout

**Vấn đề:** SDK auto-clear sau 10s; ops-portal dùng 5s. Server có thể quên gửi `isTyping: false`.

**Đề xuất:** Đổi hằng số `10000` → `5000` trong `agent:typing` handler.

**Phạm vi:** 1 dòng.

---

## 3. Reference Display Mode (yêu cầu mới từ anh Dũng)

### 3.1 Hiện trạng

- `SDKConfig.showReferences: boolean` (mặc định `true`).
- `SourcesPanel` render chip cho mỗi source. Click chip → mở modal đầy đủ (icon + label + score + URL + nội dung markdown).
- `MessageSource` có: `type` (rag/web/tool/memory), `content`, `score?`, `url?`, `label?`, `collectionId?`, `toolName?`.

### 3.2 Đề xuất

Thay `showReferences: boolean` bằng `referenceDisplay: 'none' | 'url' | 'full'`:

| Giá trị | Hành vi |
|---|---|
| `'none'` | Không render SourcesPanel |
| `'url'` | Render chip cho mỗi source. Click chip → mở `source.url` trong tab mới (`target="_blank"`, `rel="noopener noreferrer"`). Nếu source không có `url` → chip hiển thị label, không click được. Không mở modal, không hiển thị content |
| `'full'` | Hành vi hiện tại — chip + modal đầy đủ (nội dung + URL + score) |

### 3.3 Backward compatibility

```
referenceDisplay chưa truyền + showReferences chưa truyền → 'full' (mặc định)
referenceDisplay chưa truyền + showReferences = false    → 'none'
referenceDisplay chưa truyền + showReferences = true     → 'full'
referenceDisplay = 'none'/'url'/'full'                    → ưu tiên, bỏ qua showReferences
```

Khách hàng hiện tại không cần đổi gì — code tự map `showReferences` cũ sang `referenceDisplay` mới.

### 3.4 Giới hạn dữ liệu

- `type: 'web'` đã có `url` → mode `'url'` click được.
- `type: 'rag'` chỉ có `collectionId`, **không có `url`** → mode `'url'` chip hiển thị label nhưng không click được.
- `type: 'tool'` có `toolName`, không có `url` → tương tự.
- `type: 'memory'` — không có `url` → tương tự.
- Nếu anh muốn `rag`/`tool`/`memory` cũng click được ở mode `'url'`, cần backend (sten/AIWM) trả thêm `url` field. Đây là giới hạn phía server, không phải SDK.

### 3.5 Files thay đổi

```
src/types/index.ts:
  + ReferenceDisplayMode = 'none' | 'url' | 'full'
  + SDKConfig.referenceDisplay?: ReferenceDisplayMode
  (giữ showReferences?: boolean cho backward-compat)

src/components/MessageList/MessageBubble.tsx:
  + Đọc referenceDisplay = config.referenceDisplay ?? (config.showReferences === false ? 'none' : 'full')
  + 'none' → không render
  + 'url'  → <SourcesPanel sources={...} mode="url" />
  + 'full' → <SourcesPanel sources={...} mode="full" />

src/components/MessageList/SourcesPanel.tsx:
  + mode prop: 'url' | 'full' (mặc định 'full')
  + mode='url': chỉ chip + click mở URL (không modal, không content)
  + mode='full': hành vi hiện tại (chip + modal)
```

### 3.6 CSS

Mode `'url'` dùng style chip hiện có — chỉ thay hành vi click (mở URL thay vì mở modal). Không cần thêm CSS mới. Nếu cần style riêng cho chip không-click-được (source không có url), thêm 1 class `source-chip--disabled` (opacity giảm, cursor default). ~5 dòng CSS trong `injectStyles.ts`.

---

## 4. Tổng kết

| Hạng mục | Ưu tiên | Effort | Files |
|---|---|---|---|
| 1.1 Token refresh tại reconnect_attempt | 1 | ~15 dòng | `useSocket.ts`, `types/index.ts` |
| 1.2 message:send ack timeout | 1 | ~10 dòng | `useSocket.ts` |
| 1.3 reconnect_failed Manager event | 1 | ~5 dòng | `useSocket.ts` |
| 1.4 Visibility/online watchdog | 1 | ~25 dòng | `useSocket.ts` |
| 2.1 Streaming cleanup trên reconnect | 2 | ~3 dòng | `useSocket.ts` |
| 2.2 Optimistic dedupe fallback | 2 | ~15 dòng | `useSocket.ts` |
| 2.3 agent:typing timeout 10s → 5s | 2 | 1 dòng | `useSocket.ts` |
| 3. Reference Display Mode | — | ~40 dòng | `types/index.ts`, `MessageBubble.tsx`, `SourcesPanel.tsx`, `injectStyles.ts` |
| **Tổng** | | **~115 dòng** | 5 files |

**Thứ tự实施:** 1.2 → 1.3 → 2.1 → 2.3 (nhỏ, nhanh) → 1.4 → 2.2 → 1.1 (cần thêm config field) → 3 (feature mới)

**Không làm trong đợt này:**
- Interactive messages (QuestionGroup, Preview cards)
- Conversation list/switch/export
- Mention system
- File upload qua API
- Command Layer stack-based
- Store persist phức tạp

**Sau khi hoàn tất:** bump v0.13.2, build, type-check, demo test, commit — không publish npm cho đến khi indra duyệt CHANGELOG A/B.
