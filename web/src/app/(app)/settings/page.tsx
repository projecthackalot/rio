import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { SettingsForm } from '@/components/settings/settings-forms'
import { Skeleton } from '@/components/ui/feedback'
import { requireViewer } from '@/lib/auth/dal'
import { getAllHostels } from '@/lib/data/warden'
import { createClient } from '@/lib/supabase/server'
import { toISTLocalInput } from '@/lib/format'

export const metadata: Metadata = { title: 'Account settings' }

export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl sm:text-5xl">Account settings</h1>
      <Suspense fallback={<Skeleton className="mt-8 h-[36rem]" />}>
        <Settings />
      </Suspense>
    </div>
  )
}

async function Settings() {
  const viewer = await requireViewer('/settings')
  const supabase = await createClient()
  const [hostels, priv] = await Promise.all([
    getAllHostels(),
    supabase.from('profile_private').select('block, room, phone, departure_at').eq('user_id', viewer.id).maybeSingle(),
  ])
  const p = priv.data
  return (
    <div className="mt-8 space-y-8">
      <dl className="rounded-card border-line bg-chalk grid gap-3 border p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Email</dt>
          <dd className="font-medium break-all">{viewer.email ?? 'Not available'}</dd>
        </div>
        <div>
          <dt className="text-muted">Role</dt>
          <dd className="font-medium capitalize">{viewer.role}</dd>
          <dd className="text-muted text-xs">Roles are assigned by a campus administrator.</dd>
        </div>
        <div className="sm:col-span-2">
          <Link href="/auth/forgot-password" className="text-forest font-medium underline underline-offset-4">
            Change password by email
          </Link>
        </div>
      </dl>
      <div className="rounded-card border-line bg-chalk border p-5 sm:p-8">
        <SettingsForm
          hostels={hostels}
          defaults={{
            fullName: viewer.fullName,
            hostelId: viewer.hostelId ?? '',
            block: p?.block ?? '',
            room: p?.room ?? '',
            phone: p?.phone ?? '',
            departure: p?.departure_at ? toISTLocalInput(p.departure_at) : '',
          }}
        />
      </div>
    </div>
  )
}
