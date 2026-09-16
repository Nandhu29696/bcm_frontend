import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'

import { BrandMark, IconClose, IconInbox } from './icons'

/*
 * The component vocabulary. Every screen is built from these, so the look of
 * the application is decided here once. Accessible roles and names are part of
 * the contract — the end-to-end suites address the UI by them.
 */

// --------------------------------------------------------------------------- //
// Buttons
// --------------------------------------------------------------------------- //

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[inset_0_1px_0_0_oklch(1_0_0/0.18),0_1px_2px_oklch(0.2_0.05_270/0.25)] hover:from-brand-600 hover:to-brand-700 active:from-brand-700 active:to-brand-800',
  secondary:
    'border border-ink-200 bg-white text-ink-800 shadow-card hover:border-ink-300 hover:bg-ink-50 active:bg-ink-100',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50 active:bg-red-100',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9.5 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    />
  )
}

// --------------------------------------------------------------------------- //
// Form controls
// --------------------------------------------------------------------------- //

const CONTROL =
  'w-full rounded-control border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 shadow-[inset_0_1px_2px_oklch(0.2_0.02_260/0.04)] transition-colors focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none disabled:bg-ink-50 disabled:text-ink-500'

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1.5 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} h-9.5 ${className}`} {...props} />
}

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${CONTROL} h-9.5 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b6f80' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>")] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROL} py-2 leading-relaxed ${className}`} {...props} />
}

// --------------------------------------------------------------------------- //
// Feedback
// --------------------------------------------------------------------------- //

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'info' | 'success' | 'warning'
  children: ReactNode
}) {
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-brand-200 bg-brand-50 text-brand-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }
  return (
    <div role="alert" className={`rounded-control border px-3.5 py-2.5 text-sm ${tones[tone]}`}>
      {children}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm text-ink-500">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600"
      />
      {label}
    </span>
  )
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-card border border-dashed border-ink-300 bg-white/60 px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 ring-4 ring-brand-50/60">
        <IconInbox size={20} />
      </div>
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{description}</p>}
      {children && <div className="mt-5 flex justify-center">{children}</div>}
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Surfaces
// --------------------------------------------------------------------------- //

export function Card({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`rounded-card border border-ink-200/80 bg-white shadow-card ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: string
  subtitle?: ReactNode
  eyebrow?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div className="min-w-0 border-l-[3px] border-brand-500 pl-4">
        {eyebrow && <div className="mb-1 text-xs font-medium text-ink-500">{eyebrow}</div>}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-ink-950">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-ink-600">{subtitle}</div>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/**
 * The sign-in surfaces: a split screen with the brand on the left and the
 * form on the right. Collapses to the form alone on narrow screens.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.56_0.18_270/0.55),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.68_0.14_175/0.35),transparent_50%)]"
        />
        <div className="relative flex items-center gap-3">
          <BrandMark size={36} />
          <span className="text-lg font-semibold tracking-tight">BCM</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Plan for disruption. Prove you can recover.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Business continuity plans for every cost code, reviewed by business unit leads,
            with risks, recovery targets and call trees in one place.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {[
              'Estate and cost code coverage at a glance',
              'Questionnaire-driven plans with review workflow',
              'Risk register with catalogue-driven scoring',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-400" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">Business Continuity Management</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size={32} />
            <span className="text-lg font-semibold tracking-tight text-ink-950">BCM</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-950">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-600">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Badges
// --------------------------------------------------------------------------- //

/**
 * BCP status pill. A coloured dot plus the label: colour is never the only
 * signal, so it stays readable without colour vision.
 */
const STATUS_TONES: Record<string, { pill: string; dot: string }> = {
  'Not Started': { pill: 'bg-ink-100 text-ink-700', dot: 'bg-status-notstarted' },
  'Work in Progress': { pill: 'bg-blue-50 text-blue-800', dot: 'bg-status-review' },
  'Pending BU Lead Review': { pill: 'bg-amber-50 text-amber-900', dot: 'bg-status-progress' },
  Approved: { pill: 'bg-emerald-50 text-emerald-800', dot: 'bg-status-approved' },
  Rework: { pill: 'bg-red-50 text-red-800', dot: 'bg-status-rework' },
  Exempted: { pill: 'bg-violet-50 text-violet-800', dot: 'bg-status-exempted' },
  // Phase 8: tests, crisis events and call tree runs.
  Scheduled: { pill: 'bg-blue-50 text-blue-800', dot: 'bg-status-review' },
  Planned: { pill: 'bg-blue-50 text-blue-800', dot: 'bg-status-review' },
  Initiated: { pill: 'bg-amber-50 text-amber-900', dot: 'bg-status-progress' },
  'In Progress': { pill: 'bg-amber-50 text-amber-900', dot: 'bg-status-progress' },
  RUNNING: { pill: 'bg-amber-50 text-amber-900', dot: 'bg-status-progress' },
  PENDING: { pill: 'bg-ink-100 text-ink-700', dot: 'bg-status-notstarted' },
  Completed: { pill: 'bg-emerald-50 text-emerald-800', dot: 'bg-status-approved' },
  COMPLETED: { pill: 'bg-emerald-50 text-emerald-800', dot: 'bg-status-approved' },
  Closed: { pill: 'bg-emerald-50 text-emerald-800', dot: 'bg-status-approved' },
  Passed: { pill: 'bg-emerald-50 text-emerald-800', dot: 'bg-status-approved' },
  Partial: { pill: 'bg-amber-50 text-amber-900', dot: 'bg-status-progress' },
  Failed: { pill: 'bg-red-50 text-red-800', dot: 'bg-status-rework' },
  FAILED: { pill: 'bg-red-50 text-red-800', dot: 'bg-status-rework' },
  Cancelled: { pill: 'bg-ink-100 text-ink-500', dot: 'bg-status-notstarted' },
  // Accounts
  Active: { pill: 'bg-emerald-50 text-emerald-800', dot: 'bg-status-approved' },
  Suspended: { pill: 'bg-amber-50 text-amber-900', dot: 'bg-status-progress' },
  Disabled: { pill: 'bg-red-50 text-red-800', dot: 'bg-status-rework' },
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES['Not Started']
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pl-2 pr-2.5 text-xs font-medium ${tone.pill}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {status}
    </span>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700 ${className}`}
    >
      {children}
    </span>
  )
}

// --------------------------------------------------------------------------- //
// Modal
// --------------------------------------------------------------------------- //

/**
 * A modal dialog. Closes on Escape and on backdrop click. `<dialog>` is not
 * used because its `showModal()` cannot be driven declaratively from React
 * state without an effect, and its top layer fights the sticky table header.
 *
 * Rendered through a portal to `document.body`. A modal placed in the tree
 * where it is opened sits inside whatever card opened it, and any ancestor
 * with a transform (the entrance animation leaves one) becomes the containing
 * block for `position: fixed` - the dialog is then clipped to that card.
 */
export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-lg',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: string
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink-950/45 px-4 py-12 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`w-full ${width} rounded-card bg-white shadow-overlay animate-fade-up`}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-ink-950">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
          >
            <IconClose size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
