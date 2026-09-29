import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { toApiError } from '@/api/client'
import { Alert, AuthCard, Button, Field, Input } from '@/components/ui'

import { authApi } from './api'
import { OtpForm } from './OtpForm'
import { SsoButtons } from './SsoButtons'
import { postLoginPath, useAuth } from './useAuth'

const schema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { completeSignIn } = useAuth()
  const [otpEmail, setOtpEmail] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: providers } = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: authApi.ssoProviders,
    staleTime: Infinity,
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const explicitFrom = (location.state as { from?: string } | null)?.from

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: FormValues) => authApi.login(email, password),
    onSuccess: async (result) => {
      setFormError(null)
      if (result.otp_required) {
        // Tokens are deliberately withheld until the second factor is verified.
        setOtpEmail(result.email)
        return
      }
      const user = await completeSignIn()
      navigate(postLoginPath(user, explicitFrom), { replace: true })
    },
    onError: (error) => setFormError(toApiError(error).detail),
  })

  if (otpEmail) {
    return (
      <OtpForm
        email={otpEmail}
        onVerified={async () => {
          const user = await completeSignIn()
          navigate(postLoginPath(user, explicitFrom), { replace: true })
        }}
        onCancel={() => setOtpEmail(null)}
      />
    )
  }

  return (
    <AuthCard title="Sign in" subtitle="Business Continuity Management">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => loginMutation.mutate(values))}
        noValidate
      >
        {formError && <Alert>{formError}</Alert>}

        <Field label="Email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="username"
            autoFocus
            {...register('email')}
          />
        </Field>

        <Field label="Password" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
        </Field>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || loginMutation.isPending}
        >
          {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="text-sm text-brand-600 hover:underline"
          >
            Forgot your password?
          </button>
        </div>
      </form>

      <SsoButtons providers={providers ?? []} />
    </AuthCard>
  )
}
