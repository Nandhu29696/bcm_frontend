import { lazy, Suspense, type ComponentType } from 'react'

import { Spinner } from '@/components/ui'

/**
 * Every signed-in screen is its own chunk (Phase 10.2): the sign-in page and
 * the shell load first, a screen's code arrives when it is first opened, and a
 * change to the crisis pages does not invalidate the cached editor bundle.
 */
export function page(load: () => Promise<{ default: ComponentType }>) {
  const Lazy = lazy(load)
  return function LazyPage() {
    return (
      <Suspense
        fallback={
          <div className="py-16 text-center">
            <Spinner label="Loading" />
          </div>
        }
      >
        <Lazy />
      </Suspense>
    )
  }
}
