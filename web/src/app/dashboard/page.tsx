import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/auth/actions'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="bg-white border-b border-zinc-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <span className="text-2xl font-black tracking-tighter text-orange-600">RIO</span>
              </div>
            </div>
            <div className="flex items-center">
               <span className="text-sm text-zinc-600 mr-4">
                 {profile?.full_name} ({profile?.role})
               </span>
               <span className="text-sm font-bold text-orange-600 mr-6 bg-orange-50 px-3 py-1 rounded-full">
                 ₹{profile?.wallet_balance}
               </span>
               <form action={logout}>
                 <button className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">
                   Sign out
                 </button>
               </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-8">Marketplace</h1>
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-500">
          The marketplace feed is under construction.
        </div>
      </main>
    </div>
  )
}
