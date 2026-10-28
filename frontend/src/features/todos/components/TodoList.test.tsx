import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import type { Todo } from '../types'
import { TodoEmptyState } from './TodoEmptyState'
import { TodoList } from './TodoList'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('./TodoEmptyState', () => ({
  TodoEmptyState: vi.fn(() => <p>Empty task list</p>),
}))
vi.mock('./TodoItem', () => ({
  TodoItem: ({
    todo,
    busy,
    onToggle,
    onEdit,
    onDelete,
    onRestore,
  }: {
    todo: Todo
    busy: boolean
    onToggle: () => void
    onEdit: () => void
    onDelete: () => void
    onRestore?: () => void
  }) => (
    <li>
      {todo.title}
      <button disabled={busy} onClick={onToggle}>
        Toggle {todo.title}
      </button>
      <button onClick={onEdit}>Edit {todo.title}</button>
      <button onClick={onDelete}>Delete {todo.title}</button>
      {onRestore && <button onClick={onRestore}>Restore {todo.title}</button>}
    </li>
  ),
}))

beforeEach(() => vi.clearAllMocks())

it('shows loading feedback before showing an empty list', () => {
  const props = {
    todos: [],
    hasTodos: false,
    failed: false,
    busy: false,
    onCreate: vi.fn(),
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  const { rerender } = render(<TodoList {...props} loading />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading your tasks…')
  expect(screen.queryByText('Empty task list')).not.toBeInTheDocument()
  rerender(<TodoList {...props} loading={false} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('Empty task list')).toBeVisible()
})

it('shows an unavailable message when loading failed and no tasks are known', () => {
  render(
    <TodoList
      todos={[]}
      hasTodos={false}
      loading={false}
      failed
      busy={false}
      onCreate={vi.fn()}
      onToggle={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(
    screen.getByRole('heading', {
      name: 'The task list is temporarily unavailable',
    }),
  ).toBeVisible()
  expect(screen.getByText('Try again to load your tasks.')).toBeVisible()
  expect(screen.queryByText('Empty task list')).not.toBeInTheDocument()
})

it('keeps showing known tasks when a refetch failed', () => {
  render(
    <TodoList
      todos={[todoFixture]}
      hasTodos
      loading={false}
      failed
      busy={false}
      onCreate={vi.fn()}
      onToggle={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByRole('listitem')).toHaveTextContent(todoFixture.title)
  expect(
    screen.queryByText('The task list is temporarily unavailable'),
  ).not.toBeInTheDocument()
})

it('renders one item per task inside the labelled task list', () => {
  const second = { ...todoFixture, id: 8, title: 'Review notes' }
  render(
    <TodoList
      todos={[todoFixture, second]}
      hasTodos
      loading={false}
      failed={false}
      busy={false}
      onCreate={vi.fn()}
      onToggle={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(items[0]).toHaveTextContent(todoFixture.title)
  expect(items[1]).toHaveTextContent('Review notes')
  expect(screen.getByRole('region', { name: 'Task list' })).toContainElement(
    items[0],
  )
})

it('forwards item actions with the task they belong to', async () => {
  const user = userEvent.setup()
  const second = { ...todoFixture, id: 8, title: 'Review notes' }
  const onToggle = vi.fn()
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  render(
    <TodoList
      todos={[todoFixture, second]}
      hasTodos
      loading={false}
      failed={false}
      busy={false}
      onCreate={vi.fn()}
      onToggle={onToggle}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Toggle Review notes' }))
  await user.click(
    screen.getByRole('button', { name: `Edit ${todoFixture.title}` }),
  )
  await user.click(screen.getByRole('button', { name: 'Delete Review notes' }))
  expect(onToggle).toHaveBeenCalledExactlyOnceWith(second)
  expect(onEdit).toHaveBeenCalledExactlyOnceWith(todoFixture)
  expect(onDelete).toHaveBeenCalledExactlyOnceWith(second)
})

it('forwards restore requests with the task they belong to', async () => {
  const user = userEvent.setup()
  const archived = { ...todoFixture, completed: true, archived: true }
  const second = { ...archived, id: 8, title: 'Review notes' }
  const onRestore = vi.fn()
  render(
    <TodoList
      todos={[archived, second]}
      hasTodos
      loading={false}
      failed={false}
      busy={false}
      onCreate={vi.fn()}
      onToggle={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onRestore={onRestore}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Restore Review notes' }))
  expect(onRestore).toHaveBeenCalledExactlyOnceWith(second)
})

it('does not offer restoring when no restore callback is given', () => {
  render(
    <TodoList
      todos={[todoFixture]}
      hasTodos
      loading={false}
      failed={false}
      busy={false}
      onCreate={vi.fn()}
      onToggle={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(
    screen.queryByRole('button', { name: `Restore ${todoFixture.title}` }),
  ).not.toBeInTheDocument()
})

it('passes the busy state to every item', () => {
  render(
    <TodoList
      todos={[todoFixture]}
      hasTodos
      loading={false}
      failed={false}
      busy
      onCreate={vi.fn()}
      onToggle={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(
    screen.getByRole('button', { name: `Toggle ${todoFixture.title}` }),
  ).toBeDisabled()
})

it('passes filter state, busy state and the create callback to the empty state', () => {
  const onCreate = vi.fn()
  render(
    <TodoList
      todos={[]}
      hasTodos
      loading={false}
      failed={false}
      busy
      onCreate={onCreate}
      onToggle={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText('Empty task list')).toBeVisible()
  expect(vi.mocked(TodoEmptyState).mock.lastCall?.[0]).toEqual({
    hasTodos: true,
    disabled: true,
    onCreate,
  })
})
