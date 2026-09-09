# @xorcloud/stack-ai-chat-sdk

Floating chat widget SDK for React apps — powered by [Stack AI](https://x-or.cloud).

Embed a fully-featured live chat widget into any React application in minutes. Connects to your Stack AI backend via Socket.IO with support for real-time messaging, agent presence, typing indicators, file attachments, markdown rendering, answer voting, copy-to-clipboard, reference/quote injection, greeting messages, session dividers, expanded mode, dark/light mode, and Shadow DOM style isolation.

---

## Installation

```bash
npm install @xorcloud/stack-ai-chat-sdk
```

## Quick Start

```tsx
import { StackAIChat } from '@xorcloud/stack-ai-chat-sdk'

StackAIChat.init({
  wsUrl: 'wss://your-server.com/ws/chat',
  token: '<your-jwt-token>',
})
```

The chat button will appear in the bottom-right corner of the screen immediately.

> **Anonymous flow:** If your JWT has `type: 'anonymous'`, the server automatically creates a conversation and the SDK receives the `conversationId` via `presence:update`. You don't need to pass `conversationId` manually.

---

## Configuration

```tsx
StackAIChat.init({
  // ── Connection (required) ──────────────────────────────
  wsUrl: 'wss://your-server.com/ws/chat',
  token: '<jwt-token>',
  conversationId: '<conversation-id>',  // optional — omit for anonymous flow

  // ── Pre-chat Form Fields ───────────────────────────────
  fields: [
    { name: 'fullName', label: 'Full Name',    type: 'text', required: true  },
    { name: 'phone',    label: 'Phone Number', type: 'tel',  required: true  },
    { name: 'idCard',   label: 'ID Card',      type: 'text', required: false },
  ],

  // ── Session Persistence ────────────────────────────────
  session: {
    persist: true,       // save form data to localStorage
    storageKey: 'chat_user',
    ttl: 86400,          // seconds (0 = forever), default 24h
  },

  // ── File Attachments ───────────────────────────────────
  attachments: {
    enabled: true,
    maxSize: 5,                              // MB
    accept: ['image/*', 'application/pdf'],
    maxCount: 5,
  },

  // ── UI ─────────────────────────────────────────────────
  position: 'bottom-right',   // 'bottom-right' | 'bottom-left'
  title: 'Customer Support',
  subtitle: 'Usually replies in minutes',

  // ── Theme ──────────────────────────────────────────────
  theme: {
    mode: 'auto',           // 'light' | 'dark' | 'auto' (follows OS)
    primaryColor: '#0066FF',
    borderRadius: '12px',
  },

  // ── Visible Message Types ──────────────────────────────
  // Control which action types from WebSocket are shown in the chat box.
  // Default: ['message'] — only regular chat messages are displayed.
  visibleMessageTypes: ['message', 'thinking', 'tool_use', 'tool_result', 'notice', 'system'],

  // ── Hidden Patterns ─────────────────────────────────────
  // Filter out messages by content using regex patterns.
  // Useful when server sends internal messages (e.g. tool calls) with type: 'message'.
  hiddenPatterns: [
    /^🧠\s?\*\*Knowledge Search\*\*/,
    /^Retrieved \d+ knowledge chunk/,
    /^No relevant knowledge found/,
  ],

  // ── Greeting ───────────────────────────────────────────
  // Message shown immediately when a fresh conversation starts (no history).
  // Not shown when resuming an existing conversation.
  greeting: 'Hello! How can I help you today?',

  // ── References ─────────────────────────────────────────
  // Show or hide reference documents attached to agent responses.
  // Default: true
  showReferences: false,

  // ── Custom Styles ──────────────────────────────────────
  // Override CSS for individual UI components (injected into Shadow DOM).
  customStyles: {
    chatButton:     '.chat-button { box-shadow: 0 4px 20px rgba(0,0,0,0.3); }',
    chatWindow:     '.chat-window { border: 2px solid #0066FF; }',
    chatHeader:     '.chat-header { background: linear-gradient(135deg, #0066FF, #7c3aed); }',
    messageList:    '.message-list { background: #fafafa; }',
    messageBubble:  '.message-bubble { border-radius: 8px; }',
    messageInput:   '.message-input-area { border-top: 2px solid #e5e7eb; }',
    preChatForm:    '.prechat-form { padding: 24px; }',
    typingIndicator:'.typing-indicator { opacity: 0.7; }',
    global:         ':host { --sai-primary: #7c3aed; --sai-primary-hover: #6d28d9; }',
  },

  // ── Callbacks ──────────────────────────────────────────
  onOpen:               () => console.log('Widget opened'),
  onClose:              () => console.log('Widget closed'),
  onConnected:          () => console.log('Socket connected'),
  onDisconnected:       () => console.log('Socket disconnected'),
  onConversationJoined: (id) => console.log('Joined conversation', id),
  onPresenceUpdate:     (payload) => console.log('Presence update', payload),
  onError:              (msg) => console.error('Error:', msg),
  onFormSubmit:         (data) => console.log('Form submitted', data),
  onMessage:            (msg) => console.log('New message', msg),
})
```

---

## API

### `StackAIChat.version`
Read-only string containing the current SDK version. Useful for debugging when integrating into consumer apps.

```ts
console.log(StackAIChat.version) // e.g. "0.11.0"
```

### `StackAIChat.init(config)`
Initialize and mount the chat widget. Can only be called once — call `destroy()` first to re-initialize. Logs `[StackAIChat] SDK v<version>` to the console on startup.

### `StackAIChat.open()`
Programmatically open the chat window.

### `StackAIChat.close()`
Programmatically close the chat window.

### `StackAIChat.setReference(text)`
Inject a reference/quote into the message input. The quoted text will be prepended to the next message as a blockquote (`> text`). Useful for "reply to selection" flows — call this when the user selects text on your page.

```ts
// Example: quote selected text when user opens chat
document.addEventListener('mouseup', () => {
  const selected = window.getSelection()?.toString().trim()
  if (selected) {
    StackAIChat.setReference(selected)
    StackAIChat.open()
  }
})
```

### `StackAIChat.clearReference()`
Clear any pending reference/quote from the input.

### `StackAIChat.vote(actionId, type)`
Vote on an agent answer from outside the widget. `actionId` is the message `_id` — read it
from `getMessages()[i].messageId`. `type` is `'like'` or `'dislike'`.

The server toggles: sending the type that is already set removes the vote. Requires
`voting.enabled` and a live socket connection.

```ts
const last = StackAIChat.getMessages().filter(m => m.role === 'assistant').pop()
if (last?.messageId) StackAIChat.vote(last.messageId, 'like')
```

### `StackAIChat.updateToken(token)`
Swap the JWT and reconnect — call it after your IAM issues a fresh access token.

### `StackAIChat.getMessages()`
Return the current message list, including each message's `userReaction`, `likes` and
`dislikes`.

### `StackAIChat.getPhase()`
Return the current phase: `'idle' | 'form' | 'connecting' | 'chat'`.

### `StackAIChat.updateConfig(partial)`
Update configuration after initialization (e.g. change theme or title).

### `StackAIChat.destroy()`
Unmount the widget and clean up all resources.

---

## SDKConfig Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wsUrl` | `string` | ✓ | WebSocket server URL |
| `token` | `string` | ✓ | JWT token (agent, user, or anonymous) |
| `conversationId` | `string` | — | Resume a specific conversation. Omit for anonymous flow. |
| `agentId` | `string` | — | Authenticated-user flow: emits `agent:connect` so the server find-or-creates the conversation. Anonymous tokens do not need it. |
| `socketPath` | `string` | — | Socket.IO handshake path. Derived from `wsUrl` when omitted. |
| `fields` | `FieldConfig[]` | — | Pre-chat form fields |
| `session` | `SessionConfig` | — | Form session persistence |
| `attachments` | `AttachmentsConfig` | — | File attachment settings |
| `position` | `'bottom-right' \| 'bottom-left'` | — | Widget position |
| `title` | `string` | — | Chat header title |
| `subtitle` | `string` | — | Chat header subtitle |
| `theme` | `ThemeConfig` | — | Theme settings |
| `visibleMessageTypes` | `MessageType[]` | — | Action types to display. Default: `['message']` |
| `hiddenPatterns` | `RegExp[]` | — | Regex patterns to filter out messages by content |
| `greeting` | `string` | — | Welcome message shown when a fresh conversation starts (no history). Omit to disable. |
| `showReferences` | `boolean` | — | Show/hide reference documents attached to agent responses. Default: `true` |
| `referenceDisplay` | `'none' \| 'url' \| 'full'` | — | How sources render. Takes precedence over `showReferences`. Default: `'full'` |
| `voting` | `VotingConfig` | — | `{ enabled }` — show 👍/👎 under agent answers. Default: `{ enabled: false }` |
| `maxInputLength` | `number` | — | Input character limit. Default: `1000`, hard cap `2000` |
| `tokenRefresh` | `() => string \| Promise<string>` | — | Called on every reconnect attempt to fetch the latest token |
| `customStyles` | `CustomStylesConfig` | — | Per-component CSS overrides (injected into Shadow DOM) |
| `onOpen` | `() => void` | — | Called when widget opens |
| `onClose` | `() => void` | — | Called when widget closes |
| `onConnected` | `() => void` | — | Called when socket connects |
| `onDisconnected` | `() => void` | — | Called when socket disconnects |
| `onConversationJoined` | `(id: string) => void` | — | Called when conversation ID is known |
| `onPresenceUpdate` | `(payload: PresenceUpdatePayload) => void` | — | Called on agent/user presence changes |
| `onError` | `(message: string) => void` | — | Called on errors |
| `onMessage` | `(message: Message) => void` | — | Called on new incoming messages |
| `onRawMessage` | `(payload: Record<string, unknown>) => void` | — | Debug: raw WebSocket payload before filtering |
| `onFormSubmit` | `(data: Record<string, string>) => void` | — | Called when pre-chat form is submitted |
| `onVote` | `(event: VoteEvent) => void` | — | Called once the server confirms a vote |

---

## Visible Message Types

By default only `'message'` type messages are rendered. Use `visibleMessageTypes` to opt-in to additional action types:

| Type | Description |
|------|-------------|
| `message` | Regular chat messages (default) |
| `thinking` | AI internal reasoning / chain-of-thought steps |
| `tool_use` | Tool/function calls initiated by the agent |
| `tool_result` | Results returned from tool/function calls |
| `notice` | Informational notices from the system |
| `system` | System-level messages |

```ts
StackAIChat.init({
  wsUrl: '...',
  token: '...',
  visibleMessageTypes: ['message', 'thinking'],  // also show reasoning steps
})
```

---

## Hidden Patterns

Some servers send internal messages (e.g. knowledge search, tool calls) with `type: 'message'`, making them indistinguishable by type alone. Use `hiddenPatterns` to filter them out by content:

```ts
StackAIChat.init({
  wsUrl: '...',
  token: '...',
  hiddenPatterns: [
    /^🧠\s?\*\*Knowledge Search\*\*/,   // "🧠 **Knowledge Search**\n..."
    /^Retrieved \d+ knowledge chunk/,   // "Retrieved 5 knowledge chunk(s)."
    /^No relevant knowledge found/,     // "No relevant knowledge found."
  ],
})
```

Patterns are applied to both **message history** and **real-time messages**. Messages matching any pattern are silently dropped from the UI (but still delivered to `onRawMessage` if set).

---

## Custom Styles

Inject CSS into the Shadow DOM to override the default widget appearance. Each key targets a specific UI region:

```ts
StackAIChat.init({
  wsUrl: '...',
  token: '...',
  customStyles: {
    // Override individual components
    chatButton:      '.chat-button { background: #7c3aed !important; }',
    chatWindow:      '.chat-window { border-radius: 16px; }',
    chatHeader:      '.chat-header { background: linear-gradient(135deg, #0066FF, #7c3aed); }',
    messageList:     '.message-list { background: #f8f9fa; }',
    messageBubble:   '.message-bubble { font-size: 14px; }',
    messageInput:    '.message-input-area { background: #fff; }',
    preChatForm:     '.prechat-form { padding: 32px; }',
    typingIndicator: '.typing-indicator { opacity: 0.6; }',
    // Or write arbitrary CSS including CSS variable overrides
    global:          ':host { --sai-primary: #7c3aed; --sai-primary-hover: #6d28d9; }',
  },
})
```

| Key | Target element | CSS selector |
|-----|---------------|--------------|
| `chatButton` | Floating action button | `.chat-button` |
| `chatWindow` | Main chat window container | `.chat-window` |
| `chatHeader` | Header bar with title & controls | `.chat-header` |
| `messageList` | Messages scrollable area | `.message-list` |
| `messageBubble` | Individual message bubbles | `.message-bubble` |
| `messageInput` | Input area at the bottom | `.message-input-area` |
| `preChatForm` | Pre-chat collection form | `.prechat-form` |
| `typingIndicator` | Agent typing animation | `.typing-indicator` |
| `global` | Arbitrary CSS / CSS variable overrides | *(any selector)* |

> All styles are scoped inside a Shadow DOM — they will not leak into or be affected by your application's CSS.

---

## Token & Flow Types

The server determines the flow based on your JWT `type` claim:

| Token type | Flow |
|------------|------|
| `anonymous` | Server auto-creates a conversation. SDK receives `conversationId` via `presence:update`. |
| `user` | Standard user flow. Pass `conversationId` to resume or let server create one. |
| `agent` | Agent/staff flow. Joins an existing conversation by `conversationId`. |

---

## Features

- **Floating button** — fixed position, bottom-left or bottom-right; auto-hides when chat is open
- **Pre-chat form** — fully configurable fields with validation
- **Session persistence** — skip form on return visits via localStorage
- **Real-time messaging** — Socket.IO with optimistic UI; input disabled while agent is processing
- **Agent presence** — live online/offline status indicator with conversation ID display
- **Typing indicator** — animated dots when agent is typing (8s timeout)
- **Markdown rendering** — agent messages rendered full-width without bubble; supports bold, italic, code blocks, lists, blockquotes, links, tables
- **Claude-style message UI** — agent messages full-width no-bubble; `thinking`/`tool_use`/`tool_result` as collapsible pills; `notice`/`system` as inline banners
- **Greeting message** — configurable welcome message on fresh conversations; skipped when resuming history
- **Session divider** — visual separator between history and new session when resuming a conversation
- **File attachments** — image preview + file chips, configurable limits
- **Reference/quote injection** — inject quoted text into the input via `setReference()`, useful for "reply to selection"
- **Expanded mode** — toggle to 50vw × 80vh (100vw × 100vh on mobile) for more reading space
- **Shadow DOM** — complete CSS isolation from host application
- **Dark / Light / Auto** — theme system via CSS custom properties
- **Anonymous flow** — zero-config conversation creation for anonymous visitors
- **Visible message types** — opt-in to `thinking`, `tool_use`, `tool_result`, `notice`, `system` action types
- **Answer voting** — 👍/👎 under each agent answer over WS `reaction:toggle`; clicking the active button removes the vote; state is restored from history on reload; opt-in via `voting.enabled`
- **Copy answer** — one-click copy of the raw markdown an agent wrote; always available
- **Reference documents** — agent responses with attached sources/citations rendered as interactive chips with detail modal; toggle via `showReferences`
- **Custom styles** — per-component CSS overrides injected into Shadow DOM
- **Version exposure** — `StackAIChat.version` readable by consumer apps; logged to console on init
- **TypeScript** — full type definitions included

---

## Voting & Copy

Every agent answer carries a copy button. Voting is opt-in:

```ts
StackAIChat.init({
  wsUrl: 'wss://xsai-ws.x-or.cloud/chat',
  token: '<jwt>',
  voting: { enabled: true },
  onVote: (e) => console.log(e.actionId, e.vote, e.action),
})
```

**How voting works**

Votes travel over the WebSocket event `reaction:toggle`, not the REST endpoint. A widget
running on an anonymous token holds no valid JWT for REST, so `POST /aiwm/actions/:id/react`
answers `401 Invalid token payload`; WebSocket is the only channel open to those clients.

- Clicking the button that is already active removes the vote — the server decides, the SDK
  never derives the result locally.
- The initial state arrives inside `conversation:history`, so a vote survives a page reload
  with no extra request.
- Buttons lock until the server acknowledges, and a failed acknowledgement rolls the button
  back to its previous state.
- The server allows 10 toggles per 10 seconds per socket. Exceeding it rolls back and reports
  through `onError`; the buttons stay usable.
- Buttons appear only on plain agent answers. The greeting, the message still streaming, and
  `system` / `notice` / `error` / `thinking` / `tool_use` / `tool_result` never get them.
- If the server rejects voting for the session — an agent client, an unauthenticated socket,
  or a token with no identity — the buttons hide until `updateToken()` supplies a new token.

Counts are not rendered: in a one-to-one widget only the recipient votes, so `likes` and
`dislikes` are only ever 0 or 1. They are still stored, readable via `getMessages()`.

**Copying**

The copy button yields the raw markdown the agent wrote, which pastes cleanly into any editor
that understands markdown. It uses the Clipboard API and falls back to `execCommand('copy')`
when the embedding page is served over plain http, where the Clipboard API is unavailable.

---

## Field Types

| Type | Description |
|------|-------------|
| `text` | Plain text input |
| `tel` | Phone number input |
| `email` | Email input |
| `number` | Numeric input |

---

## Theme

The widget uses CSS Custom Properties scoped inside a Shadow DOM — no style conflicts with your app.

| Mode | Description |
|------|-------------|
| `light` | Light theme (default) |
| `dark` | Dark theme |
| `auto` | Follows OS `prefers-color-scheme` |

---

## Requirements

- React >= 18.0.0
- A compatible Stack AI WebSocket backend (NestJS Socket.IO gateway)

---

## License

MIT © [X-OR Cloud](https://x-or.cloud)
