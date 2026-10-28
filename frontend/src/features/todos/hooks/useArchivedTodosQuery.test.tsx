import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useArchivedTodosQuery } from './useArchivedTodosQuery'

vi.mock('../api/todos', () => ({ todosApi: { listArchived: vi.fn() } }))

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

const archived = { ...todoFixture, completed: true, archived: true }

beforeEach(() => vi.clearAllMocks())

it('does not load archived tasks while disabled', () => {
  const { wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useArchivedTodosQuery(false), {
    wrapper: Wrapper,
  })
  expect(result.current.isPending).toBe(true)
  expect(result.current.fetchStatus).toBe('idle')
  expect(todosApi.listArchived).not.toHaveBeenCalled()
})

it('loads archived tasks when enabled and passes an abort signal', async () => {
  vi.mocked(todosApi.listArchived).mockResolvedValue([archived])
  const { client, wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useArchivedTodosQuery(true), {
    wrapper: Wrapper,
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([archived])
  expect(todosApi.listArchived).toHaveBeenCalledWith(expect.any(AbortSignal))
  expect(client.getQueryData(todoKeys.archived)).toEqual([archived])
})

it('starts loading once it becomes enabled', async () => {
  vi.mocked(todosApi.listArchived).mockResolvedValue([archived])
  const { wrapper: Wrapper } = wrapper()
  const { result, rerender } = renderHook(
    ({ enabled }) => useArchivedTodosQuery(enabled),
    { wrapper: Wrapper, initialProps: { enabled: false } },
  )
  expect(todosApi.listArchived).not.toHaveBeenCalled()
  rerender({ enabled: true })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([archived])
})

it('exposes the error when loading archived tasks fails', async () => {
  vi.mocked(todosApi.listArchived).mockRejectedValue(new Error('Server down'))
  const { wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useArchivedTodosQuery(true), {
    wrapper: Wrapper,
  })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error).toEqual(new Error('Server down'))
  expect(result.current.data).toBe(undefined)
})
