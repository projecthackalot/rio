import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/redirect'
import { otpTypeSchema } from '@/lib/validation/auth'

/**
 * Email link handler for signup confirmation, magic links, password recovery
 * and email change. Supabase email templates must link here with
 * `?token_hash={{ .TokenHash }}&type=<type>` (see docs/level-1/SETUP.md).
 * A `code` parameter (PKCE email flow) is also accepted.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = otpTypeSchema.safeParse(searchParams.get('type'))
  const next = safeNext(searchParams.get('next'))
  const supabase = await createClient()

  let failed = true
  if (tokenHash && type.success) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type.data })
    failed = Boolean(error)
    if (error) console.error('[auth:confirm]', { status: error.status, code: error.code })
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    failed = Boolean(error)
    if (error) console.error('[auth:confirm]', { status: error.status, code: error.code })
  }

  if (failed) return NextResponse.redirect(new URL('/auth/error?reason=link', origin))

  const destination = type.success && type.data === 'recovery' ? '/auth/update-password' : next
  return NextResponse.redirect(new URL(destination, origin))
}
