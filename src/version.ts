// Injected at build time from package.json via `define` in vite.config.ts
// (and demo/vite.demo.config.ts) — never edit a version number here.
declare const __SDK_VERSION__: string

export const SDK_VERSION: string = __SDK_VERSION__
