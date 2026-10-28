import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { remove: vi.fn() } }))

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

it('deletes the task through the API and removes it from the list', async () => {
  const other = { ...todoFixture, id: 1, title: 'Other task' }
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.list, [other, todoFixture])
  const { result } = renderHook(() => useDeleteTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(todoFixture.id)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(todosApi.remove).toHaveBeenCalledWith(todoFixture.id)
  expect(client.getQueryData(todoKeys.list)).toEqual([other])
})

it('does not create a list in the cache when no tasks were loaded', async () => {
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { client, wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useDeleteTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(todoFixture.id)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(client.getQueryData(todoKeys.list)).toBe(undefined)
})

it('keeps the task in the list when deletion fails', async () => {
  vi.mocked(todosApi.remove).mockRejectedValue(new Error('Task not found'))
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.list, [todoFixture])
  const { result } = renderHook(() => useDeleteTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(todoFixture.id)
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error).toEqual(new Error('Task not found'))
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
