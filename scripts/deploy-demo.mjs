#!/usr/bin/env node
/**
 * Deploy demo build to remote server via rsync/scp.
 * Reads connection config from .env (gitignored).
 *
 * Usage: npm run deploy:demo
 * (build:demo runs first as part of the npm script chain)
 *
 * .env example:
 *   DEPLOY_HOST=172.16.2.100
 *   DEPLOY_USER=root
 *   DEPLOY_PORT=22
 *   DEPLOY_PATH=/var/www/sdk-playground/
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const envPath = resolve(root, '.env')
const demoDist = resolve(root, 'demo-dist')

// ─── Parse .env (no dotenv dependency) ──────────────────────────────────────
function parseEnv(path) {
  if (!existsSync(path)) return null
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    out[key] = val
  }
  return out
}

const env = parseEnv(envPath)
if (!env) {
  console.error('[deploy] .env not found. Copy .env.example to .env and fill in values:')
  console.error(`  cp .env.example .env`)
  process.exit(1)
}

const { DEPLOY_HOST, DEPLOY_USER, DEPLOY_PORT, DEPLOY_PATH } = env
if (!DEPLOY_HOST || !DEPLOY_USER || !DEPLOY_PATH) {
  console.error('[deploy] Missing required .env vars. Check .env.example for required fields.')
  process.exit(1)
}

const port = DEPLOY_PORT || '22'
const target = `${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}`

// ─── Check demo-dist exists ──────────────────────────────────────────────────
if (!existsSync(demoDist)) {
  console.error(`[deploy] demo-dist/ not found. Run "npm run build:demo" first.`)
  process.exit(1)
}

// ─── Deploy via rsync (preferred) or scp (fallback) ─────────────────────────
function hasRsync() {
  try { execSync('rsync --version', { stdio: 'pipe' }); return true }
  catch { return false }
}

console.log(`[deploy] Uploading demo-dist/ → ${target}`)

if (hasRsync()) {
  const cmd = `rsync -avz --delete -e "ssh -p ${port}" "${demoDist}/" "${target}"`
  console.log(`[deploy] rsync: ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
} else {
  console.log('[deploy] rsync not found, falling back to scp -r')
  const cmd = `scp -r -P ${port} "${demoDist}/"* "${target}"`
  console.log(`[deploy] scp: ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

console.log(`\n[deploy] Done. Demo available at: https://vibe.x-or.cloud/sdk-playground/`)
