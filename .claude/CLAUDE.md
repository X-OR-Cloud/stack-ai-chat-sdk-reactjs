# CLAUDE.md — Antigravity Agent Instructions
# @xorcloud/stack-ai-chat-sdk (v0.12.0)

## Project Summary
Floating chat widget SDK for React — connects to a NestJS Socket.IO backend (Stack AI). Bundles to ESM + UMD via Vite. Styles are **fully isolated in a Shadow DOM** — no style leaks in or out.

---

## Tech Stack

| Layer | Tech |
|---|---|
| UI | React 18 + TypeScript |
| Build | Vite + `vite-plugin-dts` |
| State | Zustand (`src/store/chatStore.ts`) |
| Transport | Socket.IO client v4 |
| Style isolation | Shadow DOM (`src/utils/shadowDom.ts`) |
| Style | Raw CSS injected via `src/styles/injectStyles.ts` |

---

## Key NPM Scripts

```bash
npm run demo          # Chạy demo app để test UI (LUÔN dùng cái này để test)
npm run build         # Đóng gói ESM + UMD → dist/
npm run type-check    # Kiểm tra TypeScript, KHÔNG emit file
npm run release:patch # Bump patch + build + publish + git tag + push
```

---

## Source Tree

```
src/
├── index.ts                  # Entrypoint: StackAIChat.{init,open,close,destroy,...}
├── version.ts                # SDK_VERSION constant
├── sendMessageBridge.ts      # Singleton bridge: registerSendMessage / bridgeSendMessage / registerConnect
├── ChatWidget.tsx            # Root React component
├── store/
│   └── chatStore.ts          # Zustand store (ChatPhase, messages, isOpen, conversationId, ...)
├── types/index.ts            # ALL TypeScript types (SDKConfig, Message, MessageSource, ...)
├── hooks/
│   ├── useSocket.ts          # Socket.IO lifecycle: connect/disconnect/sendMessage
│   └── useSession.ts         # localStorage session persistence
├── components/
│   ├── AgentStatus/          # Online/offline agent badge + conversationId display
│   ├── ChatButton/           # Floating trigger button
│   ├── ChatWindow/           # Container frame (header + list + input)
│   ├── MessageInput/         # Text input + attachment picker + send button
│   ├── MessageList/
│   │   ├── MessageBubble.tsx # Renders: user bubble / assistant full-width / divider / notice / thinking/tool collapsible
│   │   ├── CollapsibleBlock.tsx  # Pill dùng cho thinking / tool_use / tool_result
│   │   ├── NoticeBanner.tsx  # Inline banner cho type: notice / system
│   │   ├── SourcesPanel.tsx  # Hiển thị sources (rag/web/tool/memory) kèm modal chi tiết
│   │   └── MessageList.css
│   ├── PreChatForm/          # Form nhập thông tin trước khi chat
│   └── TypingIndicator/      # Animated dots khi agent đang gõ
├── styles/
│   ├── injectStyles.ts       # Inject toàn bộ CSS vào Shadow DOM mountPoint
│   └── variables.css         # CSS custom properties (--sai-*)
└── utils/
    ├── shadowDom.ts          # createShadowHost / setTheme / watchSystemTheme
    ├── renderMarkdown.ts     # Markdown → safe HTML (no heavy lib)
    └── fileToBase64.ts       # Attachment → base64

demo/
├── DemoApp.tsx               # Demo React app
├── demo.css
└── testRunner/               # Automated conversation test harness (LLM judge)
    ├── TestRunner.tsx
    ├── Report.tsx
    ├── useTestRunner.ts
    ├── llmJudge.ts
    ├── types.ts
    ├── defaultScenario.json
    └── defaultSystemPrompt.ts
```

---

## Core Concepts

