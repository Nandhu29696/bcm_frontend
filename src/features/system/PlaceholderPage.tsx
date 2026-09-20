import type { ReactNode } from 'react'

interface PlaceholderPageProps {
  title: string
  phase: string
  description: string
  children?: ReactNode
}

/** Route stub, so the shell is navigable before the feature exists. */
export function PlaceholderPage({
  title,
  phase,
  description,
  children,
}: PlaceholderPageProps) {
  return (
    <div className="rounded-lg border border-dashed border-ink-300 bg-white p-8">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
        {phase && (
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-600">
            {phase}
          </span>
        )}
      </div>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">{description}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
