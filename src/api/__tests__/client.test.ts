import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { toApiError } from '../client'

function axiosError(status: number, data: unknown, requestId?: string) {
  const headers = new AxiosHeaders()
  if (requestId) headers.set('x-request-id', requestId)
  return new AxiosError('boom', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers,
    config: { headers: new AxiosHeaders() },
    data,
  })
}

describe('toApiError', () => {
  it('passes the backend envelope through', () => {
    const error = toApiError(axiosError(400, { detail: 'Validation failed.', code: 'invalid', field_errors: { title: ['Required.'] } }, 'abc'))
    expect(error).toMatchObject({ detail: 'Validation failed.', code: 'invalid', request_id: 'abc' })
    expect(error.field_errors.title).toEqual(['Required.'])
  })
  it('adds the request reference to server faults', () => {
    const error = toApiError(axiosError(500, {}, 'deadbeefcafe1234'))
    expect(error.detail).toBe('The server could not complete the request. (ref deadbeefcafe)')
    expect(error.code).toBe('server_error')
  })
  it('keeps validation and sign-in messages clean but references everything else', () => {
    expect(toApiError(axiosError(400, { detail: 'Validation failed.' }, 'abc')).detail).toBe('Validation failed.')
    expect(toApiError(axiosError(401, { detail: 'Sign in.' }, 'abc')).detail).toBe('Sign in.')
    expect(toApiError(axiosError(403, { detail: 'Not allowed.' }, 'abcdef123456xyz')).detail).toBe('Not allowed. (ref abcdef123456)')
    expect(toApiError(axiosError(404, { detail: 'Not found.' }, 'abcdef123456xyz')).detail).toBe('Not found. (ref abcdef123456)')
  })
  it('names a network failure', () => {
    expect(toApiError(new Error('offline'))).toEqual({ detail: 'Network error.', code: 'network_error', field_errors: {} })
  })
})