### 1. Shadow DOM — QUAN TRỌNG NHẤT
- Mọi HTML do SDK render đều nằm **trong Shadow DOM** (`mountPoint` từ `createShadowHost`).
- CSS global của host app **không áp dụng được** vào widget. CSS framework bên ngoài (Tailwind, Bootstrap) cũng vậy.
- Thêm style → chỉnh `src/styles/injectStyles.ts` hoặc `variables.css`. **Không dùng file CSS riêng lẻ ở component level** — chúng sẽ không được inject.
- CSS variables (`--sai-primary`, `--sai-radius`, v.v.) được set trên `hostEl` (shadow host element ở light DOM), từ đó truyền xuyên shadow boundary.

### 2. Zustand Store (`chatStore.ts`)
**ChatPhase state machine:**
```
'idle' → open() → 'form' → submit → 'connecting' → socket connect → 'chat'
```

**State quan trọng:**
- `messages: Message[]` — toàn bộ lịch sử tin nhắn (optimistic + confirmed)
- `phase: ChatPhase` — điều khiển UI hiển thị form / spinner / chat
- `conversationId` — được set từ server (xa presence:update hoặc conversation:join)
- `reference` — text được inject vào input qua `StackAIChat.setReference()`
- `isExpanded` — toggle expanded mode (50vw × 80vh)

### 3. Socket.IO (`useSocket.ts`)
**Events lắng nghe từ server:**
| Event | Xử lý |
|---|---|
| `connect` | Join lại room mỗi lần connect: `agent:connect` (user flow, có `config.agentId`) hoặc `conversation:join` (đã biết conversationId), chuyển phase → 'chat' |
| `disconnect` | Gọi `onDisconnected`, clear streaming/typing, phase → 'connecting' để Socket.IO tự reconnect |
| `connect_error` | Gọi `onError`; sau 5 lần fail liên tiếp → phase 'form' (Socket.IO vẫn retry nền, backoff 1s→5s) |
| `presence:update` | Anonymous flow: nhận `conversationId` từ server, load history |
| `message:chunk` | Streaming delta: buffer theo `actionId`, sort `chunkIndex`, render bubble streaming (`store.streaming`) |
| `message:new` | Dedup → filter type/pattern (`system`/`notice`/`error` LUÔN hiển thị) → `addMessage` → `onMessage`. `isFinal: true` → unlock input + replace streaming bubble |
| `message:sent` | Fallback confirm cho server không ack (confirm chính qua ack của `message:send`) |
| `agent:typing` | Set `isAgentTyping = true`, auto-clear sau 10s; bỏ qua khi đang streaming |

**Events gửi lên server:**
| Event | Khi nào |
|---|---|
| `agent:connect` | Sau connect, nếu có `config.agentId` (user flow — server find-or-create conversation) |
| `conversation:join` | Sau connect, nếu đã biết `conversationId` |
| `conversation:history` | Sau join — 50 message, `includeInternal` khi `visibleMessageTypes` chứa thinking/tool_*; phân trang bằng cursor `before` (nút "Xem tin nhắn cũ hơn") |
| `message:send` | Khi user gửi tin — có ack callback: confirm/fail optimistic message, `guardrailBlocked` → gỡ message khỏi list |
| `message:typing` | User gõ trong input (debounce 2s, một event duy nhất với cờ `isTyping`) |

**Không gửi `conversationId` trong `message:send` payload** — server tự resolve từ `client.data`.

**Token refresh:** `StackAIChat.updateToken(token)` → gán `socket.auth` mới rồi `disconnect().connect()`.

### 4. Message Types (`MessageType`)
| Type | Render |
|---|---|
| `message` | User bubble HOẶC assistant full-width với markdown |
| `divider` | Separator "Cuộc trò chuyện mới" |
| `notice` / `system` / `error` | `NoticeBanner` — inline banner (`error` có style đỏ) |
| `thinking` | `CollapsibleBlock` (💭) |
| `tool_use` | `CollapsibleBlock` (🔧) |
| `tool_result` | `CollapsibleBlock` (📋) |

### 5. MessageSource & SourcesPanel
Sources được đính kèm vào assistant messages. Types: `'rag' | 'web' | 'tool' | 'memory'`. `SourcesPanel` render dạng chip, click mở modal chi tiết. Tắt bằng `config.showReferences = false`.

