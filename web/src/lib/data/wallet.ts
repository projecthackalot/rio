import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/** Viewer's sandbox balance in paise (RLS: owner-only). */
export const getWalletBalance = cache(async (): Promise<number | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('wallet_accounts').select('balance_paise').maybeSingle()
  if (error) {
    console.error('[wallet]', error.code)
    return null
  }
  return data ? Number(data.balance_paise) : null
})

export interface LedgerRow {
  id: string
  type: string
  amount_paise: number
  balance_after_paise: number
  note: string | null
  listing_id: string | null
  created_at: string
}

export async function getLedger(limit = 50): Promise<LedgerRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('id, type, amount_paise, balance_after_paise, note, listing_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`ledger: ${error.code}`)
  return (data ?? []).map((r) => ({ ...r, amount_paise: Number(r.amount_paise), balance_after_paise: Number(r.balance_after_paise) }))
}
