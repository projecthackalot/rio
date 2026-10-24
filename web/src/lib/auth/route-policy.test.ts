import { describe, expect, it } from 'vitest'
import { PUBLIC_PAGES, accessFor, isProtectedPath } from './route-policy'

describe('route policy', () => {
  it.each([
    ...PUBLIC_PAGES,
    '/marketplace?q=cooler',
    '/items/3f0c1c2e-0000-4000-8000-000000000000',
    '/auth/login',
    '/auth/callback',
    '/sitemap.xml',
    '/no-such-page',
  ])('anonymous visitors can open %s', (path) => {
    expect(isProtectedPath(path.split('?')[0])).toBe(false)
  })

  it.each([
    ['/dashboard', 'signed-in'],
    ['/sell/new', 'signed-in'],
    ['/saved', 'signed-in'],
    ['/activity', 'signed-in'],
    ['/rentals/abc', 'signed-in'],
    ['/handover', 'signed-in'],
    ['/disputes/new', 'signed-in'],
    ['/settings', 'signed-in'],
    ['/items/abc/edit', 'signed-in'],
    ['/warden', 'warden'],
    ['/staff', 'staff'],
    ['/admin/roles', 'admin'],
  ] as const)('%s requires %s', (path, access) => {
    expect(accessFor(path)).toBe(access)
    expect(isProtectedPath(path)).toBe(true)
  })

  it('does not treat look-alike paths as protected or public by prefix accident', () => {
    expect(isProtectedPath('/dashboards')).toBe(false) // different route, not /dashboard/*
    expect(isProtectedPath('/sell')).toBe(true)
    expect(isProtectedPath('/items/abc/edit/')).toBe(true)
    expect(isProtectedPath('/items/abc/editor')).toBe(false)
  })
})
