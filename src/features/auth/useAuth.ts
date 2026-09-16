import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { tokenStore } from '@/api/client'

import { authApi } from './api'
import type { CurrentUser, RoleCode } from './types'

export const CURRENT_USER_KEY = ['auth', 'me'] as const

/**
 * The current user, fetched once and cached.
 *
 * Note there is no Zustand store for the user: TanStack Query owns server state,
 * and the user IS server state. Tokens live in `tokenStore` (localStorage)
 * because the axios interceptor needs them synchronously, outside React.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: authApi.me,
    enabled: Boolean(tokenStore.access),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useAuth() {
  const queryClient = useQueryClient()
  const { data: user, isPending, isError } = useCurrentUser()

  const isAuthenticated = Boolean(tokenStore.access) && Boolean(user)

  const signOut = useCallback(async () => {
    const refresh = tokenStore.refresh
    if (refresh) {
      // A failed logout must not trap the user in a signed-in state, so the
      // local session is cleared regardless of what the server says.
      try {
        await authApi.logout(refresh)
      } catch {
        /* already expired or revoked */
      }
    }
    tokenStore.clear()
    queryClient.clear()
  }, [queryClient])

  const completeSignIn = useCallback(
    async (access: string, refresh: string) => {
      tokenStore.set(access, refresh)
      await queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY })
    },
    [queryClient],
  )

  return {
    user: user ?? null,
    isAuthenticated,
    isLoading: isPending && Boolean(tokenStore.access),
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
