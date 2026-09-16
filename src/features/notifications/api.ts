import { api } from '@/api/client'

export interface UserNotification {
  user_notification_id: number
  category: string
  title: string
  body: string
  link: string
  read_at: string | null
  created_at: string
}

export const notificationsApi = {
  list: async (unreadOnly = false): Promise<{ results: UserNotification[]; unread: number }> =>
    (await api.get('/notifications/', { params: unreadOnly ? { unread: 1 } : {} })).data,
  unreadCount: async (): Promise<number> => (await api.get('/notifications/unread-count/')).data.unread,
  markRead: async (id: number): Promise<UserNotification> => (await api.post(`/notifications/${id}/read/`)).data,
  markAllRead: async (): Promise<{ marked: number }> => (await api.post('/notifications/read-all/')).data,
  pushPublicKey: async (): Promise<{ configured: boolean; public_key: string }> => (await api.get('/notifications/push/public-key/')).data,
  pushSubscribe: async (subscription: PushSubscriptionJSON): Promise<{ subscribed: boolean; devices: number }> =>
    (await api.post('/notifications/push/subscribe/', subscription)).data,
  pushUnsubscribe: async (endpoint: string): Promise<{ removed: number; devices: number }> =>
    (await api.post('/notifications/push/unsubscribe/', { endpoint })).data,
}

export const notificationKeys = {
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
  pushKey: ['notifications', 'push-key'] as const,
}

// --------------------------------------------------------------------------- //
// Browser push
// --------------------------------------------------------------------------- //

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  return existing ?? navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

/** The browser's current subscription for this origin, if any. */
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

/** Ask permission, subscribe the browser, and register the subscription with the server. */
export async function enableBrowserPush(): Promise<'subscribed' | 'denied' | 'unsupported' | 'not_configured'> {
  if (!pushSupported()) return 'unsupported'
  const key = await notificationsApi.pushPublicKey()
  if (!key.configured) return 'not_configured'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const reg = await registration()
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key.public_key) as BufferSource }))
  await notificationsApi.pushSubscribe(subscription.toJSON())
  return 'subscribed'
}

export async function disableBrowserPush(): Promise<void> {
  const subscription = await currentPushSubscription()
  if (!subscription) return
  await notificationsApi.pushUnsubscribe(subscription.endpoint)
  await subscription.unsubscribe()
}
