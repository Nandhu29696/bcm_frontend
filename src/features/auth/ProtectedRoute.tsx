import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { tokenStore } from '@/api/client'

import { hasAnyRole, useCurrentUser } from './useAuth'
import type { RoleCode } from './types'

interface ProtectedRouteProps {
  children: ReactNode
  /** When given, the user must hold at least one of these roles. */
  roles?: readonly RoleCode[] | readonly string[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const location = useLocation()
  const hasToken = Boolean(tokenStore.access)
  const { data: user, isPending, isError } = useCurrentUser()

  if (!hasToken) {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (isPending) {
    return (
      <div className="flex min-h-full items-center justify-center py-24">
        <span className="size-6 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
      </div>
    )
  }

  if (isError || !user) {
    // A token that will not resolve to a user is not a session.
    tokenStore.clear()
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // A signed-in user with no linked employee record has nothing to show; send
  // them somewhere that explains why rather than to an empty screen.
  if (user.user_status === 'Pending' && location.pathname !== '/pending') {
    return <Navigate to="/pending" replace />
  }

  if (roles && !hasAnyRole(user, roles)) {
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
