// All SDK styles as a single string — injected into Shadow Root at runtime.
// This avoids Vite/browser injecting into <head> instead of Shadow DOM.

export const SDK_STYLES = /* css */`
/* ── Variables: Light ───────────────────────────────────────────────────── */
:host {
  --sai-primary: #0066FF;
  --sai-primary-hover: #0052cc;
  --sai-primary-text: #ffffff;
  --sai-bg: #ffffff;
  --sai-surface: #f5f7fa;
  --sai-surface-hover: #eef1f6;
  --sai-text: #1a1a2e;
  --sai-text-muted: #6b7280;
  --sai-text-placeholder: #9ca3af;
  --sai-border: #e5e7eb;
  --sai-border-focus: #0066FF;
  --sai-bubble-user-bg: #0066FF;
  --sai-bubble-user-text: #ffffff;
  --sai-bubble-agent-bg: #f0f2f5;
  --sai-bubble-agent-text: #1a1a2e;
  --sai-online: #22c55e;
  --sai-offline: #9ca3af;
  --sai-error: #ef4444;
  --sai-warning: #f59e0b;
  --sai-shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --sai-shadow-md: 0 4px 16px rgba(0,0,0,0.12);
  --sai-shadow-lg: 0 8px 32px rgba(0,0,0,0.16);
  --sai-radius: 12px;
  --sai-radius-sm: 8px;
  --sai-radius-xs: 4px;
  --sai-radius-full: 9999px;
  --sai-transition: 200ms ease;
  --sai-z: 999999;
}

/* ── Variables: Dark ────────────────────────────────────────────────────── */
:host([data-theme="dark"]) {
  --sai-primary: #3b82f6;
  --sai-primary-hover: #2563eb;
  --sai-primary-text: #ffffff;
  --sai-bg: #1a1a2e;
  --sai-surface: #16213e;
  --sai-surface-hover: #0f3460;
  --sai-text: #f1f5f9;
  --sai-text-muted: #94a3b8;
  --sai-text-placeholder: #64748b;
  --sai-border: #2d3748;
  --sai-border-focus: #3b82f6;
  --sai-bubble-user-bg: #3b82f6;
  --sai-bubble-user-text: #ffffff;
  --sai-bubble-agent-bg: #2d3748;
  --sai-bubble-agent-text: #f1f5f9;
  --sai-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --sai-shadow-md: 0 4px 16px rgba(0,0,0,0.4);
  --sai-shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
}

/* ── Base reset ─────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
button { cursor: pointer; border: none; background: none; font-family: inherit; font-size: inherit; color: inherit; }
input, textarea { font-family: inherit; font-size: inherit; color: inherit; border: none; outline: none; background: none; }
:host {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;
}

/* ── Animations ─────────────────────────────────────────────────────────── */
@keyframes sai-fade-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes sai-bounce-in {
  0%   { opacity: 0; transform: scale(0.5); }
  60%  { transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes sai-typing-dot {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30%            { transform: translateY(-4px); opacity: 1; }
}
@keyframes sai-spin { to { transform: rotate(360deg); } }

/* ── ChatButton ─────────────────────────────────────────────────────────── */
.chat-button-wrapper {
  position: fixed; bottom: 24px; z-index: var(--sai-z);
  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
}
.chat-button-wrapper.bottom-right { right: 24px; align-items: flex-end; }
.chat-button-wrapper.bottom-left  { left: 24px;  align-items: flex-start; }
.chat-button {
  width: 56px; height: 56px; border-radius: var(--sai-radius-full);
  background-color: var(--sai-primary); color: var(--sai-primary-text);
  box-shadow: var(--sai-shadow-lg);
  display: flex; align-items: center; justify-content: center;
  position: relative;
  transition: background-color var(--sai-transition), transform var(--sai-transition), box-shadow var(--sai-transition);
  animation: sai-bounce-in 400ms cubic-bezier(0.34,1.56,0.64,1);
}
.chat-button:hover { background-color: var(--sai-primary-hover); transform: scale(1.08); }
.chat-button:active { transform: scale(0.96); }
.chat-button svg { width: 24px; height: 24px; transition: opacity var(--sai-transition), transform var(--sai-transition); }
.chat-button .icon-chat  { position: absolute; opacity: 1; transform: scale(1) rotate(0deg); }
.chat-button .icon-close { position: absolute; opacity: 0; transform: scale(0.5) rotate(-90deg); }
.chat-button.is-open .icon-chat  { opacity: 0; transform: scale(0.5) rotate(90deg); }
.chat-button.is-open .icon-close { opacity: 1; transform: scale(1) rotate(0deg); }
.chat-button-badge {
  position: absolute; top: -4px; right: -4px;
  min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: var(--sai-radius-full);
  background-color: var(--sai-error); color: #fff;
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  animation: sai-bounce-in 300ms ease;
}

/* ── ChatWindow ─────────────────────────────────────────────────────────── */
.chat-window {
  position: fixed; bottom: 92px;
  width: 360px; height: 560px; max-height: calc(100vh - 120px);
  z-index: var(--sai-z);
  display: flex; flex-direction: column;
  border-radius: var(--sai-radius); overflow: hidden;
  background-color: var(--sai-bg);
  box-shadow: var(--sai-shadow-lg);
  border: 1px solid var(--sai-border);
  animation: sai-fade-in 250ms cubic-bezier(0.34,1.56,0.64,1);
}
.chat-window.bottom-right { right: 24px; }
.chat-window.bottom-left  { left: 24px; }

/* Expanded mode — PC */
.chat-window.expanded { width: 50vw; height: 80vh; max-height: 80vh; bottom: 0; border-bottom-left-radius: 0; border-bottom-right-radius: 0; transition: width 200ms ease, height 200ms ease; }
.chat-window.expanded.bottom-right { right: 0; }
.chat-window.expanded.bottom-left  { left: 0; }

/* Expanded mode — Mobile */
@media (max-width: 640px) {
  .chat-window { width: calc(100vw - 24px); }
  .chat-window.expanded { width: 100vw; height: 100vh; max-height: 100vh; bottom: 0; right: 0 !important; left: 0 !important; border-radius: 0; }
}

/* Header */
.chat-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  background-color: var(--sai-primary); color: var(--sai-primary-text);
  flex-shrink: 0;
}
.chat-header__left { display: flex; flex-direction: column; gap: 2px; }
.chat-header__title { font-size: 15px; font-weight: 700; }
.chat-header__subtitle { font-size: 12px; opacity: 0.85; }
.chat-header .agent-status__label { color: rgba(255,255,255,0.85); }
.chat-header .agent-status__dot.online  { background-color: #4ade80; box-shadow: 0 0 0 2px rgba(74,222,128,0.3); }
.chat-header .agent-status__dot.offline { background-color: rgba(255,255,255,0.4); }
.chat-header__right { display: flex; align-items: center; gap: 4px; }
.chat-header__btn {
  width: 32px; height: 32px; border-radius: var(--sai-radius-sm);
  display: flex; align-items: center; justify-content: center;
  color: var(--sai-primary-text); opacity: 0.8;
  transition: opacity var(--sai-transition), background-color var(--sai-transition);
}
.chat-header__btn:hover { opacity: 1; background-color: rgba(255,255,255,0.15); }
.chat-header__btn svg { width: 16px; height: 16px; }

/* Connecting */
.chat-connecting {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; color: var(--sai-text-muted); font-size: 14px;
}
.chat-connecting__spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--sai-border);
  border-top-color: var(--sai-primary);
  border-radius: 50%;
  animation: sai-spin 0.8s linear infinite;
}

/* ── PreChatForm ────────────────────────────────────────────────────────── */
.prechat-form { display: flex; flex-direction: column; gap: 16px; padding: 24px; flex: 1; overflow-y: auto; }
.prechat-form__header { margin-bottom: 4px; }
.prechat-form__title { font-size: 18px; font-weight: 700; color: var(--sai-text); }
.prechat-form__subtitle { font-size: 13px; color: var(--sai-text-muted); margin-top: 4px; }
.prechat-form__fields { display: flex; flex-direction: column; gap: 12px; }
.prechat-form__field { display: flex; flex-direction: column; gap: 4px; }
.prechat-form__label { font-size: 13px; font-weight: 600; color: var(--sai-text); }
.prechat-form__required { color: var(--sai-error); margin-left: 2px; }
.prechat-form__input {
  width: 100%; padding: 10px 12px;
  border-radius: var(--sai-radius-sm); border: 1.5px solid var(--sai-border);
  background-color: var(--sai-bg); color: var(--sai-text); font-size: 14px;
  transition: border-color var(--sai-transition), box-shadow var(--sai-transition);
}
.prechat-form__input::placeholder { color: var(--sai-text-placeholder); }
.prechat-form__input:focus { border-color: var(--sai-border-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sai-primary) 15%, transparent); }
.prechat-form__input.error { border-color: var(--sai-error); }
.prechat-form__error { font-size: 12px; color: var(--sai-error); }
.prechat-form__submit {
  width: 100%; padding: 12px;
  border-radius: var(--sai-radius-sm);
  background-color: var(--sai-primary); color: var(--sai-primary-text);
  font-size: 15px; font-weight: 600;
  transition: background-color var(--sai-transition), transform var(--sai-transition);
  margin-top: 4px;
}
.prechat-form__submit:hover:not(:disabled) { background-color: var(--sai-primary-hover); }
.prechat-form__submit:active:not(:disabled) { transform: scale(0.98); }
.prechat-form__submit:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── MessageList ────────────────────────────────────────────────────────── */
.message-list {
  flex: 1; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 8px; scroll-behavior: smooth;
}
.message-list::-webkit-scrollbar { width: 4px; }
.message-list::-webkit-scrollbar-track { background: transparent; }
.message-list::-webkit-scrollbar-thumb { background: var(--sai-border); border-radius: 4px; }
.message-row { display: flex; flex-direction: column; animation: sai-fade-in 200ms ease; }
.message-row.user      { align-items: flex-end; }
.message-row.assistant { align-items: flex-start; }
.message-bubble {
  max-width: 78%; padding: 10px 14px;
  border-radius: var(--sai-radius);
  font-size: 14px; line-height: 1.55;
  word-break: break-word; white-space: pre-wrap; position: relative;
}
.message-row.assistant .message-bubble { white-space: normal; }
.message-row.user      .message-bubble { background-color: var(--sai-bubble-user-bg);  color: var(--sai-bubble-user-text);  border-bottom-right-radius: var(--sai-radius-xs); }
.message-row.assistant .message-bubble { background-color: var(--sai-bubble-agent-bg); color: var(--sai-bubble-agent-text); border-bottom-left-radius: var(--sai-radius-xs); }
.message-row.user .message-bubble.status-failed { background-color: color-mix(in srgb, var(--sai-error) 80%, transparent); }
.message-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; padding: 0 4px; }
.message-time { font-size: 11px; color: var(--sai-text-muted); }
.message-status-icon { font-size: 11px; color: var(--sai-text-muted); }
.message-status-icon.failed { color: var(--sai-error); }
.message-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.message-attachment-chip { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: var(--sai-radius-sm); background-color: rgba(0,0,0,0.12); font-size: 12px; max-width: 180px; overflow: hidden; }
.message-attachment-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.message-attachment-image { max-width: 200px; max-height: 160px; border-radius: var(--sai-radius-sm); object-fit: cover; margin-top: 6px; }

/* ── Markdown body (agent messages) ────────────────────────────────────── */
.md-body { display: flex; flex-direction: column; gap: 6px; }
.md-body .md-p { margin: 0; }
.md-body .md-h1, .md-body .md-h2, .md-body .md-h3,
.md-body .md-h4, .md-body .md-h5, .md-body .md-h6 { margin: 4px 0 2px; font-weight: 700; line-height: 1.3; }
.md-body .md-h1 { font-size: 1.2em; }
.md-body .md-h2 { font-size: 1.1em; }
.md-body .md-h3 { font-size: 1em; }
.md-body .md-ul, .md-body .md-ol { margin: 2px 0; padding-left: 20px; display: flex; flex-direction: column; gap: 2px; }
.md-body .md-ul li, .md-body .md-ol li { margin: 0; }
.md-body .md-blockquote { margin: 2px 0; padding: 4px 10px; border-left: 3px solid currentColor; opacity: 0.75; font-style: italic; }
.md-body .md-hr { border: none; border-top: 1px solid currentColor; opacity: 0.25; margin: 4px 0; }
.md-body .md-code-inline { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.88em; padding: 1px 5px; border-radius: 4px; background: rgba(0,0,0,0.12); }
.message-row.user .md-code-inline { background: rgba(255,255,255,0.2); }
.md-body .md-code-block { margin: 4px 0; padding: 10px 12px; border-radius: var(--sai-radius-sm); background: rgba(0,0,0,0.15); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.6; overflow-x: auto; white-space: pre; }
.md-body .md-link { color: inherit; text-decoration: underline; opacity: 0.9; }
.md-body .md-link:hover { opacity: 1; }

/* ── MessageInput ───────────────────────────────────────────────────────── */
/* ── Reference chip ─────────────────────────────────────────────────────── */
.reference-chip {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 6px 10px; border-radius: var(--sai-radius-sm);
  background: color-mix(in srgb, var(--sai-primary) 10%, transparent);
  border-left: 3px solid var(--sai-primary);
  font-size: 12px; color: var(--sai-text-muted);
}
.reference-chip__icon { width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px; color: var(--sai-primary); opacity: 0.7; }
.reference-chip__text { flex: 1; line-height: 1.4; word-break: break-word; font-style: italic; }
.reference-chip__remove { flex-shrink: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 3px; color: var(--sai-text-muted); opacity: 0.6; transition: opacity var(--sai-transition); margin-top: 1px; }
.reference-chip__remove:hover { opacity: 1; color: var(--sai-error); }
.reference-chip__remove svg { width: 10px; height: 10px; }

.message-input-area { border-top: 1px solid var(--sai-border); background-color: var(--sai-bg); padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
.attachment-preview-bar { display: flex; flex-wrap: wrap; gap: 8px; }
.attachment-preview-item { position: relative; display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: var(--sai-radius-sm); background-color: var(--sai-surface); border: 1px solid var(--sai-border); font-size: 12px; color: var(--sai-text); max-width: 160px; }
.attachment-preview-item__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100px; }
.attachment-preview-item__size { color: var(--sai-text-muted); font-size: 11px; white-space: nowrap; }
.attachment-preview-item__remove { flex-shrink: 0; width: 16px; height: 16px; border-radius: var(--sai-radius-full); background-color: var(--sai-text-muted); color: var(--sai-bg); display: flex; align-items: center; justify-content: center; font-size: 10px; transition: background-color var(--sai-transition); }
.attachment-preview-item__remove:hover { background-color: var(--sai-error); }
.attachment-preview-image { width: 36px; height: 36px; border-radius: var(--sai-radius-xs); object-fit: cover; }
.message-input-row { display: flex; align-items: flex-end; gap: 8px; }
.message-input-field {
  flex: 1; padding: 10px 12px;
  border-radius: var(--sai-radius-sm); border: 1.5px solid var(--sai-border);
  background-color: var(--sai-surface); color: var(--sai-text);
  font-size: 14px; resize: none; max-height: 120px; overflow-y: auto; line-height: 1.5;
  transition: border-color var(--sai-transition), box-shadow var(--sai-transition);
}
.message-input-field:focus { border-color: var(--sai-border-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sai-primary) 15%, transparent); }
.message-input-field::placeholder { color: var(--sai-text-placeholder); }
.message-input-field::-webkit-scrollbar { width: 3px; }
.message-input-field::-webkit-scrollbar-thumb { background: var(--sai-border); border-radius: 3px; }
.input-action-btn { flex-shrink: 0; width: 38px; height: 38px; border-radius: var(--sai-radius-sm); display: flex; align-items: center; justify-content: center; transition: background-color var(--sai-transition), color var(--sai-transition); color: var(--sai-text-muted); }
.input-action-btn:hover:not(:disabled) { background-color: var(--sai-surface-hover); color: var(--sai-text); }
.input-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.input-action-btn.send { background-color: var(--sai-primary); color: var(--sai-primary-text); }
.input-action-btn.send:hover:not(:disabled) { background-color: var(--sai-primary-hover); }
.input-action-btn svg { width: 18px; height: 18px; }
.file-input-hidden { display: none; }

/* ── Sources panel ──────────────────────────────────────────────────────── */
.sources-panel {
  display: flex; flex-direction: column; gap: 4px;
  margin-top: 4px; padding: 0 2px; max-width: 78%;
}
.sources-panel__label {
  font-size: 11px; color: var(--sai-text-muted); font-weight: 500;
}
.sources-panel__chips { display: flex; flex-wrap: wrap; gap: 4px; }
.source-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: var(--sai-radius-full);
  background-color: var(--sai-surface); border: 1px solid var(--sai-border);
  color: var(--sai-text-muted); font-size: 11px; cursor: pointer;
  transition: background-color var(--sai-transition), color var(--sai-transition), border-color var(--sai-transition);
  max-width: 160px;
}
.source-chip:hover { background-color: var(--sai-surface-hover); color: var(--sai-text); border-color: var(--sai-primary); }
.source-chip__icon { width: 12px; height: 12px; flex-shrink: 0; }
.source-chip__icon svg { width: 12px; height: 12px; }
.source-chip__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-chip__score { flex-shrink: 0; opacity: 0.7; font-size: 10px; }

/* Source detail modal */
.source-modal-overlay {
  position: fixed; inset: 0; z-index: calc(var(--sai-z) + 1);
  background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
  padding: 16px;
  animation: sai-fade-in 150ms ease;
}
.source-modal {
  background-color: var(--sai-bg); border-radius: var(--sai-radius);
  box-shadow: var(--sai-shadow-lg); border: 1px solid var(--sai-border);
  width: 100%; max-width: 360px; max-height: 70vh;
  display: flex; flex-direction: column; overflow: hidden;
  animation: sai-fade-in 150ms ease;
}
.source-modal__header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--sai-border); flex-shrink: 0;
}
.source-modal__icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--sai-primary); }
.source-modal__icon svg { width: 16px; height: 16px; }
.source-modal__title { flex: 1; font-size: 13px; font-weight: 600; color: var(--sai-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-modal__score { font-size: 11px; color: var(--sai-text-muted); flex-shrink: 0; background-color: var(--sai-surface); padding: 2px 6px; border-radius: var(--sai-radius-full); }
.source-modal__close { flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: var(--sai-radius-xs); color: var(--sai-text-muted); transition: color var(--sai-transition); }
.source-modal__close:hover { color: var(--sai-text); }
.source-modal__close svg { width: 14px; height: 14px; }
.source-modal__url {
  display: block; padding: 6px 14px; font-size: 11px;
  color: var(--sai-primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border-bottom: 1px solid var(--sai-border); flex-shrink: 0;
}
.source-modal__url:hover { text-decoration: underline; }
.source-modal__content {
  flex: 1; overflow-y: auto; padding: 12px 14px;
  font-size: 13px; line-height: 1.6; color: var(--sai-text);
  white-space: pre-wrap; word-break: break-word;
}
.source-modal__content::-webkit-scrollbar { width: 4px; }
.source-modal__content::-webkit-scrollbar-thumb { background: var(--sai-border); border-radius: 4px; }

/* ── TypingIndicator ────────────────────────────────────────────────────── */
.typing-indicator { display: flex; align-items: center; gap: 4px; padding: 12px 16px; width: fit-content; }
.typing-dot { width: 7px; height: 7px; border-radius: var(--sai-radius-full); background-color: var(--sai-text-muted); animation: sai-typing-dot 1.2s ease infinite; }
.typing-dot:nth-child(1) { animation-delay: 0s; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

/* ── AgentStatus ────────────────────────────────────────────────────────── */
.agent-status { display: flex; align-items: center; gap: 5px; }
.agent-status__dot { width: 8px; height: 8px; border-radius: var(--sai-radius-full); flex-shrink: 0; transition: background-color var(--sai-transition); }
.agent-status__dot.online  { background-color: var(--sai-online); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sai-online) 30%, transparent); }
.agent-status__dot.offline { background-color: var(--sai-offline); }
.agent-status__label { font-size: 12px; color: var(--sai-text-muted); }
.agent-status__bullet { font-size: 12px; color: var(--sai-text-muted); line-height: 1; }
.agent-status__conv-id { font-size: 11px; color: var(--sai-text-muted); font-family: 'SF Mono', 'Fira Code', monospace; letter-spacing: 0.04em; }
.agent-status__copy { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; padding: 0; border-radius: 3px; color: var(--sai-text-muted); opacity: 0.7; transition: opacity var(--sai-transition), color var(--sai-transition); }
.agent-status__copy:hover { opacity: 1; }
.agent-status__copy.copied { color: var(--sai-online); opacity: 1; }
.agent-status__copy svg { width: 12px; height: 12px; }
.chat-header .agent-status__bullet { color: rgba(255,255,255,0.5); }
.chat-header .agent-status__conv-id { color: rgba(255,255,255,0.7); }
.chat-header .agent-status__copy { color: rgba(255,255,255,0.7); }
.chat-header .agent-status__copy:hover { color: #fff; opacity: 1; }
.chat-header .agent-status__copy.copied { color: #4ade80; }
`
