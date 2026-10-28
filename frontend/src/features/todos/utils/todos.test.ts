import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDate, isOverdue, selectTodos, validateTodo } from './todos'
import type { Todo, TodoInput } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  archived: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

const validInput: TodoInput = {
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  due_date: null,
  completed: false,
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })

  it('keeps only completed tasks with the completed filter', () => {
    const done: Todo = { ...base, id: 2, completed: true }
    expect(selectTodos([base, done], 'completed', '', 'newest')).toEqual([done])
  })

  it('keeps every task with the all filter and an empty search', () => {
    const done: Todo = { ...base, id: 2, completed: true }
    expect(selectTodos([base, done], 'all', '', 'newest')).toEqual([done, base])
  })

  it('keeps every task regardless of completion with the archived filter', () => {
    const archivedOpen: Todo = { ...base, archived: true }
    const archivedDone: Todo = { ...base, id: 2, completed: true, archived: true }
    expect(
      selectTodos([archivedOpen, archivedDone], 'archived', '', 'newest'),
    ).toEqual([archivedDone, archivedOpen])
  })

  it('combines the archived filter with the search', () => {
    const matching: Todo = { ...base, completed: true, archived: true }
    const other: Todo = { ...matching, id: 2, title: 'Buy milk' }
    expect(selectTodos([matching, other], 'archived', 'milk', 'newest')).toEqual(
      [other],
    )
  })

  it('searches case-insensitively in the title', () => {
    const other: Todo = { ...base, id: 2, title: 'Buy milk' }
    expect(selectTodos([base, other], 'all', 'SPRINT', 'newest')).toEqual([
      base,
    ])
  })

  it('returns an empty list when no task matches the search', () => {
    expect(selectTodos([base], 'all', 'nothing like this', 'newest')).toEqual(
      [],
    )
  })

  it('returns an empty list for an empty input', () => {
    expect(selectTodos([], 'all', '', 'newest')).toEqual([])
  })

  it('sorts by newest creation date first', () => {
    const older: Todo = { ...base, id: 2, created_at: '2026-09-01T12:00:00Z' }
    const newer: Todo = { ...base, id: 3, created_at: '2026-10-20T12:00:00Z' }
    expect(selectTodos([older, base, newer], 'all', '', 'newest')).toEqual([
      newer,
      base,
      older,
    ])
  })

  it('breaks ties of the newest sort by the higher id first', () => {
    const sameTime: Todo = { ...base, id: 2 }
    expect(selectTodos([base, sameTime], 'all', '', 'newest')).toEqual([
      sameTime,
      base,
    ])
  })

  it('orders priorities high, medium, low and breaks ties by the higher id', () => {
    const low: Todo = { ...base, id: 2, priority: 'low' }
    const high: Todo = { ...base, id: 3, priority: 'high' }
    const medium: Todo = { ...base, id: 4, priority: 'medium' }
    expect(selectTodos([low, base, high, medium], 'all', '', 'priority')).toEqual(
      [high, medium, base, low],
    )
  })

  it('sorts by the earliest due date and puts tasks without a date last', () => {
    const noDate: Todo = { ...base, id: 2 }
    const later: Todo = { ...base, id: 3, due_date: '2026-12-01' }
    const sooner: Todo = { ...base, id: 4, due_date: '2026-11-01' }
    expect(selectTodos([noDate, later, sooner], 'all', '', 'due')).toEqual([
      sooner,
      later,
      noDate,
    ])
  })

  it('breaks ties of the due date sort by the higher id', () => {
    const first: Todo = { ...base, id: 2, due_date: '2026-11-01' }
    const second: Todo = { ...base, id: 3, due_date: '2026-11-01' }
    expect(selectTodos([first, second], 'all', '', 'due')).toEqual([
      second,
      first,
    ])
  })
})

describe('validateTodo', () => {
  it('accepts a valid task without a due date', () => {
    expect(validateTodo(validInput)).toEqual({})
  })

  it('accepts a valid calendar date', () => {
    expect(validateTodo({ ...validInput, due_date: '2026-10-28' })).toEqual({})
  })

  it('accepts the leap day of a leap year', () => {
    expect(validateTodo({ ...validInput, due_date: '2028-02-29' })).toEqual({})
  })

  it.each(['', '   '])('rejects the empty title %j', (title) => {
    expect(validateTodo({ ...validInput, title })).toEqual({
      title: 'Enter a task title.',
    })
  })

  it('accepts a title of exactly 120 characters', () => {
    expect(validateTodo({ ...validInput, title: 'a'.repeat(120) })).toEqual({})
  })

  it('ignores surrounding whitespace when checking the title length', () => {
    expect(
      validateTodo({ ...validInput, title: `  ${'a'.repeat(120)}  ` }),
    ).toEqual({})
  })

  it('rejects a title longer than 120 characters', () => {
    expect(validateTodo({ ...validInput, title: 'a'.repeat(121) })).toEqual({
      title: 'The title must be at most 120 characters.',
    })
  })

  it('accepts a description of exactly 2000 characters', () => {
    expect(
      validateTodo({ ...validInput, description: 'a'.repeat(2000) }),
    ).toEqual({})
  })

  it('rejects a description longer than 2000 characters', () => {
    expect(
      validateTodo({ ...validInput, description: 'a'.repeat(2001) }),
    ).toEqual({
      description: 'The description must be at most 2000 characters.',
    })
  })

  it.each(['2026-02-30', '2027-02-29', '2026-13-01', '2026-2-3', 'tomorrow'])(
    'rejects the invalid due date %j',
    (due_date) => {
      expect(validateTodo({ ...validInput, due_date })).toEqual({
        due_date: 'Enter a valid date.',
      })
    },
  )

  it('reports every invalid field at once', () => {
    expect(
      validateTodo({
        ...validInput,
        title: '',
        description: 'a'.repeat(2001),
        due_date: '2026-02-30',
      }),
    ).toEqual({
      title: 'Enter a task title.',
      description: 'The description must be at most 2000 characters.',
      due_date: 'Enter a valid date.',
    })
  })
})

describe('isOverdue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is overdue for an active task due before today', () => {
    expect(isOverdue({ ...base, due_date: '2026-10-27' })).toBe(true)
  })

  it('is not overdue for a task due today', () => {
    expect(isOverdue({ ...base, due_date: '2026-10-28' })).toBe(false)
  })

  it('is not overdue for a task due in the future', () => {
    expect(isOverdue({ ...base, due_date: '2026-10-29' })).toBe(false)
  })

  it('is not overdue for a completed task due in the past', () => {
    expect(
      isOverdue({ ...base, completed: true, due_date: '2026-10-01' }),
    ).toBe(false)
  })

  it('is not overdue for a task without a due date', () => {
    expect(isOverdue({ ...base, due_date: null })).toBe(false)
  })
})

describe('formatDate', () => {
  it('formats a date-only value as day, short month and year', () => {
    expect(formatDate('2026-10-28')).toBe('28 Oct 2026')
  })

  it('keeps the calendar day for the first day of the year', () => {
    expect(formatDate('2027-01-01')).toBe('1 Jan 2027')
  })
})
