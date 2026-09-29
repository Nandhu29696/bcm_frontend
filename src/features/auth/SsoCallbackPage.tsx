import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { Alert, AuthCard, Button } from '@/components/ui'

import { authApi } from './api'
import { postLoginPath, useAuth } from './useAuth'

/**
 * Where the identity provider sends the browser back to.
 *
 * The authorization code is single-use, so the exchange must fire exactly once —
 * hence the ref guard, which matters because React StrictMode double-invokes
 * effects in development and the second call would fail with `invalid_grant`.
 *
 * Parameter problems are derived during render rather than set from the effect:
 * they are knowable immediately, and only the network exchange is genuinely
 * asynchronous.
 */
export function SsoCallbackPage() {
  const { provider = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { completeSignIn } = useAuth()

  const [exchangeError, setExchangeError] = useState<string | null>(null)
  const exchanged = useRef(false)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const providerError = searchParams.get('error')

  const paramError = providerError
    ? (searchParams.get('error_description') ??
      'Your identity provider refused the sign-in.')
    : !code || !state
      ? 'That sign-in link is incomplete. Please try again.'
      : null

  useEffect(() => {
    if (paramError || exchanged.current || !code || !state) return
    exchanged.current = true

    authApi
      .ssoCallback(provider, code, state)
      .then(async (result) => {
        const user = await completeSignIn()
        navigate(result.user_status === 'Pending' ? '/pending' : postLoginPath(user), {
          replace: true,
        })
      })
      .catch((err) => setExchangeError(toApiError(err).detail))
  }, [code, state, provider, paramError, completeSignIn, navigate])

  const error = paramError ?? exchangeError

  if (error) {
    return (
      <AuthCard title="Sign-in failed">
        <div className="space-y-4">
          <Alert>{error}</Alert>
          <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Signing you in…" subtitle="This should only take a moment.">
      <div className="flex justify-center py-4">
        <span className="size-6 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
      </div>
    </AuthCard>
  )
}
