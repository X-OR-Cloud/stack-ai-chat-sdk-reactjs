import { create } from 'zustand'
import type {
  SDKConfig,
  ChatPhase,
  Message,
  AgentPresence,
} from '../types'

interface ChatState {
  // Config
  config: SDKConfig | null

  // UI state
  isOpen: boolean
  phase: ChatPhase

  // Chat data
  messages: Message[]
  isAgentTyping: boolean
  presence: AgentPresence

  // User form data
  userFields: Record<string, string>

  // Actions
  setConfig: (config: SDKConfig) => void
  open: () => void
  close: () => void
  setPhase: (phase: ChatPhase) => void
  setUserFields: (fields: Record<string, string>) => void
  addMessage: (message: Message) => void
  confirmMessage: (localId: string, messageId: string, timestamp: string) => void
  failMessage: (localId: string) => void
  setAgentTyping: (typing: boolean) => void
  setPresence: (presence: Partial<AgentPresence>) => void
  reset: () => void
}

const initialPresence: AgentPresence = {
  agentId: null,
  status: 'offline',
  lastSeen: null,
}

export const useChatStore = create<ChatState>((set) => ({
  config: null,
  isOpen: false,
  phase: 'idle',
  messages: [],
  isAgentTyping: false,
  presence: initialPresence,
  userFields: {},

  setConfig: (config) => set({ config }),

  open: () =>
    set((state) => ({
      isOpen: true,
      // If no phase set yet, go to form (or chat if session already has fields)
      phase: state.phase === 'idle' ? 'form' : state.phase,
    })),

  close: () => set({ isOpen: false }),

  setPhase: (phase) => set({ phase }),

  setUserFields: (fields) => set({ userFields: fields }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

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

  setPresence: (presence) =>
    set((state) => ({ presence: { ...state.presence, ...presence } })),

  reset: () =>
    set({
      isOpen: false,
      phase: 'idle',
      messages: [],
      isAgentTyping: false,
      presence: initialPresence,
      userFields: {},
    }),
}))
