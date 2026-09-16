import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { toApiError } from '@/api/client'
import { Alert, Badge, Button, Field, Input, PageHeader, Spinner, StatusBadge } from '@/components/ui'
import { useToast } from '@/components/useToast'
import { authApi } from '@/features/auth/api'
import { CURRENT_USER_KEY, useCurrentUser } from '@/features/auth/useAuth'
import { currentPushSubscription, disableBrowserPush, enableBrowserPush, notificationKeys, notificationsApi, pushSupported } from '@/features/notifications/api'

/**
 * My profile: picture, details, password, sign-in security, browser
 * notifications. Only what is the user's own to change; roles, scope and
 * status are shown, not edited.
 */
export function ProfilePage() {
  const { data: user, isPending } = useCurrentUser()
  if (isPending || !user) {
    return (
      <div className="py-16 text-center">
        <Spinner label="Loading profile" />
      </div>
    )
  }
  return (
    <>
      <PageHeader title="My profile" eyebrow="Account" subtitle={user.email} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-6">
          <PictureCard avatar={user.avatar_data_url} name={user.display_name} />
          <AccessCard user={user} />
        </div>
        <div className="space-y-6">
          <DetailsCard key={`${user.display_name}|${user.phone_number}|${user.job_title}`} user={user} />
          <PasswordCard provider={user.auth_provider} />
          <NotificationsCard />
        </div>
      </div>
    </>
  )
}

function Section({ title, subtitle, children, id }: { title: string; subtitle?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} aria-label={title} className="rounded-card border border-ink-200/80 bg-white p-5 shadow-card">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function PictureCard({ avatar, name }: { avatar: string; name: string }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const upload = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: (next) => {
      queryClient.setQueryData(CURRENT_USER_KEY, next)
      toast.success('Profile picture updated')
    },
  })
  const remove = useMutation({
    mutationFn: authApi.removeAvatar,
    onSuccess: (next) => {
      queryClient.setQueryData(CURRENT_USER_KEY, next)
      toast.success('Profile picture removed')
    },
  })
  const failure = upload.error ? toApiError(upload.error) : null
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')

  return (
    <Section title="Profile picture" subtitle="Shown in the top bar and next to your name. Square crops best; up to 5 MB.">
      <div className="flex items-center gap-5">
        {avatar ? (
          <img src={avatar} alt="Your profile picture" className="h-24 w-24 rounded-full object-cover ring-4 ring-brand-50" />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-800 ring-4 ring-brand-50" aria-label="No profile picture">
            {initials || '?'}
          </span>
        )}
        <div className="space-y-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            aria-label="Choose a profile picture"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload.mutate(file)
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => input.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? 'Uploading' : avatar ? 'Change picture' : 'Upload picture'}
            </Button>
            {avatar && (
              <Button size="sm" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Remove
              </Button>
            )}
          </div>
          {failure && <p className="text-xs font-medium text-red-600">{failure.detail}</p>}
        </div>
      </div>
    </Section>
  )
}

function DetailsCard({ user }: { user: ReturnType<typeof useCurrentUser>['data'] & object }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ display_name: user.display_name, phone_number: user.phone_number, job_title: user.job_title })
  const save = useMutation({
    mutationFn: () => authApi.updateProfile(form),
    onSuccess: (next) => {
      queryClient.setQueryData(CURRENT_USER_KEY, next)
      toast.success('Profile saved')
    },
  })
  const failure = save.error ? toApiError(save.error) : null
  const dirty = form.display_name !== user.display_name || form.phone_number !== user.phone_number || form.job_title !== user.job_title

  return (
    <Section title="Details" subtitle="Your name as colleagues see it, and how to reach you.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        {failure && <Alert>{failure.detail}</Alert>}
        <Field label="Display name" error={failure?.field_errors.display_name?.[0]}>
          <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} required aria-label="Display name" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number" error={failure?.field_errors.phone_number?.[0]}>
            <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+91 …" aria-label="Phone number" />
          </Field>
          <Field label="Job title" error={failure?.field_errors.job_title?.[0]}>
            <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} aria-label="Job title" />
          </Field>
        </div>
        <Field label="Email" hint="Your sign-in identity. Ask an administrator to change it.">
          <Input value={user.email} disabled aria-label="Email" />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? 'Saving' : 'Save details'}
          </Button>
        </div>
      </form>
    </Section>
  )
}

function PasswordCard({ provider }: { provider: string }) {
  const toast = useToast()
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const change = useMutation({
    mutationFn: () => authApi.changePassword({ current_password: form.current_password, new_password: form.new_password }),
    onSuccess: () => {
      setForm({ current_password: '', new_password: '', confirm: '' })
      toast.success('Password changed')
    },
  })
  const failure = change.error ? toApiError(change.error) : null
  const mismatch = form.confirm.length > 0 && form.confirm !== form.new_password

  if (provider !== 'local') {
    return (
      <Section title="Password" subtitle={`You sign in with ${provider}; there is no BCM password to change.`}>
        <p className="text-sm text-ink-500">Manage your password with your {provider} account.</p>
      </Section>
    )
  }
  return (
    <Section title="Password">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!mismatch) change.mutate()
        }}
      >
        {failure && <Alert>{failure.detail}</Alert>}
        <Field label="Current password" error={failure?.field_errors.current_password?.[0]}>
          <Input type="password" autoComplete="current-password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} required aria-label="Current password" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" error={failure?.field_errors.new_password?.[0]}>
            <Input type="password" autoComplete="new-password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} required aria-label="New password" />
          </Field>
          <Field label="Confirm new password" error={mismatch ? 'Does not match.' : undefined}>
            <Input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required aria-label="Confirm new password" />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={change.isPending || mismatch}>
            {change.isPending ? 'Changing' : 'Change password'}
          </Button>
        </div>
      </form>
    </Section>
  )
}

