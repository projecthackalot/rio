'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in production, use Zod to validate these inputs
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect('/auth/login?error=Could not authenticate user')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const role = formData.get('role') as 'student' | 'warden' | 'staff'

  // 1. Sign up the user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return redirect('/auth/login?error=Could not sign up user: ' + error.message)
  }

  if (data.user) {
    // 2. Create the profile using admin client to bypass RLS
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: data.user.id,
        full_name: fullName,
        role: role || 'student',
        wallet_balance: 3000.0, // Sandbox starting balance
      })

    if (profileError) {
       console.error("Profile creation error:", profileError)
       // We still created the user, but profile failed. 
       // In a robust app, we'd handle this better.
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
