import { NextResponse, type NextRequest } from 'next/server'
import { connection } from 'next/server'
import { publicEnv } from '@/lib/env'

/**
 * Daily keep-alive for free hosting. Supabase pauses free projects after about
 * a week without database activity; Vercel's cron (vercel.json) calls this once
 * a day, and it makes one tiny public read so the project stays awake.
 *
 * It reads only public reference data with the anon key and returns no data.
 * When CRON_SECRET is set (Vercel sends it automatically as a Bearer token),
 * other callers are rejected so the endpoint can't be used to generate load.
 */
export async function GET(request: NextRequest) {
  await connection()
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const env = publicEnv()
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/categories?select=slug&limit=1`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
      cache: 'no-store',
    })
    return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
