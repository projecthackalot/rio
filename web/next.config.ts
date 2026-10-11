import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Camera is needed only by the QR scanner on our own origin.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    // Listing photos are served from the public `listing-media` Supabase Storage bucket only.
    remotePatterns: supabaseUrl ? [new URL(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/listing-media/**`)] : [],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: {
      // Listing photos (≤ 5 MB each, enforced again by the storage bucket).
      bodySizeLimit: '6mb',
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default nextConfig
