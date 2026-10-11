'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { publicEnv } from '@/lib/env'
import { safeNext } from '@/lib/auth/redirect'
import { echoValues, fromZodError, type ActionState } from '@/lib/action-state'
import { emailOnlySchema, loginSchema, signupSchema, updatePasswordSchema } from '@/lib/validation/auth'

/**
 * Absolute origin for auth email links and OAuth callbacks. It comes from the
 * configured NEXT_PUBLIC_SITE_URL, never from request headers: a forged
 * Host / X-Forwarded-Host could otherwise point password-reset links at an
 * attacker's domain. The only fallback is a loopback Host during local
 * development; everything else fails closed.
 */
async function siteOrigin(): Promise<string> {
  const configured = publicEnv().NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/$/, '')
  if (process.env.NODE_ENV !== 'production') {
    const host = (await headers()).get('host') ?? ''
    if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host)) return `http://${host}`
  }
  throw new Error('NEXT_PUBLIC_SITE_URL must be set to the app’s public origin (see docs/level-1/SETUP.md).')
}

function logAuthError(action: string, error: { message: string; status?: number; code?: string }) {
  // Never log credentials or tokens — only the failure category.
  console.error(`[auth:${action}]`, { status: error.status, code: error.code })
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fromZodError(parsed.error, echoValues(formData))

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
  if (error) {
    if (error.code === 'email_not_confirmed') {
      return { status: 'error', message: 'Please confirm your email first — check your inbox for the link.', values: echoValues(formData) }
    }
    logAuthError('login', error)
    // Same message for unknown email and wrong password (no account enumeration).
    return { status: 'error', message: 'That email and password combination didn’t work.', values: echoValues(formData) }
  }

  revalidatePath('/', 'layout')
  redirect(safeNext(parsed.data.next))
}

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fromZodError(parsed.error, echoValues(formData))

  const supabase = await createClient()
  const origin = await siteOrigin()
  const next = safeNext(parsed.data.next)
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Only the display name is sent. The role is assigned by the database (always 'student').
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    logAuthError('signup', error)
    if (error.code === 'weak_password') {
      return { status: 'error', fieldErrors: { password: [error.message] }, values: echoValues(formData) }
    }
    if (error.status === 429) {
      return { status: 'error', message: 'Too many attempts. Please wait a minute and try again.', values: echoValues(formData) }
    }
    return { status: 'error', message: 'We couldn’t create your account. Please try again.', values: echoValues(formData) }
  }

  // With email confirmation enabled (recommended) there is no session yet:
  // never send the user into authenticated pages without one.
  if (!data.session) redirect(`/auth/check-email?type=signup&email=${encodeURIComponent(parsed.data.email)}`)

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function sendMagicLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fromZodError(parsed.error, echoValues(formData))

  const supabase = await createClient()
  const origin = await siteOrigin()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // Magic links sign in existing accounts only; new accounts go through signup.
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(safeNext(parsed.data.next))}`,
    },
  })
  if (error && error.status === 429) {
    return { status: 'error', message: 'Too many requests. Please wait a minute and try again.', values: echoValues(formData) }
  }
  if (error) logAuthError('magic-link', error)
  // Respond identically whether or not the account exists.
  redirect(`/auth/check-email?type=magiclink&email=${encodeURIComponent(parsed.data.email)}`)
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fromZodError(parsed.error, echoValues(formData))

  const supabase = await createClient()
  const origin = await siteOrigin()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/auth/update-password`,
  })
  if (error && error.status === 429) {
    return { status: 'error', message: 'Too many requests. Please wait a minute and try again.', values: echoValues(formData) }
  }
  if (error) logAuthError('reset', error)
  redirect(`/auth/check-email?type=recovery&email=${encodeURIComponent(parsed.data.email)}`)
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fromZodError(parsed.error)

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) {
    return { status: 'error', message: 'Your reset link has expired. Request a new one.' }
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    logAuthError('update-password', error)
    if (error.code === 'same_password') return { status: 'error', fieldErrors: { password: ['Choose a password you haven’t used here before.'] } }
    if (error.code === 'weak_password') return { status: 'error', fieldErrors: { password: [error.message] } }
    return { status: 'error', message: 'We couldn’t update your password. Please try again.' }
  }
  revalidatePath('/', 'layout')
  redirect('/dashboard?notice=password-updated')
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const origin = await siteOrigin()
  const next = safeNext(formData.get('next'))
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error || !data.url) {
    if (error) logAuthError('google', error)
    redirect('/auth/error?reason=oauth')
  }
  redirect(data.url)
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/?notice=signed-out')
}
