import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todosApi } from '../api/todos'
import { useTodosQuery } from './useTodosQuery'

vi.mock('../api/todos', () => ({ todosApi: { list: vi.fn() } }))

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

beforeEach(() => vi.clearAllMocks())

it('returns the tasks loaded from the API and passes an abort signal', async () => {
  vi.mocked(todosApi.list).mockResolvedValue([todoFixture])
  const { wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useTodosQuery(), { wrapper: Wrapper })
  expect(result.current.isPending).toBe(true)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([todoFixture])
  expect(todosApi.list).toHaveBeenCalledWith(expect.any(AbortSignal))
})

it('exposes the error when loading fails', async () => {
  vi.mocked(todosApi.list).mockRejectedValue(new Error('Server down'))
  const { wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useTodosQuery(), { wrapper: Wrapper })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error).toEqual(new Error('Server down'))
  expect(result.current.data).toBe(undefined)
})
