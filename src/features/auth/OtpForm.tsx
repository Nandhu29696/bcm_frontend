import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { toApiError } from '@/api/client'
import { Alert, AuthCard, Button, Field, Input } from '@/components/ui'

import { authApi } from './api'
import type { TokenPair } from './types'

interface OtpFormProps {
  email: string
  onVerified: (tokens: TokenPair) => void | Promise<void>
  onCancel: () => void
}

export function OtpForm({ email, onVerified, onCancel }: OtpFormProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const verify = useMutation({
    mutationFn: () => authApi.verifyOtp(email, code),
    onSuccess: (tokens) => {
      setError(null)
      void onVerified(tokens)
    },
    onError: (err) => setError(toApiError(err).detail),
  })

  const resend = useMutation({
    mutationFn: () => authApi.resendOtp(email),
    onSuccess: (data) => {
      setError(null)
      setNotice(data.detail)
    },
    onError: (err) => setError(toApiError(err).detail),
  })

  return (
    <AuthCard title="Check your email" subtitle={`We sent a code to ${email}`}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          verify.mutate()
        }}
      >
        {error && <Alert>{error}</Alert>}
        {notice && !error && <Alert tone="info">{notice}</Alert>}

        <Field label="Verification code">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            autoFocus
            className="text-center text-lg tracking-[0.4em]"
          />
        </Field>

        <Button type="submit" className="w-full" disabled={verify.isPending || !code}>
          {verify.isPending ? 'Verifying…' : 'Verify'}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={onCancel}
            className="text-ink-600 hover:underline"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="text-brand-600 hover:underline disabled:opacity-60"
          >
            {resend.isPending ? 'Sending…' : 'Resend code'}
          </button>
        </div>
      </form>
    </AuthCard>
  )
}
