import { useNavigate } from 'react-router-dom'

import { Alert, AuthCard, Button } from '@/components/ui'

import { useAuth } from './useAuth'

/**
 * Where an SSO user with no linked employee record lands.
 *
 * They authenticated successfully and hold a valid token — they simply resolve
 * to an empty scope. Saying so plainly is the whole point: refusing the sign-in
 * would have presented a provisioning gap as a credentials failure.
 */
export function PendingPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <AuthCard title="Account awaiting activation">
      <div className="space-y-4">
        <Alert tone="info">
          You are signed in as <strong>{user?.email}</strong>, but your account is
          not linked to an employee record yet, so there is no data to show.
        </Alert>
        <p className="text-sm text-ink-600">
          A BCM administrator needs to link your account and assign your role.
          They have been notified.
        </p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => {
            await signOut()
            navigate('/login', { replace: true })
          }}
        >
          Sign out
        </Button>
      </div>
    </AuthCard>
  )
}
