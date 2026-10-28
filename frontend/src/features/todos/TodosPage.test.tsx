import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNotice } from '../../hooks/useNotice'
import { todoFixture } from '../../test/todoFixture'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import { TodosPage } from './TodosPage'
import type { Todo } from './types'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: ({
    disabled,
    onCreate,
  }: {
    disabled: boolean
    onCreate: () => void
  }) => (
    <header>
      <h1>Tasks</h1>
      <button disabled={disabled} onClick={onCreate}>
        New task
      </button>
    </header>
  ),
}))
vi.mock('./components/TodoFilters', () => ({ TodoFilters: () => null }))
vi.mock('./components/TodoList', () => ({
  TodoList: ({
    todos,
    hasTodos,
    loading,
    failed,
    onToggle,
    onEdit,
    onDelete,
  }: {
    todos: Todo[]
    hasTodos: boolean
    loading: boolean
    failed: boolean
    onToggle: (todo: Todo) => void
    onEdit: (todo: Todo) => void
    onDelete: (todo: Todo) => void
  }) => (
    <section aria-label="Task list">
      <p>
        Task list: {todos.length} visible, has tasks {String(hasTodos)},
        loading {String(loading)}, failed {String(failed)}
      </p>
      {todos.map((todo) => (
        <div key={todo.id}>
          <button onClick={() => onToggle(todo)}>Toggle {todo.title}</button>
          <button onClick={() => onEdit(todo)}>Edit {todo.title}</button>
          <button onClick={() => onDelete(todo)}>Delete {todo.title}</button>
        </div>
      ))}
    </section>
  ),
}))
vi.mock('./components/TodoEditor', () => ({
  TodoEditor: ({
    todo,
    onClose,
    onSaved,
  }: {
    todo: Todo | 'new'
    onClose: () => void
    onSaved: (message: string) => void
  }) => (
    <div role="dialog" aria-label="Editor">
      <p>Editing: {todo === 'new' ? 'new task' : todo.title}</p>
      <button onClick={() => onSaved('Changes saved.')}>Save editor</button>
      <button onClick={onClose}>Close editor</button>
    </div>
  ),
}))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: ({
    todo,
    onClose,
    onDeleted,
  }: {
    todo: Todo
    onClose: () => void
    onDeleted: () => void
  }) => (
    <div role="dialog" aria-label="Delete confirmation">
      <p>Deleting: {todo.title}</p>
      <button onClick={onDeleted}>Confirm delete</button>
      <button onClick={onClose}>Close delete</button>
    </div>
  ),
}))
vi.mock('../../components/SuccessNotice', () => ({ SuccessNotice: () => null }))
beforeEach(() => vi.clearAllMocks())

it('displays a query failure and resets mutation errors before retrying', async () => {
  const user = userEvent.setup()
  const refetch = vi.fn().mockResolvedValue(undefined)
  const reset = vi.fn()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [],
    isPending: false,
    isFetching: false,
    isError: true,
    error: new Error('The server is unavailable.'),
    refetch,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(false)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify: vi.fn() })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'The server is unavailable.',
  )
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  expect(reset).toHaveBeenCalledTimes(1)
  expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
    refetch.mock.invocationCallOrder[0],
  )
})

function mockLoadedPage({
  todos = [todoFixture],
  busy = false,
  mutateAsync = vi.fn(),
  mutationError = null,
  queryError = null,
  isFetching = false,
}: {
  todos?: Todo[]
  busy?: boolean
  mutateAsync?: ReturnType<typeof vi.fn>
  mutationError?: Error | null
  queryError?: Error | null
  isFetching?: boolean
} = {}) {
  const notify = vi.fn()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: todos,
    isPending: false,
    isFetching,
    isError: queryError !== null,
    error: queryError,
    refetch: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: mutationError,
    reset: vi.fn(),
    mutateAsync,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(busy)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: todos,
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  return { notify }
}

it('completes an active task and congratulates the user', async () => {
  const user = userEvent.setup()
  const mutateAsync = vi
    .fn()
    .mockResolvedValue({ ...todoFixture, completed: true })
  const { notify } = mockLoadedPage({ mutateAsync })
  render(<TodosPage />)
  await user.click(
    screen.getByRole('button', { name: `Toggle ${todoFixture.title}` }),
  )
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith('Another task complete. Well done!'),
  )
  expect(mutateAsync).toHaveBeenCalledWith({
    id: todoFixture.id,
    input: { completed: true },
  })
})

it('marks a completed task as active and tells the user', async () => {
  const user = userEvent.setup()
  const done: Todo = { ...todoFixture, completed: true }
  const mutateAsync = vi.fn().mockResolvedValue(todoFixture)
  const { notify } = mockLoadedPage({ todos: [done], mutateAsync })
  render(<TodosPage />)
  await user.click(
    screen.getByRole('button', { name: `Toggle ${todoFixture.title}` }),
  )
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith('Task marked as active.'),
  )
  expect(mutateAsync).toHaveBeenCalledWith({
    id: todoFixture.id,
    input: { completed: false },
  })
})

