import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

/**
 * The single axios instance every API call goes through.
 *
 * It handles JWT refresh transparently. The important property is that only ONE
 * refresh request is ever in flight: concurrent 401s queue behind the same
 * promise and retry once it resolves. Without that, a page issuing five parallel
 * requests on an expired token fires five refreshes, and with
 * ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION enabled on the backend, four
 * of them are rejected with a blacklisted token and the user is logged out.
 */

const ACCESS_TOKEN_KEY = 'bcm.access'
const REFRESH_TOKEN_KEY = 'bcm.refresh'

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export const api: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** The in-flight refresh, or null. Shared by every queued retry. */
let refreshPromise: Promise<string> | null = null

function onAuthFailure() {
  tokenStore.clear()
  // Full reload rather than a router navigate: this can fire from outside the
  // React tree, and a hard reset clears any stale cached state.
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStore.refresh
  if (!refresh) throw new Error('No refresh token')

  // Bare axios, not `api` — going through the instance would recurse into this
  // same interceptor.
  const { data } = await axios.post('/api/v1/auth/refresh/', { refresh })
  tokenStore.set(data.access, data.refresh)
  return data.access as string
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean
    }

    const isAuthEndpoint = original?.url?.includes('/auth/')
    if (
      error.response?.status !== 401 ||
      original?._retried ||
      isAuthEndpoint
    ) {
      return Promise.reject(error)
    }

    original._retried = true

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const access = await refreshPromise
      original.headers.Authorization = `Bearer ${access}`
      return api(original)
    } catch (refreshError) {
      onAuthFailure()
      return Promise.reject(refreshError)
    }
  },
)

/** The error envelope the backend's exception handler always returns. */
export interface ApiError {
  detail: string
  code: string
  field_errors: Record<string, string[]>
  /** The server's X-Request-ID, when it answered: quote it to support. */
  request_id?: string
}

export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error) && error.response) {
    const data = (error.response.data ?? {}) as Partial<ApiError>
    const requestId = (error.response.headers?.['x-request-id'] as string | undefined) ?? undefined
    const status = error.response.status
    // Anything other than a validation or sign-in problem carries its request
    // reference in the message, so a screenshot is enough for support to find
    // the exact log lines and Sentry event.
    const detail = data.detail ?? (status >= 500 ? 'The server could not complete the request.' : 'Something went wrong.')
    const withReference = requestId && status !== 400 && status !== 401
    return {
      detail: withReference ? `${detail} (ref ${requestId.slice(0, 12)})` : detail,
      code: data.code ?? (status >= 500 ? 'server_error' : 'error'),
      field_errors: data.field_errors ?? {},
      request_id: requestId,
    }
  }
  return { detail: 'Network error.', code: 'network_error', field_errors: {} }
}
