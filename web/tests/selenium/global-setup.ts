/**
 * Starts the production build (`next start`) for the Selenium run unless a
 * server is already answering at SELENIUM_BASE_URL. Requires `npm run build`.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { loadLocalEnv } from '../../scripts/lib/env'

let server: ChildProcess | undefined

async function up(url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return r.status < 500
  } catch {
    return false
  }
}

export async function setup() {
  loadLocalEnv()
  const base = process.env.SELENIUM_BASE_URL ?? 'http://localhost:3400'
  if (await up(base)) return
  if (!existsSync('.next/BUILD_ID')) throw new Error('No production build found. Run `npm run build` first.')
  const port = new URL(base).port || '3400'
  server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'start', '-p', port], { stdio: 'ignore', shell: process.platform === 'win32' })
  for (let i = 0; i < 60; i++) {
    if (await up(base)) return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Server did not start on ${base}`)
}

export async function teardown() {
  if (!server?.pid) return
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  else server.kill('SIGTERM')
}
