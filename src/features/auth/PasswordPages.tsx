import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { toApiError } from '@/api/client'
import { Alert, AuthCard, Button, Field, Input } from '@/components/ui'

import { authApi } from './api'

const requestSchema = z.object({ email: z.email('Enter a valid email address.') })

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof requestSchema>>({ resolver: zodResolver(requestSchema) })

  const mutation = useMutation({
    mutationFn: ({ email }: { email: string }) => authApi.requestPasswordReset(email),
    onSuccess: () => setSent(true),
    onError: (err) => setError(toApiError(err).detail),
  })

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <div className="space-y-4">
          {/* Deliberately does not confirm whether an account exists. */}
          <Alert tone="info">
            If that account exists, a reset link is on its way. The link expires
            shortly, so use it soon.
          </Alert>
          <Button className="w-full" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link.">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="username" autoFocus {...register('email')} />
        </Field>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm text-ink-600 hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </form>
    </AuthCard>
  )
}

const confirmSchema = z
  .object({
    new_password: z.string().min(8, 'Use at least 8 characters.'),
    confirm: z.string(),
  })
  .refine((values) => values.new_password === values.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  })

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const uid = searchParams.get('uid') ?? ''
  const token = searchParams.get('token') ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof confirmSchema>>({ resolver: zodResolver(confirmSchema) })

  const mutation = useMutation({
    mutationFn: (values: { new_password: string }) =>
      authApi.confirmPasswordReset({ uid, token, new_password: values.new_password }),
    onSuccess: () => setDone(true),
    onError: (err) => {
      const apiError = toApiError(err)
      setError(
        apiError.field_errors?.new_password?.join(' ') ?? apiError.detail,
      )
    },
  })

  if (!uid || !token) {
    return (
      <AuthCard title="Invalid link">
        <div className="space-y-4">
          <Alert>That reset link is incomplete. Request a new one.</Alert>
          <Button className="w-full" onClick={() => navigate('/forgot-password')}>
            Request a new link
          </Button>
        </div>
      </AuthCard>
    )
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <div className="space-y-4">
          <Alert tone="success">You can now sign in with your new password.</Alert>
          <Button className="w-full" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Choose a new password">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) =>
          mutation.mutate({ new_password: values.new_password }),
        )}
        noValidate
      >
        {error && <Alert>{error}</Alert>}
        <Field label="New password" error={errors.new_password?.message}>
          <Input type="password" autoComplete="new-password" autoFocus {...register('new_password')} />
        </Field>
        <Field label="Confirm password" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirm')} />
        </Field>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthCard>
  )
}
