import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

/**
 * The single axios instance every API call goes through.
 *
 * Tokens live in HttpOnly cookies (BUG-21), not in JS-readable storage: the
 * browser attaches them automatically, and `withCredentials` plus the
 * xsrf options below make axios do the same with the CSRF double-submit
 * cookie the backend sets alongside them.
 *
 * It also handles JWT refresh transparently. The important property is that
 * only ONE refresh request is ever in flight: concurrent 401s queue behind
 * the same promise and retry once it resolves. Without that, a page issuing
 * five parallel requests on an expired token fires five refreshes, and with
 * ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION enabled on the backend,
 * four of them are rejected with a blacklisted token and the user is logged
 * out.
 */

export const api: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  // Explicit rather than left to axios's same-origin auto-detection: a
  // silently-missing CSRF header turns into every state-changing request
  // failing with 403, and this is cheap insurance against that heuristic
  // changing across axios versions.
  withXSRFToken: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

/** The in-flight refresh, or null. Shared by every queued retry. */
let refreshPromise: Promise<void> | null = null

function onAuthFailure() {
  // Full reload rather than a router navigate: this can fire from outside the
  // React tree, and a hard reset clears any stale cached state. Nothing to
  // clear client-side — the cookies are HttpOnly and the backend already
  // rejected them.
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

async function refreshAccessToken(): Promise<void> {
  // Bare axios, not `api` — going through the instance would recurse into this
  // same interceptor. The refresh token rides the HttpOnly cookie; there is
  // nothing to put in the body.
  await axios.post(
    '/api/v1/auth/refresh/',
    {},
    {
      withCredentials: true,
      withXSRFToken: true,
      xsrfCookieName: 'csrftoken',
      xsrfHeaderName: 'X-CSRFToken',
    },
  )
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
      await refreshPromise
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
