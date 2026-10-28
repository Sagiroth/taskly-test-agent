import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useUpdateTodoMutation } from './useUpdateTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { update: vi.fn() } }))

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

it('sends the id and changes to the API and replaces the matching task in the list', async () => {
  const other = { ...todoFixture, id: 1, title: 'Other task' }
  const saved = { ...todoFixture, completed: true }
  vi.mocked(todosApi.update).mockResolvedValue(saved)
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.list, [other, todoFixture])
  const { result } = renderHook(() => useUpdateTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate({ id: todoFixture.id, input: { completed: true } })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(todosApi.update).toHaveBeenCalledWith(todoFixture.id, {
    completed: true,
  })
  expect(client.getQueryData(todoKeys.list)).toEqual([other, saved])
})

it('does not create a list in the cache when no tasks were loaded', async () => {
  vi.mocked(todosApi.update).mockResolvedValue(todoFixture)
  const { client, wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useUpdateTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate({ id: todoFixture.id, input: { title: 'New' } })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(client.getQueryData(todoKeys.list)).toBe(undefined)
})

it('leaves the cached list unchanged when the update fails', async () => {
  vi.mocked(todosApi.update).mockRejectedValue(new Error('Task not found'))
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.list, [todoFixture])
  const { result } = renderHook(() => useUpdateTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate({ id: todoFixture.id, input: { completed: true } })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error).toEqual(new Error('Task not found'))
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
