import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { useTheme } from 'styled-components'
import { expect, it, vi } from 'vitest'
import { theme } from '../design-system'
import { queryClient } from '../lib/queryClient'
import { AppProviders } from './AppProviders'

vi.mock('../design-system', () => import('../design-system/mocks'))

function ClientProbe({ expected }: { expected: QueryClient }) {
  const client = useQueryClient()
  return <p>{client === expected ? 'given client' : 'other client'}</p>
}

function ThemeProbe() {
  return <p>{useTheme() === theme ? 'app theme' : 'no theme'}</p>
}

it('renders children with the given query client', () => {
  const client = new QueryClient()
  render(
    <AppProviders client={client}>
      <ClientProbe expected={client} />
    </AppProviders>,
  )
  expect(screen.getByText('given client')).toBeVisible()
})

it('uses the shared application query client by default', () => {
  render(
    <AppProviders>
      <ClientProbe expected={queryClient} />
    </AppProviders>,
  )
  expect(screen.getByText('given client')).toBeVisible()
})

it('provides the design system theme to children', () => {
  render(
    <AppProviders client={new QueryClient()}>
      <ThemeProbe />
    </AppProviders>,
  )
  expect(screen.getByText('app theme')).toBeVisible()
})
