import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useArchiveCompletedMutation } from './useArchiveCompletedMutation'

vi.mock('../api/todos', () => ({ todosApi: { archiveCompleted: vi.fn() } }))

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

it('archives completed tasks and returns the number archived', async () => {
  vi.mocked(todosApi.archiveCompleted).mockResolvedValue({ archived: 2 })
  const { wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useArchiveCompletedMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate()
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual({ archived: 2 })
  expect(todosApi.archiveCompleted).toHaveBeenCalledTimes(1)
})

it('reloads the task list and the archive from the server after archiving', async () => {
  vi.mocked(todosApi.archiveCompleted).mockResolvedValue({ archived: 1 })
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.list, [{ ...todoFixture, completed: true }])
  client.setQueryData(todoKeys.archived, [])
  const { result } = renderHook(() => useArchiveCompletedMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate()
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(client.getQueryState(todoKeys.list)?.isInvalidated).toBe(true)
  expect(client.getQueryState(todoKeys.archived)?.isInvalidated).toBe(true)
})

it('leaves the cached task list unchanged and exposes the error when archiving fails', async () => {
  vi.mocked(todosApi.archiveCompleted).mockRejectedValue(
    new Error('Could not archive.'),
  )
  const done = { ...todoFixture, completed: true }
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.list, [done])
  const { result } = renderHook(() => useArchiveCompletedMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate()
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error).toEqual(new Error('Could not archive.'))
  expect(client.getQueryData(todoKeys.list)).toEqual([done])
  expect(client.getQueryState(todoKeys.list)?.isInvalidated).toBe(false)
})

it('uses a mutation key under the todos key so the page is busy while archiving', async () => {
  const { client, wrapper: Wrapper } = wrapper()
  vi.mocked(todosApi.archiveCompleted).mockReturnValue(new Promise(() => {}))
  const { result } = renderHook(() => useArchiveCompletedMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate()
  await waitFor(() =>
    expect(client.isMutating({ mutationKey: todoKeys.all })).toBe(1),
  )
})
