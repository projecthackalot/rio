/**
 * Maps the `RIO_<CODE>` exceptions raised by the database functions
 * (supabase/migrations/*_functions.sql) to messages a person can act on.
 * Unknown errors get a generic message — raw database errors are logged on
 * the server, never shown to users.
 */

const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Please sign in to continue.',
  NOT_FOUND: 'We couldn’t find that item. It may have been removed.',
  NOT_PARTY: 'Only the people involved in this transaction can do that.',
  NOT_AUTHORIZED: 'Your account doesn’t have permission to do that.',
  STUDENTS_ONLY: 'Only student accounts can buy or rent items.',
  OWN_LISTING: 'You can’t claim or rent your own listing.',
  UNAVAILABLE: 'Someone else got there first — this item is no longer available.',
  TRADING_CLOSED: 'Trading has closed: the owner leaves within the hour, so this item goes to campus staff.',
  CATEGORY_LIMIT: 'Anti-hoarding rule: you already have an item in this category.',
  INSUFFICIENT_FUNDS: 'Your sandbox balance is too low for this.',
  NOT_RENTABLE: 'The owner hasn’t made this item available to rent.',
  RENTAL_TOO_LONG: 'The owner leaves too soon for that rental period. Try a shorter one.',
  ILLEGAL_STATE: 'That action isn’t possible at this stage. Refresh to see the latest status.',
  INVALID_CODE: 'That handover code isn’t valid. Check it and try again.',
  CODE_USED: 'That handover code has already been used.',
  CODE_EXPIRED: 'That handover code has expired. Ask for a fresh one.',
  CODE_REPLACED: 'A newer code was issued for this handover. Ask for the latest one.',
  NOT_RECEIVER: 'This code is meant for someone else to scan.',
  REASON_REQUIRED: 'Please describe what happened (at least 10 characters).',
  INVALID_EVIDENCE: 'That evidence file can’t be attached.',
  CONFLICT_OF_INTEREST: 'You’re involved in this dispute, so another warden must decide it.',
  INVALID_OUTCOME: 'That outcome doesn’t apply to this dispute.',
  DISPUTE_CLOSED: 'This dispute has already been decided.',
  ALREADY_ROUTED: 'This item has already been routed to staff.',
  NOT_ROUTABLE: 'Items can be routed to staff only in the owner’s final hour or after departure.',
  DUPLICATE_SETTLEMENT: 'This payment step has already been applied.',
  SELF_ROLE_CHANGE: 'You can’t change your own role.',
  DEPARTURE_TOO_SOON: 'Departure must be at least 3 hours from now so the auction can run.',
  DEPARTURE_TOO_FAR: 'Departure must be within the next year.',
  WALLET_MISSING: 'Your sandbox wallet isn’t set up. Please contact a warden.',
  INVALID_INPUT: 'Some of the information provided isn’t valid.',
}

export const GENERIC_ERROR = 'Something went wrong. Please try again.'

export function rioErrorCode(error: { message?: string } | null | undefined): string | null {
  const match = error?.message?.match(/RIO_([A-Z_]+)/)
  return match ? match[1] : null
}

export function rpcErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  const code = rioErrorCode(error)
  if (code && MESSAGES[code]) return MESSAGES[code]
  if (error?.code === '42501') return MESSAGES.NOT_AUTHORIZED
  return GENERIC_ERROR
}
