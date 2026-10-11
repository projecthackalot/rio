import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/redirect'

/**
 * OAuth (Google) PKCE callback: exchanges the one-time `code` for a session
 * cookie. New users are provisioned as students by the database trigger.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (searchParams.get('error')) {
    return NextResponse.redirect(new URL('/auth/error?reason=oauth-denied', origin))
  }
  if (!code) {
    return NextResponse.redirect(new URL('/auth/error?reason=missing-code', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth:callback]', { status: error.status, code: error.code })
    return NextResponse.redirect(new URL('/auth/error?reason=oauth', origin))
  }
  return NextResponse.redirect(new URL(next, origin))
}