it('does not notify when toggling a task fails', async () => {
  const user = userEvent.setup()
  const mutateAsync = vi.fn().mockRejectedValue(new Error('Could not save.'))
  const { notify } = mockLoadedPage({ mutateAsync })
  render(<TodosPage />)
  await user.click(
    screen.getByRole('button', { name: `Toggle ${todoFixture.title}` }),
  )
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
  expect(notify).not.toHaveBeenCalled()
})

it('ignores toggling while another task operation is busy', async () => {
  const user = userEvent.setup()
  const mutateAsync = vi.fn()
  const { notify } = mockLoadedPage({ busy: true, mutateAsync })
  render(<TodosPage />)
  await user.click(
    screen.getByRole('button', { name: `Toggle ${todoFixture.title}` }),
  )
  expect(mutateAsync).not.toHaveBeenCalled()
  expect(notify).not.toHaveBeenCalled()
})

it('disables creating a task while another task operation is busy', () => {
  mockLoadedPage({ busy: true })
  render(<TodosPage />)
  expect(screen.getByRole('button', { name: 'New task' })).toBeDisabled()
})

it('disables creating a task while the list is loading', () => {
  mockLoadedPage()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: undefined,
    isPending: true,
    isFetching: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTodosQuery>)
  render(<TodosPage />)
  expect(screen.getByRole('button', { name: 'New task' })).toBeDisabled()
  expect(
    screen.getByText(/has tasks false,\s+loading true, failed false/),
  ).toBeVisible()
})

it('opens the editor for a new task and notifies after saving', async () => {
  const user = userEvent.setup()
  const { notify } = mockLoadedPage()
  render(<TodosPage />)
  expect(screen.queryByRole('dialog', { name: 'Editor' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'New task' }))
  expect(screen.getByText('Editing: new task')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Save editor' }))
  expect(notify).toHaveBeenCalledWith('Changes saved.')
  expect(screen.queryByRole('dialog', { name: 'Editor' })).not.toBeInTheDocument()
})

it('opens the editor for the chosen task and closes it without notifying', async () => {
  const user = userEvent.setup()
  const { notify } = mockLoadedPage()
  render(<TodosPage />)
  await user.click(
    screen.getByRole('button', { name: `Edit ${todoFixture.title}` }),
  )
  expect(screen.getByText(`Editing: ${todoFixture.title}`)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Close editor' }))
  expect(screen.queryByRole('dialog', { name: 'Editor' })).not.toBeInTheDocument()
  expect(notify).not.toHaveBeenCalled()
})

it('confirms deleting the chosen task and notifies after deletion', async () => {
  const user = userEvent.setup()
  const { notify } = mockLoadedPage()
  render(<TodosPage />)
  expect(
    screen.queryByRole('dialog', { name: 'Delete confirmation' }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: `Delete ${todoFixture.title}` }),
  )
  expect(screen.getByText(`Deleting: ${todoFixture.title}`)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
  expect(notify).toHaveBeenCalledWith('Task deleted.')
  expect(
    screen.queryByRole('dialog', { name: 'Delete confirmation' }),
  ).not.toBeInTheDocument()
})

it('closes the delete confirmation without notifying', async () => {
  const user = userEvent.setup()
  const { notify } = mockLoadedPage()
  render(<TodosPage />)
  await user.click(
    screen.getByRole('button', { name: `Delete ${todoFixture.title}` }),
  )
  await user.click(screen.getByRole('button', { name: 'Close delete' }))
  expect(
    screen.queryByRole('dialog', { name: 'Delete confirmation' }),
  ).not.toBeInTheDocument()
  expect(notify).not.toHaveBeenCalled()
})

it('shows no alert when nothing failed', () => {
  mockLoadedPage()
  render(<TodosPage />)
  expect(screen.queryByTestId('alert')).not.toBeInTheDocument()
  expect(
    screen.getByText(/1 visible, has tasks true,\s+loading false, failed false/),
  ).toBeVisible()
})

it('prefers the toggle error over the query error in the alert', () => {
  mockLoadedPage({
    mutationError: new Error('Could not save the task.'),
    queryError: new Error('The server is unavailable.'),
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'Could not save the task.',
  )
  expect(screen.getByTestId('alert')).not.toHaveTextContent(
    'The server is unavailable.',
  )
})

it('disables retrying while the list is being refetched', () => {
  mockLoadedPage({
    queryError: new Error('The server is unavailable.'),
    isFetching: true,
  })
  render(<TodosPage />)
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
})

it('disables retrying while another task operation is busy', () => {
  mockLoadedPage({
    mutationError: new Error('Could not save the task.'),
    busy: true,
  })
  render(<TodosPage />)
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
})
