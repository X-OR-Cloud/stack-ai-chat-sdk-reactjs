// Fails when dist/ was not built from the current package.json version.
// Runs in prepublishOnly (after `npm run build`) so every `npm publish` path is covered.
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const bundles = ['dist/index.js', 'dist/index.umd.cjs']

let failed = false
for (const file of bundles) {
  const path = resolve(root, file)
  if (!existsSync(path)) {
    console.error(`[verify-dist-version] ${file} missing — run \`npm run build\` first.`)
    failed = true
    continue
  }
  const src = readFileSync(path, 'utf8')
  if (src.includes('__SDK_VERSION__')) {
    console.error(`[verify-dist-version] ${file} still contains __SDK_VERSION__ — define was not applied.`)
    failed = true
  } else if (!src.includes(JSON.stringify(version))) {
    console.error(`[verify-dist-version] ${file} does not contain version ${JSON.stringify(version)} from package.json — dist is stale, rebuild before publishing.`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log(`[verify-dist-version] dist matches package.json version ${version}`)
