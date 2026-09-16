import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { IconMore } from '@/components/icons'

import type { CostCode } from './types'

/**
 * The row action menu (journey step 4): edit, assign coordinator, open the
 * current plan, previous versions, history.
 *
 * Each entry is a real link to the cost code page with `?action=…`, not a
 * modal in the table. That keeps middle-click and "open in new tab" working,
 * and means the table never has to know how any of those actions work.
 */
export function RowActions({ costCode }: { costCode: CostCode }) {
  const [open, setOpen] = useState(false)
  // The table body scrolls inside an overflow container, which would clip an
  // absolutely-positioned menu on the last few rows. The menu is positioned
  // `fixed` from the button's rectangle instead, so it escapes the clip.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  const container = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocumentClick(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const base = `/cost-codes/${costCode.cost_code_id}`
  const hasPlan = costCode.current_plan_version_id !== null

  return (
    <div ref={container} className="relative flex justify-end">
      <button
        type="button"
        aria-label={`Actions for ${costCode.cost_code}`}
        aria-haspopup="menu"
        aria-expanded={open}
        ref={button}
        onClick={() => {
          const rect = button.current?.getBoundingClientRect()
          if (rect) setAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
          setOpen((v) => !v)
        }}
        className="rounded-control p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
      >
        <IconMore size={18} />
      </button>
      {open && anchor && (
        <div
          role="menu"
          style={{ position: 'fixed', top: anchor.top, right: anchor.right }}
          className="z-30 w-56 rounded-card border border-ink-200 bg-white p-1.5 text-sm shadow-raised animate-fade-up"
        >
          <MenuLink to={`${base}?action=edit`}>Edit cost code</MenuLink>
          <MenuLink to={`${base}?action=assign`} disabled={!hasPlan}>
            Assign coordinator
          </MenuLink>
          <MenuLink
            to={hasPlan ? `/plan-versions/${costCode.current_plan_version_id}` : base}
          >
            {hasPlan ? `BCP plan (v${costCode.current_version_number})` : 'Start BCP plan'}
          </MenuLink>
          <MenuLink to={base}>Previous versions</MenuLink>
          <MenuLink to={`${base}?action=history`} disabled={!hasPlan}>
            History
          </MenuLink>
        </div>
      )}
    </div>
  )
}

function MenuLink({
  to,
  disabled,
  children,
}: {
  to: string
  disabled?: boolean
  children: string
}) {
  if (disabled) {
    return (
      <span
        role="menuitem"
        aria-disabled="true"
        className="block cursor-not-allowed px-3 py-1.5 text-ink-400"
      >
        {children}
      </span>
    )
  }
  return (
    <Link role="menuitem" to={to} className="block rounded-control px-3 py-1.5 text-ink-700 hover:bg-brand-50 hover:text-brand-800">
      {children}
    </Link>
  )
}
