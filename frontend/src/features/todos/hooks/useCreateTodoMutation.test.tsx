import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import type { TodoInput } from '../types'
import { useCreateTodoMutation } from './useCreateTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { create: vi.fn() } }))

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

const input: TodoInput = {
  title: 'Write tests',
  description: '',
  priority: 'high',
  due_date: null,
  completed: false,
}

beforeEach(() => vi.clearAllMocks())

it('sends the input to the API and puts the saved task first in the list', async () => {
  const existing = { ...todoFixture, id: 1, title: 'Older task' }
  const saved = { ...todoFixture, ...input, id: 8 }
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.list, [existing])
  const { result } = renderHook(() => useCreateTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(input)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(todosApi.create).toHaveBeenCalledWith(input)
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, existing])
})

it('creates the list in the cache when no tasks were loaded yet', async () => {
  const saved = { ...todoFixture, ...input, id: 8 }
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { client, wrapper: Wrapper } = wrapper()
  const { result } = renderHook(() => useCreateTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(input)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(client.getQueryData(todoKeys.list)).toEqual([saved])
})

it('does not duplicate a task that is already in the cache', async () => {
  const stale = { ...todoFixture, id: 8, title: 'Stale copy' }
  const other = { ...todoFixture, id: 1 }
  const saved = { ...todoFixture, ...input, id: 8 }
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.list, [other, stale])
  const { result } = renderHook(() => useCreateTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(input)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, other])
})

it('leaves the cached list unchanged when creation fails', async () => {
  vi.mocked(todosApi.create).mockRejectedValue(new Error('Invalid task'))
  const { client, wrapper: Wrapper } = wrapper()
  client.setQueryData(todoKeys.list, [todoFixture])
  const { result } = renderHook(() => useCreateTodoMutation(), {
    wrapper: Wrapper,
  })
  result.current.mutate(input)
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error).toEqual(new Error('Invalid task'))
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
