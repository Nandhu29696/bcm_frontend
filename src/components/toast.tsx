import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { IconCheck, IconClose } from '@/components/icons'

/**
 * Toasts: short confirmations that do not need a dialog. Bottom-right, stack,
 * dismiss themselves. `useToast().success('Saved')` from any component.
 */

import { ToastContext, type Tone } from './toastContext'

interface Toast {
  id: number
  tone: Tone
  message: string
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), [])
  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = ++counter.current
      setToasts((current) => [...current.slice(-3), { id, tone, message }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )
  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-card border px-4 py-3 text-sm shadow-raised animate-fade-up ${TONES[toast.tone]}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${DOTS[toast.tone]}`}>
                {toast.tone === 'error' ? '!' : <IconCheck size={14} />}
              </span>
              <span className="flex-1">{toast.message}</span>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss" className="rounded-full p-1 opacity-60 hover:opacity-100">
                <IconClose size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

const TONES: Record<Tone, string> = {
  success: 'border-emerald-200 bg-white text-ink-900',
  error: 'border-red-200 bg-white text-ink-900',
  info: 'border-brand-200 bg-white text-ink-900',
}
const DOTS: Record<Tone, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-brand-100 text-brand-700',
}
