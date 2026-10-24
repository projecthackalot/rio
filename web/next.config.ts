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
    // Free-tier budget: every (image × width × format) is one billed transformation.
    // One format, a short width ladder and a 31-day cache keep the count low.
    formats: ['image/webp'],
    deviceSizes: [360, 640, 828, 1200],
    imageSizes: [96, 200, 320],
    minimumCacheTTL: 2678400,
  },
  experimental: {
    serverActions: {
      // One save carries at most 4 MB of photos (hosting request limit is ~4.5 MB).
      bodySizeLimit: '5mb',
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
