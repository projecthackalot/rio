/**
 * Lifecycle state machines for listings, claims, rentals, disputes and staff
 * transfers. The database RPCs enforce the same transitions (they lock the
 * row, check the current status, and raise on anything not listed here);
 * this module is used by the UI to decide which actions to offer and by the
 * unit tests to pin the rules down.
 */

export const LISTING_STATUSES = [
  'ACTIVE', //         on the marketplace
  'RESERVED', //       a purchase claim is awaiting QR handover
  'RENTED', //         booked or out on rent
  'SOLD', //           handed over and settled (or rent-to-own completed)
  'STAFF_PENDING', //  routed to campus staff in the final hour
  'STAFF_CUSTODY', //  staff accepted custody via QR
  'WITHDRAWN', //      owner took it off the market
  'DISPUTED', //       a dispute is open; funds frozen
] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const CLAIM_STATUSES = ['PENDING_HANDOVER', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'REFUNDED'] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export const RENTAL_STATUSES = ['PENDING_PICKUP', 'ACTIVE', 'RETURNED', 'CANCELLED', 'CONVERTED', 'DISPUTED'] as const
export type RentalStatus = (typeof RENTAL_STATUSES)[number]

export const DISPUTE_STATUSES = ['OPEN', 'RESOLVED_REFUND', 'RESOLVED_RELEASE', 'RESOLVED_DAMAGE'] as const
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number]

export const STAFF_TRANSFER_STATUSES = ['PENDING', 'ACCEPTED'] as const
export type StaffTransferStatus = (typeof STAFF_TRANSFER_STATUSES)[number]

type Graph<S extends string> = Readonly<Record<S, readonly S[]>>

export const LISTING_TRANSITIONS: Graph<ListingStatus> = {
  ACTIVE: ['RESERVED', 'RENTED', 'WITHDRAWN', 'STAFF_PENDING'],
  RESERVED: ['ACTIVE', 'SOLD', 'DISPUTED'],
  RENTED: ['ACTIVE', 'SOLD', 'DISPUTED'],
  DISPUTED: ['ACTIVE', 'SOLD', 'RENTED', 'RESERVED'],
  WITHDRAWN: ['ACTIVE'],
  STAFF_PENDING: ['STAFF_CUSTODY'],
  SOLD: [],
  STAFF_CUSTODY: [],
}

export const CLAIM_TRANSITIONS: Graph<ClaimStatus> = {
  PENDING_HANDOVER: ['COMPLETED', 'CANCELLED', 'DISPUTED'],
  DISPUTED: ['COMPLETED', 'REFUNDED', 'PENDING_HANDOVER'],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
}

export const RENTAL_TRANSITIONS: Graph<RentalStatus> = {
  PENDING_PICKUP: ['ACTIVE', 'CANCELLED', 'DISPUTED'],
  ACTIVE: ['RETURNED', 'CONVERTED', 'DISPUTED'],
  DISPUTED: ['RETURNED', 'CANCELLED', 'ACTIVE', 'PENDING_PICKUP'],
  RETURNED: [],
  CANCELLED: [],
  CONVERTED: [],
}

export const DISPUTE_TRANSITIONS: Graph<DisputeStatus> = {
  OPEN: ['RESOLVED_REFUND', 'RESOLVED_RELEASE', 'RESOLVED_DAMAGE'],
  RESOLVED_REFUND: [],
  RESOLVED_RELEASE: [],
  RESOLVED_DAMAGE: [],
}

export const STAFF_TRANSFER_TRANSITIONS: Graph<StaffTransferStatus> = {
  PENDING: ['ACCEPTED'],
  ACCEPTED: [],
}

export function canTransition<S extends string>(graph: Graph<S>, from: S, to: S): boolean {
  return graph[from]?.includes(to) ?? false
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly entity: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(`Illegal ${entity} transition: ${from} → ${to}`)
    this.name = 'IllegalTransitionError'
  }
}

export function assertTransition<S extends string>(entity: string, graph: Graph<S>, from: S, to: S): void {
  if (!canTransition(graph, from, to)) throw new IllegalTransitionError(entity, from, to)
}

export function isTerminal<S extends string>(graph: Graph<S>, status: S): boolean {
  return graph[status].length === 0
}

/** Human labels used by status badges (always shown with text, never colour alone). */
export const STATUS_LABELS: Record<ListingStatus | ClaimStatus | RentalStatus | DisputeStatus | StaffTransferStatus, string> = {
  ACTIVE: 'Active',
  RESERVED: 'Reserved',
  RENTED: 'On rent',
  SOLD: 'Sold',
  STAFF_PENDING: 'Routed to staff',
  STAFF_CUSTODY: 'In staff custody',
  WITHDRAWN: 'Withdrawn',
  DISPUTED: 'Disputed',
  PENDING_HANDOVER: 'Awaiting handover',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PENDING_PICKUP: 'Awaiting pickup',
  RETURNED: 'Returned',
  CONVERTED: 'Bought (rent-to-own)',
  OPEN: 'Open',
  RESOLVED_REFUND: 'Resolved · refunded',
  RESOLVED_RELEASE: 'Resolved · released',
  RESOLVED_DAMAGE: 'Resolved · damage deducted',
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
}
