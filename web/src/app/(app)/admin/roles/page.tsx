import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RoleForm } from '@/components/settings/settings-forms'
import { AccessDenied } from '@/components/ui/access-denied'
import { Badge } from '@/components/ui/badges'
import { Skeleton } from '@/components/ui/feedback'
import { requireViewer } from '@/lib/auth/dal'
import { getAllHostels } from '@/lib/data/warden'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Roles' }

export default function RolesPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-4xl sm:text-5xl">Roles and access</h1>
      <p className="text-muted mt-3">
        Everyone who signs up is a student. Only administrators can grant warden, staff or administrator access, always scoped to hostels.
      </p>
      <Suspense fallback={<Skeleton className="mt-8 h-96" />}>
        <Roles />
      </Suspense>
    </div>
  )
}

async function Roles() {
  const viewer = await requireViewer('/admin/roles')
  if (viewer.role !== 'admin')
    return (
      <div className="mt-8">
        <AccessDenied need="campus administrators" />
      </div>
    )
  const supabase = await createClient()
  const [hostels, people, assignments, audit] = await Promise.all([
    getAllHostels(),
    supabase.from('profiles').select('id, full_name, role').neq('id', viewer.id).order('full_name').limit(500),
    supabase.from('hostel_assignments').select('user_id, hostel_id'),
    supabase
      .from('audit_events')
      .select('id, action, entity_id, details, created_at')
      .eq('action', 'role.set')
      .order('created_at', { ascending: false })
      .limit(20),
  ])
  const hostelName = new Map(hostels.map((h) => [h.id, h.name]))
  const scopes = new Map<string, string[]>()
  for (const a of assignments.data ?? []) scopes.set(a.user_id, [...(scopes.get(a.user_id) ?? []), hostelName.get(a.hostel_id) ?? '?'])
  const privileged = (people.data ?? []).filter((p) => p.role !== 'student')
  const nameOf = new Map((people.data ?? []).map((p) => [p.id, p.full_name]))

  return (
    <div className="mt-8 space-y-10">
      <section aria-labelledby="grant-heading" className="rounded-card border-line bg-chalk border p-5 sm:p-8">
        <h2 id="grant-heading" className="text-2xl">
          Change a role
        </h2>
        <div className="mt-5">
          <RoleForm people={(people.data ?? []).map((p) => ({ id: p.id, name: p.full_name, role: p.role }))} hostels={hostels} />
        </div>
      </section>

      <section aria-labelledby="current-heading">
        <h2 id="current-heading" className="text-2xl">
          Wardens, staff and administrators
        </h2>
        {privileged.length === 0 ? (
          <p className="text-muted mt-3">Nobody else has elevated access.</p>
        ) : (
          <ul className="divide-line rounded-card border-line bg-chalk mt-4 divide-y border">
            {privileged.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="font-medium">{p.full_name}</span>
                <span className="text-muted flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone="forest" className="capitalize">
                    {p.role}
                  </Badge>
                  {(scopes.get(p.id) ?? []).join(', ') || (p.role === 'admin' ? 'All hostels' : 'No hostels')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="audit-heading">
        <h2 id="audit-heading" className="text-2xl">
          Recent role changes
        </h2>
        {(audit.data ?? []).length === 0 ? (
          <p className="text-muted mt-3">No changes recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {(audit.data ?? []).map((e) => {
              const d = e.details as { from?: string; to?: string }
              return (
                <li key={e.id} className="border-line flex flex-wrap justify-between gap-3 border-b pb-2">
                  <span>
                    {nameOf.get(e.entity_id ?? '') ?? 'A user'}: {d.from} to {d.to}
                  </span>
                  <span className="tabular text-muted">{formatDateTime(e.created_at)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
