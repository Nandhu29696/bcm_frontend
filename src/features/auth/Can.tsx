import type { ReactNode } from 'react'

import { useCurrentUser } from './useAuth'
import { hasAnyRole } from './useAuth'
import type { RoleCode } from './types'

interface CanProps {
  /** Any one of these roles grants access. */
  roles: readonly RoleCode[] | readonly string[]
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Hides UI the user's role does not permit.
 *
 * This is a convenience, NOT a security boundary. Every one of these decisions
 * is enforced again server-side by a permission class and by queryset scoping —
 * hiding a button only stops an honest user reaching a dead end.
 */
export function Can({ roles, children, fallback = null }: CanProps) {
  const { data: user } = useCurrentUser()
  return <>{hasAnyRole(user, roles) ? children : fallback}</>
}
