'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Recycle, Leaf, ShieldCheck } from 'lucide-react'

export function Hero() {
  return (
    <div className="relative isolate pt-14">
      {/* Background decoration */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div
          className="from-rio-emerald relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr to-[#90e0ef] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
        />
      </div>

      <div className="py-24 sm:py-32 lg:pb-40">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8 flex justify-center">
              <span className="text-rio-emerald ring-rio-emerald/20 bg-rio-emerald/5 relative flex items-center gap-2 rounded-full px-3 py-1 text-sm leading-6 ring-1">
                <Leaf className="h-4 w-4" />
                The sustainable circular economy platform
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-rio-ink font-display text-5xl font-bold tracking-tight sm:text-7xl"
            >
              Nothing moves. <br className="hidden sm:block" />
              <span className="text-rio-emerald">Nothing gets dumped.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 font-sans text-lg leading-8 text-zinc-600"
            >
              Leave your stuff exactly where it is. Sell, rent, or transfer items effortlessly to the next incoming batch before you leave campus.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 flex items-center justify-center gap-x-6"
            >
              <Link
                href="/auth/login"
                className="group bg-rio-emerald hover:bg-rio-emerald-hover focus-visible:outline-rio-emerald relative flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Explore Marketplace
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none"
          >
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="bg-rio-sand/50 ring-rio-ink/5 mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
                  <ShieldCheck className="text-rio-ink h-6 w-6" aria-hidden="true" />
                </div>
                <dt className="text-rio-ink font-display text-xl leading-7 font-semibold">Secure & Campus-only</dt>
                <dd className="mt-2 text-base leading-7 text-zinc-600">
                  Exclusive to verified students. Safe QR-based handovers without exposing room details prematurely.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="bg-rio-sand/50 ring-rio-ink/5 mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
                  <Recycle className="text-rio-clay h-6 w-6" aria-hidden="true" />
                </div>
                <dt className="text-rio-ink font-display text-xl leading-7 font-semibold">Dynamic Pricing</dt>
                <dd className="mt-2 text-base leading-7 text-zinc-600">
                  Prices decay closer to your departure. Smart Dutch auctions ensure everything finds a home.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="bg-rio-sand/50 ring-rio-ink/5 mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
                  <Leaf className="text-rio-emerald h-6 w-6" aria-hidden="true" />
                </div>
                <dt className="text-rio-ink font-display text-xl leading-7 font-semibold">Measurable Impact</dt>
                <dd className="mt-2 text-base leading-7 text-zinc-600">
                  Track your carbon avoidance and waste diversion when you participate in the circular loop.
                </dd>
              </div>
            </dl>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