### 6. sendMessageBridge
Pattern singleton cho phép `StackAIChat.sendMessage()` / `StackAIChat.connect()` ở `index.ts` ( ngoài React tree) giao tiếp với `useSocket` hook bên trong component tree.

---

## SDKConfig — Các tùy chọn mới (sau v0.4.0)

| Field | Mặc định | Mô tả |
|---|---|---|
| `agentId` | — | User flow (JWT đăng nhập): emit `agent:connect` để server find-or-create conversation. Anonymous token không cần |
| `visibleMessageTypes` | `['message']` | Các `MessageType` được hiển thị trong chat (`system`/`notice`/`error` luôn hiển thị bất kể config) |
| `hiddenPatterns` | `[]` | Regex lọc ẩn message theo content |
| `customStyles` | — | CSS override per-component inject vào Shadow DOM |
| `showReferences` | `true` | Hiển thị SourcesPanel dưới assistant messages |
| `greeting` | — | Tin nhắn tự động hiện sau khi connect |
| `maxInputLength` | `1000` | Giới hạn ký tự input (hard cap: 2000) |
| `onRawMessage` | — | Debug callback nhận raw WS payload TRƯỚC khi filter |

---

## Git Branch Strategy

### Cấu trúc nhánh
```
main          ← production, protected — chỉ merge từ staging
  └── staging ← buffer/integration trước khi release
        ├── dunghv/<feature-or-fix>   ← Tony Hoang
        └── hantv/<feature-or-fix>    ← Hà Nguyễn
```

### Quy trình
- **Phát triển**: tạo nhánh cá nhân từ `staging` với prefix `dunghv/` hoặc `hantv/`
- **Tích hợp**: PR từ nhánh cá nhân → `staging` (cần review trước khi merge)
- **Release**: merge `staging` → `main` khi sẵn sàng, kèm backup tag

### Backup trước khi merge vào main
```bash
# Tạo tag snapshot trước khi merge staging → main
git tag backup/v0.x.x-pre-merge
git push origin backup/v0.x.x-pre-merge
```
Dùng tag thay vì nhánh backup để tránh rác repo. List toàn bộ: `git tag -l "backup/*"`.

### Quy tắc bắt buộc
- `main` — **không push trực tiếp**, chỉ merge qua PR từ `staging`
- Nhánh cá nhân phải có prefix `dunghv/` hoặc `hantv/` để tránh đụng tên
- Xóa nhánh cá nhân sau khi đã merge vào `staging`

---

## Quy tắc Phát Triển cho Antigravity

1. **Shadow DOM First**: Mọi UI change → chỉnh `injectStyles.ts` (CSS) hoặc component TSX. Không expect global styles hoạt động.
2. **Không thêm dependency nặng**: Không được thêm moment, lodash, axios, v.v. Dùng native JS/DOM APIs.
3. **Type-safety bắt buộc**: Thay đổi `src/types/index.ts` → chạy `npm run type-check` trước khi báo xong.
4. **Backward-compatible**: Không được thay đổi signature của `StackAIChat.init()` hoặc làm hỏng `SDKConfig` field hiện có. Luôn thêm default value cho field mới.
5. **Zustand slices**: Nếu store phình to → tách thành slices riêng, không nhồi vào `chatStore.ts`.
6. **useEffect cleanup**: Hook `useSocket` phải cleanup listeners + disconnect trong `return` của `useEffect`.
7. **Test thủ công**: Sau mọi thay đổi UI, chạy `npm run demo` và kiểm tra visually (light + dark mode).
8. **Test Runner**: `demo/testRunner/` là automated LLM-judge test harness. Khi thay đổi socket logic → chạy lại test runner để verify không phá vỡ conversation flow.
9. **Release**: Chỉ dùng các script `release:patch / release:minor / release:major` — KHÔNG dùng `npm publish` trực tiếp.
10. **WSS URL format**: `wsUrl` phải là full URL, ví dụ `wss://skt.x-or.cloud/ws/chat`. `resolveSocketParams()` trong `useSocket.ts` tách thành `serverOrigin` + `socketPath` (e.g. `/ws/chat/socket.io`) để truyền vào `io(origin, { path })`.
