import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { hasAnyRole, postLoginPath, useCurrentUser } from './useAuth'
import type { RoleCode } from './types'

interface ProtectedRouteProps {
  children: ReactNode
  /** When given, the user must hold at least one of these roles. */
  roles?: readonly RoleCode[] | readonly string[]
  /** When given, users with any of these roles cannot access the page. */
  denyRoles?: readonly RoleCode[] | readonly string[]
}

export function ProtectedRoute({ children, roles, denyRoles }: ProtectedRouteProps) {
  const location = useLocation()
  const { data: user, isPending, isError } = useCurrentUser()

  if (isPending) {
    return <AppShellSkeleton />
  }

  if (isError || !user) {
    // No cookie, or one that does not resolve to a user — either way, not a
    // session. Remember where they were headed so sign-in can return them.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // A signed-in user with no linked employee record has nothing to show; send
  // them somewhere that explains why rather than to an empty screen.
  if (user.user_status === 'Pending' && location.pathname !== '/pending') {
    return <Navigate to="/pending" replace />
  }

  if ((roles && !hasAnyRole(user, roles)) || (denyRoles && hasAnyRole(user, denyRoles))) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-base font-semibold text-amber-900">
          You do not have access to this page
        </h2>
        <p className="mt-1 text-sm text-amber-800">
          Your role does not permit it. Contact a BCM administrator if you think
          that is wrong.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * The `/` index route: by the time this renders, `ProtectedRoute` has already
 * confirmed a signed-in, non-pending user, so this just picks their landing
 * screen (see `postLoginPath`).
 */
export function IndexRedirect() {
  const { data: user } = useCurrentUser()
  return <Navigate to={postLoginPath(user)} replace />
}

/**
 * Stands in for `AppLayout` while the current-user check is in flight, so the
 * first paint is shell-shaped instead of a spinner floating in an otherwise
 * blank viewport that then pops straight to the full chrome.
 */
function AppShellSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-ink-100" aria-hidden="true">
      <div className="hidden h-screen w-64 shrink-0 flex-col gap-2 bg-brand-950 p-4 lg:flex">
        <div className="h-8 w-28 animate-pulse rounded bg-white/10" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-white/8" />
          ))}
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center border-b border-ink-200/70 bg-white px-4 lg:px-8">
          <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
        </div>
        <div className="flex-1 px-4 py-8 lg:px-8">
          <div className="mx-auto w-full max-w-7xl space-y-3">
            <div className="h-6 w-56 animate-pulse rounded bg-ink-200/70" />
            <div className="h-40 animate-pulse rounded-card bg-white shadow-card" />
          </div>
        </div>
      </div>
    </div>
  )
}
