/**
 * Shared helpers for operator scripts (migrate, seed, doctor). Scripts run
 * outside Next.js, so they load .env.local themselves. Existing process
 * environment variables always win over the file.
 */
import { existsSync, readFileSync } from 'node:fs'
import { Client, type ClientConfig } from 'pg'

export function loadLocalEnv(path = '.env.local'): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

/**
 * Postgres client config for SUPABASE_DB_URL. TLS is always verified:
 * Supabase signs database certificates with its own root CA, so set
 * SUPABASE_DB_CA_CERT to the downloaded CA file when the system store
 * doesn't include it. Verification is never disabled.
 */
export function dbClientConfig(timeoutMs = 120_000): ClientConfig {
  const connectionString = process.env.SUPABASE_DB_URL
  if (!connectionString) throw new Error('SUPABASE_DB_URL is not set in .env.local (Supabase → Connect → Session pooler URI).')
  const caPath = process.env.SUPABASE_DB_CA_CERT
  return {
    connectionString,
    ssl: caPath ? { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true } : { rejectUnauthorized: true },
    statement_timeout: timeoutMs,
    connectionTimeoutMillis: 15_000,
  }
}

/** Connects, translating the common failures into actionable messages. */
export async function connectDb(timeoutMs?: number): Promise<Client> {
  const client = new Client(dbClientConfig(timeoutMs))
  try {
    await client.connect()
    return client
  } catch (error) {
    throw new Error(explainDbError(error))
  }
}

export function explainDbError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (/tenant\/user .* not found|Tenant or user not found/i.test(msg)) {
    return `The database pooler doesn't recognise this project (${msg}). The Supabase project is most likely PAUSED (free projects pause after ~7 idle days) or was deleted. Open the Supabase dashboard and choose "Restore project".`
  }
  if (/password authentication failed/i.test(msg))
    return `Wrong database password in SUPABASE_DB_URL (${msg}). Reset it under Project Settings → Database and update .env.local.`
  if (/certificate|self[- ]signed|unable to verify/i.test(msg)) {
    return `TLS verification failed (${msg}). Download the Supabase CA certificate and set SUPABASE_DB_CA_CERT=<path> in .env.local.`
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return `Database host not found (${msg}). Check the host in SUPABASE_DB_URL and your internet connection.`
  if (/timeout|ETIMEDOUT/i.test(msg)) return `Connection timed out (${msg}). A firewall may block port 5432, or the project is still waking up.`
  return msg
}
