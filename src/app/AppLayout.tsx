import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import {
  BrandMark,
  IconActivity,
  IconAlert,
  IconBell,
  IconBuildings,
  IconChart,
  IconChevronDown,
  IconClipboard,
  IconFile,
  IconHelp,
  IconInbox,
  IconLogout,
  IconUser,
  IconUsers,
} from '@/components/icons'
import { Can } from '@/features/auth/Can'
import { ROLE } from '@/features/auth/types'
import { useAuth } from '@/features/auth/useAuth'
import { NotificationBell } from '@/features/notifications/NotificationBell'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: IconChart },
  { to: '/estates', label: 'Estates', icon: IconBuildings },
  { to: '/reviews', label: 'Reviews', icon: IconInbox },
  { to: '/tests', label: 'Tests', icon: IconClipboard },
  { to: '/crisis', label: 'Crisis Management', icon: IconAlert },
  { to: '/reports', label: 'Reports', icon: IconFile },
  { to: '/help', label: 'Help', icon: IconHelp },
]

const TITLES: [string, string][] = [
  ['/dashboard', 'Dashboard'],
  ['/estates', 'Estates'],
  ['/cost-codes', 'Cost code'],
  ['/plan-versions', 'Plan'],
  ['/reviews', 'Reviews'],
  ['/tests', 'Tests'],
  ['/crisis', 'Crisis Management'],
  ['/reports', 'Reports'],
  ['/help', 'Help'],
  ['/admin', 'Administration'],
  ['/profile', 'My profile'],
  ['/system', 'System'],
]

/**
 * The application shell: a dark sidebar for navigation and identity, a light
 * canvas for the work, a top bar with the bell and the account menu. The
 * sidebar collapses to a drawer on small screens.
 */
export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const roleLabel = user?.role_codes.length ? user.role_codes.map(prettyRole).join(', ') : 'No role assigned'
  const section = TITLES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ?? 'Page not found'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-100">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex h-screen w-64 shrink-0 flex-col overflow-y-auto bg-brand-950 text-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundImage: 'radial-gradient(120% 60% at 0% 0%, oklch(0.32 0.12 270 / 0.6), transparent 60%)' }}
        aria-label="Primary"
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <BrandMark size={34} />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">BCM</div>
            <div className="text-[11px] text-white/50">Business Continuity</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 pt-2" aria-label="Main">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Workspace</p>
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} onNavigate={() => setOpen(false)} />
          ))}
          {/* Mirrors the server-side role check. Hiding the link is a
              convenience; the API enforces it regardless. */}
          <Can roles={[ROLE.ADMIN]}>
            <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Administration</p>
            <NavItem to="/admin/users" label="Users" icon={IconUsers} onNavigate={() => setOpen(false)} />
            <NavItem to="/admin/notifications" label="Notification delivery" icon={IconBell} onNavigate={() => setOpen(false)} />
            <NavItem to="/system/health" label="System health" icon={IconActivity} onNavigate={() => setOpen(false)} />
          </Can>
        </nav>

        <div className="flex items-center gap-1 border-t border-white/10 p-3">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-white/8"
            aria-label="My profile"
          >
            <Avatar name={user?.display_name ?? '?'} src={user?.avatar_data_url} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{user?.display_name}</div>
              <div className="truncate text-[11px] text-white/50">{roleLabel}</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="rounded-control p-2 text-white/50 transition-colors hover:bg-white/8 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <IconLogout size={16} />
          </button>
        </div>
      </aside>

      {open && <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-ink-950/40 lg:hidden" />}

      {/* Canvas */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-ink-200/70 bg-white/85 px-4 backdrop-blur lg:px-8">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" className="rounded-control p-2 text-ink-600 hover:bg-ink-100 lg:hidden">
            <span className="block h-0.5 w-5 bg-current" />
            <span className="mt-1 block h-0.5 w-5 bg-current" />
            <span className="mt-1 block h-0.5 w-5 bg-current" />
          </button>
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden text-ink-400 sm:inline">Business Continuity Management</span>
            <span className="hidden text-ink-300 sm:inline">/</span>
            <span className="truncate font-medium text-ink-800">{section}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell />
            <AccountMenu name={user?.display_name ?? '?'} email={user?.email ?? ''} src={user?.avatar_data_url} onSignOut={handleSignOut} />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
          <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function AccountMenu({ name, email, src, onSignOut }: { name: string; email: string; src?: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onClick(event: MouseEvent) {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm text-ink-700 transition-colors hover:bg-ink-100"
      >
        <Avatar name={name} src={src} tone="light" />
        <span className="hidden max-w-40 truncate md:inline">{name}</span>
        <IconChevronDown size={14} className="text-ink-400" />
      </button>
      {open && (
        <div role="menu" aria-label="Account" className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-overlay animate-fade-up">
          <div className="border-b border-ink-100 px-4 py-3">
            <div className="truncate text-sm font-medium text-ink-900">{name}</div>
            <div className="truncate text-xs text-ink-500">{email}</div>
          </div>
          <Link to="/profile" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-800 hover:bg-ink-50">
            <IconUser size={16} className="text-ink-500" />
            My profile
          </Link>
          <button type="button" role="menuitem" onClick={onSignOut} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-800 hover:bg-ink-50">
            <IconLogout size={16} className="text-ink-500" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  onNavigate,
}: {
  to: string
  label: string
  icon: (p: { size?: number; className?: string }) => ReactNode
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'relative flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-white/12 text-white shadow-[inset_0_1px_0_0_oklch(1_0_0/0.08)] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-400'
            : 'text-white/65 hover:bg-white/8 hover:text-white',
        ].join(' ')
      }
    >
      <Icon size={18} className="shrink-0 opacity-90" />
      {label}
    </NavLink>
  )
}

export function Avatar({ name, src, tone = 'dark', size = 'sm' }: { name: string; src?: string; tone?: 'dark' | 'light'; size?: 'sm' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const box = size === 'lg' ? 'h-12 w-12 text-sm' : 'h-8 w-8 text-xs'
  if (src) {
    return <img src={src} alt="" aria-hidden="true" className={`${box} shrink-0 rounded-full object-cover ring-1 ring-black/10`} />
  }
  return (
    <span aria-hidden="true" className={`flex ${box} shrink-0 items-center justify-center rounded-full font-semibold ${tone === 'dark' ? 'bg-white/15 text-white' : 'bg-brand-100 text-brand-800'}`}>
      {initials || '?'}
    </span>
  )
}

function prettyRole(code: string): string {
  return code
    .replace(/^BCM_/, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/^Bu /, 'BU ')
}
