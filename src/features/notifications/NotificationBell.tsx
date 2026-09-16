import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { IconBell } from '@/components/icons'
import { formatDateTime } from '@/features/plans/format'

import { notificationKeys, notificationsApi, type UserNotification } from './api'

/**
 * The bell: unread count in the top bar, a dropdown of the latest
 * notifications, click to open the thing it is about. Polls every 30 s and on
 * focus; browser push (when enabled on the profile page) covers the closed tab.
 */
export function NotificationBell() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  const unread = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const list = useQuery({ queryKey: notificationKeys.list, queryFn: () => notificationsApi.list(), enabled: open })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.unread })
    void queryClient.invalidateQueries({ queryKey: notificationKeys.list })
  }
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh })
  const markOne = useMutation({ mutationFn: (id: number) => notificationsApi.markRead(id), onSuccess: refresh })

  useEffect(() => {
    if (!open) return
    function onDocumentClick(event: MouseEvent) {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const count = unread.data ?? 0

  function openNotification(n: UserNotification) {
    if (!n.read_at) markOne.mutate(n.user_notification_id)
    setOpen(false)
    if (n.link) void navigate(n.link)
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-full p-2 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
      >
        <IconBell size={19} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-overlay animate-fade-up"
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-ink-900">Notifications</span>
            {count > 0 && (
              <button type="button" onClick={() => markAll.mutate()} className="text-xs font-medium text-brand-700 hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto" aria-label="Notification list">
            {list.data?.results.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-500">You're all caught up.</li>}
            {list.data?.results.map((n) => (
              <li key={n.user_notification_id} className="border-b border-ink-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50 ${n.read_at ? '' : 'bg-brand-50/40'}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-brand-500'}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${n.read_at ? 'text-ink-700' : 'font-medium text-ink-900'}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-ink-500">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-ink-400">{formatDateTime(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-ink-100 px-4 py-2 text-right">
            <Link to="/profile#notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-ink-500 hover:text-brand-700">
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
