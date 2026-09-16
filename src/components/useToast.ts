import { useContext, useMemo } from 'react'

import { ToastContext } from './toastContext'

export function useToast() {
  const context = useContext(ToastContext)
  return useMemo(
    () => ({
      success: (message: string) => context?.push('success', message),
      error: (message: string) => context?.push('error', message),
      info: (message: string) => context?.push('info', message),
    }),
    [context],
  )
}
