import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { authApi } from './api'
import { ROLE } from './types'
import type { CurrentUser, RoleCode } from './types'

export const CURRENT_USER_KEY = ['auth', 'me'] as const

/**
 * The current user, fetched once and cached.
 *
 * Note there is no Zustand store for the user: TanStack Query owns server
 * state, and the user IS server state. Tokens live in HttpOnly cookies
 * (BUG-21), invisible to JS, so there is no client-side flag to gate this
 * query on — the only way to know whether a session exists is to ask.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: authApi.me,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useAuth() {
  const queryClient = useQueryClient()
  const { data: user, isPending, isError } = useCurrentUser()

  const isAuthenticated = Boolean(user) && !isError

  const signOut = useCallback(async () => {
    // A failed logout must not trap the user in a signed-in state, so the
    // local session is cleared regardless of what the server says.
    try {
      await authApi.logout()
    } catch {
      /* already expired or revoked */
    }
    queryClient.clear()
  }, [queryClient])

  const completeSignIn = useCallback(async () => {
    // The auth cookies are already set by the response that got us here.
    // Fetch (not just invalidate) so the caller has the user in hand
    // immediately, to decide where to land them (see postLoginPath).
    await queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY })
    return queryClient.fetchQuery({ queryKey: CURRENT_USER_KEY, queryFn: authApi.me })
  }, [queryClient])

  return {
    user: user ?? null,
    isAuthenticated,
    isLoading: isPending,
    isError,
    signOut,
    completeSignIn,
  }
}

/** Does this user hold any of these roles? */
export function hasAnyRole(
  user: CurrentUser | null | undefined,
  roles: readonly RoleCode[] | readonly string[],
): boolean {
  if (!user) return false
  if (roles.length === 0) return true
  return roles.some((role) => user.role_codes.includes(role))
}

export function useHasRole(roles: readonly RoleCode[] | readonly string[]): boolean {
  const { data: user } = useCurrentUser()
  return hasAnyRole(user, roles)
}

/**
 * Where a user lands right after signing in. An explicit `from` (the route
 * they were bounced out of before login) always wins — otherwise a Super
 * Admin's landing screen is the Dashboard, and everyone else's is Estates.
 */
export function postLoginPath(user: CurrentUser | null | undefined, from?: string): string {
  if (from) return from
  if (hasAnyRole(user, [ROLE.ADMIN])) return '/dashboard'
  if (hasAnyRole(user, [ROLE.BU_LEAD, ROLE.COORDINATOR])) return '/my-plans'
  return '/estates'
}
