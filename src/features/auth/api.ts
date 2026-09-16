import { api } from '@/api/client'

import type { CurrentUser, LoginResult, SsoProvider, TokenPair } from './types'

export const authApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    const { data } = await api.post<LoginResult>('/auth/login/', { email, password })
    return data
  },

  async verifyOtp(email: string, code: string): Promise<TokenPair> {
    const { data } = await api.post<TokenPair>('/auth/otp/verify/', { email, code })
    return data
  },

  async resendOtp(email: string): Promise<{ detail: string }> {
    const { data } = await api.post('/auth/otp/resend/', { email })
    return data
  },

  async me(): Promise<CurrentUser> {
    const { data } = await api.get<CurrentUser>('/auth/me/')
    return data
  },

  async updateProfile(payload: { display_name?: string; phone_number?: string; job_title?: string }): Promise<CurrentUser> {
    const { data } = await api.patch<CurrentUser>('/auth/me/', payload)
    return data
  },

  async uploadAvatar(file: File): Promise<CurrentUser> {
    const form = new FormData()
    form.append('image', file)
    const { data } = await api.post<CurrentUser>('/auth/me/avatar/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  },

  async removeAvatar(): Promise<CurrentUser> {
    const { data } = await api.delete<CurrentUser>('/auth/me/avatar/')
    return data
  },

  async changePassword(payload: { current_password: string; new_password: string }): Promise<{ detail: string }> {
    const { data } = await api.post('/auth/password/change/', payload)
    return data
  },

  async logout(refresh: string): Promise<void> {
    await api.post('/auth/logout/', { refresh })
  },

  async requestPasswordReset(email: string): Promise<{ detail: string }> {
    const { data } = await api.post('/auth/password/reset/', { email })
    return data
  },

  async confirmPasswordReset(payload: {
    uid: string
    token: string
    new_password: string
  }): Promise<{ detail: string }> {
    const { data } = await api.post('/auth/password/reset/confirm/', payload)
    return data
  },

  async register(payload: {
    email: string
    display_name: string
    password: string
  }): Promise<{ detail: string; user_status: string }> {
    const { data } = await api.post('/auth/register/', payload)
    return data
  },

  async ssoProviders(): Promise<SsoProvider[]> {
    const { data } = await api.get<{ providers: SsoProvider[] }>('/auth/providers/')
    return data.providers
  },

  async ssoAuthorize(provider: string): Promise<{ authorize_url: string; state: string }> {
    const { data } = await api.get(`/auth/${provider}/authorize/`)
    return data
  },

  async ssoCallback(
    provider: string,
    code: string,
    state: string,
  ): Promise<TokenPair & { user_status: string; new_account: boolean }> {
    const { data } = await api.post(`/auth/${provider}/callback/`, { code, state })
    return data
  },
}