function AccessCard({ user }: { user: ReturnType<typeof useCurrentUser>['data'] & object }) {
  return (
    <Section title="Access" subtitle="Set by your administrator.">
      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
        <dt className="text-ink-500">Status</dt>
        <dd>
          <StatusBadge status={user.user_status} />
        </dd>
        <dt className="text-ink-500">Sign-in</dt>
        <dd className="text-ink-900">{user.auth_provider === 'local' ? 'Email and password' : user.auth_provider === 'google' ? 'Google' : 'Microsoft'}</dd>
        <dt className="text-ink-500">Two-step code</dt>
        <dd>{user.mfa_enabled ? <Badge className="bg-emerald-50 text-emerald-800">On · emailed at sign-in</Badge> : <Badge>Off</Badge>}</dd>
        <dt className="text-ink-500">Roles</dt>
        <dd className="text-ink-900">{user.role_codes.map(pretty).join(', ') || <span className="text-amber-700">None yet</span>}</dd>
        <dt className="text-ink-500">Employee</dt>
        <dd className="text-ink-900">{user.employee ? `${user.employee.full_name} · ${user.employee.employee_number}` : <span className="text-ink-400">Not linked</span>}</dd>
      </dl>
    </Section>
  )
}

function NotificationsCard() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const key = useQuery({ queryKey: notificationKeys.pushKey, queryFn: notificationsApi.pushPublicKey })
  const [state, setState] = useState<'unknown' | 'on' | 'off' | 'unsupported' | 'denied'>(() =>
    !pushSupported() ? 'unsupported' : Notification.permission === 'denied' ? 'denied' : 'unknown',
  )
  useEffect(() => {
    if (state !== 'unknown') return
    let cancelled = false
    void currentPushSubscription().then((s) => {
      if (!cancelled) setState(s ? 'on' : 'off')
    })
    return () => {
      cancelled = true
    }
  }, [state])
  const unread = useQuery({ queryKey: notificationKeys.unread, queryFn: notificationsApi.unreadCount })
  const enable = useMutation({
    mutationFn: enableBrowserPush,
    onSuccess: (result) => {
      if (result === 'subscribed') {
        setState('on')
        toast.success('Browser notifications are on for this device')
      } else if (result === 'denied') {
        setState('denied')
        toast.error('The browser blocked notifications. Allow them in the site settings and try again.')
      } else if (result === 'not_configured') {
        toast.error('Browser push is not configured on this server.')
      }
    },
    onError: (error) => toast.error(toApiError(error).detail),
  })
  const disable = useMutation({
    mutationFn: disableBrowserPush,
    onSuccess: () => {
      setState('off')
      toast.info('Browser notifications are off for this device')
    },
  })
  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read')
    },
  })

  return (
    <Section id="notifications" title="Notifications" subtitle="Everything sent to you by email also appears under the bell. Browser notifications reach you when the tab is closed.">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-control border border-ink-200 px-3.5 py-3">
          <div>
            <div className="font-medium text-ink-900">Browser notifications on this device</div>
            <div className="text-xs text-ink-500">
              {state === 'unsupported' && 'This browser does not support push notifications.'}
              {state === 'denied' && 'Blocked in the browser. Allow notifications for this site to turn them on.'}
              {state === 'off' && (key.data?.configured ? 'Off. You will be asked for permission.' : 'Not available: the server has no push keys configured.')}
              {state === 'on' && 'On. Sent by the server through your browser’s push service.'}
              {state === 'unknown' && 'Checking…'}
            </div>
          </div>
          {state === 'on' ? (
            <Button size="sm" variant="secondary" onClick={() => disable.mutate()} disabled={disable.isPending}>
              Turn off
            </Button>
          ) : (
            <Button size="sm" onClick={() => enable.mutate()} disabled={state !== 'off' || !key.data?.configured || enable.isPending}>
              Turn on
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between rounded-control border border-ink-200 px-3.5 py-3">
          <div>
            <div className="font-medium text-ink-900">In-app notifications</div>
            <div className="text-xs text-ink-500">{unread.data ? `${unread.data} unread` : 'Nothing unread'}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => markAll.mutate()} disabled={!unread.data || markAll.isPending}>
            Mark all as read
          </Button>
        </div>
      </div>
    </Section>
  )
}

function pretty(code: string): string {
  return code.replace(/^BCM_/, '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^Bu /, 'BU ')
}
