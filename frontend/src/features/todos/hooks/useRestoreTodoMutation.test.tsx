import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useRestoreTodoMutation } from './useRestoreTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { restore: vi.fn() } }))

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

it('restores the task by id and returns it', async () => {
  const restored = { ...archived, archived: false }
  vi.mocked(todosApi.restore).mockResolvedValue(restored)
  const { wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useRestoreTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(todoFixture.id)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(todosApi.restore).toHaveBeenCalledExactlyOnceWith(todoFixture.id)
  expect(result.current.data).toEqual(restored)
})

it('reloads the task list and the archive from the server after restoring', async () => {
  vi.mocked(todosApi.restore).mockResolvedValue({ ...archived, archived: false })
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.list, [])
  client.setQueryData(todoKeys.archived, [archived])
  const { result } = renderHook(() => useRestoreTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(todoFixture.id)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(client.getQueryState(todoKeys.list)?.isInvalidated).toBe(true)
  expect(client.getQueryState(todoKeys.archived)?.isInvalidated).toBe(true)
})

it('leaves the archive unchanged and exposes the error when restoring fails', async () => {
  vi.mocked(todosApi.restore).mockRejectedValue(new Error('Task not found.'))
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.archived, [archived])
  const { result } = renderHook(() => useRestoreTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(todoFixture.id)
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error).toEqual(new Error('Task not found.'))
  expect(client.getQueryData(todoKeys.archived)).toEqual([archived])
  expect(client.getQueryState(todoKeys.archived)?.isInvalidated).toBe(false)
})

it('uses a mutation key under the todos key so the page is busy while restoring', async () => {
  const { client, wrapper: Wrapper } = wrapper()
  vi.mocked(todosApi.restore).mockReturnValue(new Promise(() => {}))
  const { result } = renderHook(() => useRestoreTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(todoFixture.id)
  await waitFor(() =>
    expect(client.isMutating({ mutationKey: todoKeys.all })).toBe(1),
  )
})
