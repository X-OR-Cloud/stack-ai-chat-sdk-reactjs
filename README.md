# @xorcloud/stack-ai-chat-sdk

Floating chat widget SDK for React apps — powered by [Stack AI](https://x-or.cloud).

Embed a fully-featured live chat button into any React application in minutes. Connects to your Stack AI backend via Socket.IO with support for real-time messaging, agent presence, typing indicators, file attachments, dark/light mode, and Shadow DOM style isolation.

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
  conversationId: '<conversation-id>',
})
```

The chat button will appear in the bottom-right corner of the screen immediately.

---

## Configuration

```tsx
StackAIChat.init({
  // ── Connection (required) ──────────────────────────────
  wsUrl: 'wss://your-server.com/ws/chat',
  token: '<jwt-token>',
  conversationId: '<conversation-id>',

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

### `StackAIChat.updateConfig(partial)`
Update configuration after initialization (e.g. change theme or title).

### `StackAIChat.destroy()`
Unmount the widget and clean up all resources.

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

## Features

- **Floating button** — fixed position, bottom-left or bottom-right
- **Pre-chat form** — fully configurable fields with validation
- **Session persistence** — skip form on return visits via localStorage
- **Real-time messaging** — Socket.IO with optimistic UI
- **Agent presence** — live online/offline status indicator
- **Typing indicator** — animated dots when agent is typing
- **File attachments** — image preview + file chips, configurable limits
- **Shadow DOM** — complete CSS isolation from host application
- **Dark / Light / Auto** — theme system via CSS custom properties
- **TypeScript** — full type definitions included

---

## Requirements

- React >= 18.0.0
- A compatible Stack AI WebSocket backend (NestJS Socket.IO gateway)

---

## License

MIT © [X-OR Cloud](https://x-or.cloud)
