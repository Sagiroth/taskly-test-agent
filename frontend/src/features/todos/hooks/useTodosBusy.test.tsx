import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it } from 'vitest'
import { todoKeys } from '../api/queryKeys'
import { useTodosBusy } from './useTodosBusy'

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  }
}

it('is false when no task mutation is running', () => {
  const { wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useTodosBusy(), { wrapper: Wrapper })
  expect(result.current).toBe(false)
})

it.each([
  { name: 'create', mutationKey: todoKeys.create },
  { name: 'update', mutationKey: todoKeys.update },
  { name: 'delete', mutationKey: todoKeys.delete },
])(
  'is true while a $name mutation is pending and false once it settles',
  async ({ mutationKey }) => {
    let resolve: () => void = () => {}
    const pending = new Promise<void>((done) => {
      resolve = done
    })
    const { wrapper: Wrapper } = wrapper()
    const { result } = renderHook(
      () => ({
        busy: useTodosBusy(),
        mutation: useMutation({ mutationKey, mutationFn: () => pending }),
      }),
      { wrapper: Wrapper },
    )
    act(() => result.current.mutation.mutate())
    await waitFor(() => expect(result.current.busy).toBe(true))
    await act(async () => resolve())
    await waitFor(() => expect(result.current.busy).toBe(false))
  },
)

it('ignores mutations outside the todos key', async () => {
  const { wrapper: Wrapper } = wrapper()
  const { result } = renderHook(
    () => ({
      busy: useTodosBusy(),
      mutation: useMutation({
        mutationKey: ['settings', 'save'],
        mutationFn: () => new Promise<void>(() => {}),
      }),
    }),
    { wrapper: Wrapper },
  )
  act(() => result.current.mutation.mutate())
  await waitFor(() => expect(result.current.mutation.isPending).toBe(true))
  expect(result.current.busy).toBe(false)
})
