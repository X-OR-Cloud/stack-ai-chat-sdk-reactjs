import { create } from 'zustand'
import type {
  SDKConfig,
  ChatPhase,
  Message,
} from '../types'

interface ChatState {
  // Config
  config: SDKConfig | null

  // UI state
  isOpen: boolean
  phase: ChatPhase
  isExpanded: boolean

  // Chat data
  conversationId: string | null
  messages: Message[]
  isAgentTyping: boolean

  // Reference quote injected by host webapp
  reference: string | null

  // User form data
  userFields: Record<string, string>

  // Actions
  setConfig: (config: SDKConfig) => void
  open: () => void
  close: () => void
  setPhase: (phase: ChatPhase) => void
  toggleExpanded: () => void
  setConversationId: (id: string | null) => void
  setReference: (text: string | null) => void
  setUserFields: (fields: Record<string, string>) => void
  addMessage: (message: Message) => void
  prependMessages: (messages: Message[]) => void
  confirmMessage: (localId: string, messageId: string, timestamp: string) => void
  failMessage: (localId: string) => void
  setAgentTyping: (typing: boolean) => void
  reset: () => void
  resetConversation: () => void
}

export const useChatStore = create<ChatState>()((set) => ({
  config: null,
  isOpen: false,
  phase: 'idle',
  isExpanded: false,
  conversationId: null,
  messages: [],
  isAgentTyping: false,
  reference: null,
  userFields: {},

  setConfig: (config) => set({ config }),

  open: () =>
    set((state) => ({
      isOpen: true,
      phase: state.phase === 'idle' ? 'form' : state.phase,
    })),

  close: () => set({ isOpen: false }),

  setPhase: (phase) => set({ phase }),

  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),

  setConversationId: (id) => set({ conversationId: id }),

  setReference: (text) => set({ reference: text }),

  setUserFields: (fields) => set({ userFields: fields }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  prependMessages: (messages) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m.messageId).filter(Boolean))
      const deduped = messages.filter((m) => !m.messageId || !existingIds.has(m.messageId))
      if (!deduped.length) return state
      return { messages: [...deduped, ...state.messages] }
    }),

  confirmMessage: (localId, messageId, timestamp) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.localId === localId
          ? { ...m, messageId, timestamp, status: 'sent' }
          : m
      ),
    })),

  failMessage: (localId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.localId === localId ? { ...m, status: 'failed' } : m
      ),
    })),

  setAgentTyping: (typing) => set({ isAgentTyping: typing }),

  reset: () =>
    set({
      isOpen: false,
      phase: 'idle',
      isExpanded: false,
      conversationId: null,
      messages: [],
      isAgentTyping: false,
      reference: null,
      userFields: {},
    }),

  resetConversation: () =>
    set({
      conversationId: null,
      messages: [],
      isAgentTyping: false,
    }),
}))
