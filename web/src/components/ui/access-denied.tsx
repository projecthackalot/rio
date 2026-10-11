import { ShieldX } from 'lucide-react'
import { ButtonLink } from './button'
import { EmptyState } from './feedback'

export function AccessDenied({ need }: { need: string }) {
  return (
    <EmptyState
      icon={<ShieldX aria-hidden="true" className="size-6" />}
      title="You don’t have access to this page"
      action={
        <ButtonLink href="/dashboard" variant="secondary">
          Go to your home page
        </ButtonLink>
      }
    >
      This area is for {need}. Roles are assigned by a campus administrator.
    </EmptyState>
  )
}
