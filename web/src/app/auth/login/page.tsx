import { login, signup } from '../actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 shadow-xl rounded-2xl border border-zinc-100">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Welcome to RIO
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Sign in to access the circular marketplace
          </p>
        </div>
        
        {searchParams?.error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium text-center border border-red-200">
            {searchParams.error}
          </div>
        )}

        <form className="mt-8 space-y-6">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium leading-6 text-zinc-900">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-2 block w-full rounded-lg border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-orange-500 sm:text-sm sm:leading-6 transition-shadow"
                placeholder="you@student.sharda.ac.in"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-zinc-900">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-2 block w-full rounded-lg border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-orange-500 sm:text-sm sm:leading-6 transition-shadow"
                placeholder="••••••••"
              />
            </div>
            <div>
               <label htmlFor="fullName" className="block text-sm font-medium leading-6 text-zinc-900">
                Full Name <span className="text-zinc-500 font-normal">(for sign up only)</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className="mt-2 block w-full rounded-lg border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-orange-500 sm:text-sm sm:leading-6 transition-shadow"
                placeholder="Aarav Sharma"
              />
            </div>
             <div>
               <label htmlFor="role" className="block text-sm font-medium leading-6 text-zinc-900">
                Role <span className="text-zinc-500 font-normal">(for sign up only)</span>
              </label>
              <select
                id="role"
                name="role"
                className="mt-2 block w-full rounded-lg border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-orange-500 sm:text-sm sm:leading-6 bg-white"
              >
                <option value="student">Student</option>
                <option value="warden">Warden</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-8">
            <button
              formAction={login}
              className="group relative flex w-full justify-center rounded-lg bg-orange-600 px-3 py-3 text-sm font-semibold text-white hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 transition-colors shadow-sm"
            >
              Sign in
            </button>
            <button
              formAction={signup}
              className="group relative flex w-full justify-center rounded-lg bg-white px-3 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 transition-colors shadow-sm"
            >
              Sign up as new user
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
