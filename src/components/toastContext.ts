import { createContext } from 'react'

export type Tone = 'success' | 'error' | 'info'

export const ToastContext = createContext<{ push: (tone: Tone, message: string) => void } | null>(null)
