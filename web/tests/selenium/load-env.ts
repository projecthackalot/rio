import { loadLocalEnv } from '../../scripts/lib/env'

// Test workers need NEXT_PUBLIC_* and RIO_DEMO_PASSWORD from .env.local too.
loadLocalEnv()
