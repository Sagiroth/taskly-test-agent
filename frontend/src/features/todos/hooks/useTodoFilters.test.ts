import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useTodoFilters } from './useTodoFilters'

const older = {
  ...todoFixture,
  id: 1,
  title: 'Buy milk',
  priority: 'low' as const,
  completed: true,
  created_at: '2026-09-01T08:00:00Z',
}
const newer = {
  ...todoFixture,
  id: 2,
  title: 'Call the bank',
  priority: 'high' as const,
  created_at: '2026-10-02T08:00:00Z',
}

it('starts with all tasks, no search and newest first', () => {
  const { result } = renderHook(() => useTodoFilters([older, newer]))
  expect(result.current.filter).toBe('all')
  expect(result.current.search).toBe('')
  expect(result.current.sort).toBe('newest')
  expect(result.current.visible).toEqual([newer, older])
})

it('shows only completed tasks after switching the filter', () => {
  const { result } = renderHook(() => useTodoFilters([older, newer]))
  act(() => result.current.setFilter('completed'))
  expect(result.current.filter).toBe('completed')
  expect(result.current.visible).toEqual([older])
})

it('shows only tasks matching the search text', () => {
  const { result } = renderHook(() => useTodoFilters([older, newer]))
  act(() => result.current.setSearch('BANK'))
  expect(result.current.search).toBe('BANK')
  expect(result.current.visible).toEqual([newer])
})

it('reorders tasks after changing the sort', () => {
  const lowNewest = { ...newer, priority: 'low' as const }
  const highOldest = { ...older, priority: 'high' as const }
  const { result } = renderHook(() => useTodoFilters([lowNewest, highOldest]))
  act(() => result.current.setSort('priority'))
  expect(result.current.sort).toBe('priority')
  expect(result.current.visible).toEqual([highOldest, lowNewest])
})

it('recomputes visible tasks when the task list changes', () => {
  const { result, rerender } = renderHook(
    ({ todos }) => useTodoFilters(todos),
    { initialProps: { todos: [older] } },
  )
  rerender({ todos: [older, newer] })
  expect(result.current.visible).toEqual([newer, older])
})

it('returns an empty list when there are no tasks', () => {
  const { result } = renderHook(() => useTodoFilters([]))
  expect(result.current.visible).toEqual([])
})
