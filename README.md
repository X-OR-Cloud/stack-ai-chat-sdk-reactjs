# @xorcloud/stack-ai-chat-sdk

Floating chat widget SDK for React apps — powered by [Stack AI](https://x-or.cloud).

Embed a fully-featured live chat button into any React application in minutes. Connects to your Stack AI backend via Socket.IO with support for real-time messaging, agent presence, typing indicators, file attachments, markdown rendering, reference/quote injection, expanded mode, dark/light mode, and Shadow DOM style isolation.

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

### `StackAIChat.init(config)`
Initialize and mount the chat widget. Can only be called once — call `destroy()` first to re-initialize.

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
| `socketPath` | `string` | — | Socket.IO path. Default: `'/ws/chat'` |
| `fields` | `FieldConfig[]` | — | Pre-chat form fields |
| `session` | `SessionConfig` | — | Form session persistence |
| `attachments` | `AttachmentsConfig` | — | File attachment settings |
| `position` | `'bottom-right' \| 'bottom-left'` | — | Widget position |
| `title` | `string` | — | Chat header title |
| `subtitle` | `string` | — | Chat header subtitle |
| `theme` | `ThemeConfig` | — | Theme settings |
| `onOpen` | `() => void` | — | Called when widget opens |
| `onClose` | `() => void` | — | Called when widget closes |
| `onConnected` | `() => void` | — | Called when socket connects |
| `onDisconnected` | `() => void` | — | Called when socket disconnects |
| `onConversationJoined` | `(id: string) => void` | — | Called when conversation ID is known |
| `onPresenceUpdate` | `(payload: PresenceUpdatePayload) => void` | — | Called on agent/user presence changes |
| `onError` | `(message: string) => void` | — | Called on errors |
| `onMessage` | `(message: Message) => void` | — | Called on new incoming messages |
| `onFormSubmit` | `(data: Record<string, string>) => void` | — | Called when pre-chat form is submitted |

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

- **Floating button** — fixed position, bottom-left or bottom-right
- **Pre-chat form** — fully configurable fields with validation
- **Session persistence** — skip form on return visits via localStorage
- **Real-time messaging** — Socket.IO with optimistic UI
- **Agent presence** — live online/offline status indicator with conversation ID display
- **Typing indicator** — animated dots when agent is typing
- **Markdown rendering** — agent messages rendered with bold, italic, code blocks, lists, blockquotes, links, and more
- **File attachments** — image preview + file chips, configurable limits
- **Reference/quote injection** — inject quoted text into the input via `setReference()`, useful for "reply to selection"
- **Expanded mode** — toggle to 50vw × 80vh (100vw × 100vh on mobile) for more reading space
- **Shadow DOM** — complete CSS isolation from host application
- **Dark / Light / Auto** — theme system via CSS custom properties
- **Anonymous flow** — zero-config conversation creation for anonymous visitors
- **TypeScript** — full type definitions included

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
