import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SsoButtons } from '../SsoButtons'

function renderWithQuery(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

describe('SsoButtons', () => {
  it('offers only the providers the backend has configured', () => {
    renderWithQuery(
      <SsoButtons
        providers={[
          { name: 'google', configured: true },
          { name: 'microsoft', configured: false },
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue with microsoft/i })).not.toBeInTheDocument()
  })

  it('renders nothing at all when no provider is configured', () => {
    const { container } = renderWithQuery(<SsoButtons providers={[{ name: 'google', configured: false }]} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(/^or$/i)).not.toBeInTheDocument()
  })
})
