import Link from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'clay'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 select-none'

const variants: Record<Variant, string> = {
  primary: 'bg-forest text-chalk hover:bg-forest-strong',
  secondary: 'border border-line-strong bg-chalk text-ink hover:bg-stone',
  ghost: 'text-forest hover:bg-forest-tint',
  danger: 'border border-danger bg-chalk text-danger hover:bg-danger-tint',
  clay: 'bg-clay text-chalk hover:bg-[#843d24]',
}

// Every size keeps a ≥ 44px touch target except `sm` (≥ 36px, used inline only).
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-[0.95rem]',
  lg: 'min-h-12 px-6 text-base',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}
