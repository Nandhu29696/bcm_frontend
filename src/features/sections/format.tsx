import type { ReactNode } from 'react'

import type { EmployeeRef } from './types'

export function employeeName(ref: EmployeeRef | null | undefined): ReactNode {
  return ref ? ref.name : <span className="text-ink-400">—</span>
}

export function dash(value: unknown): ReactNode {
  return value === null || value === undefined || value === '' ? <span className="text-ink-400">—</span> : String(value)
}
