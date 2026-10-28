import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNotice } from '../../hooks/useNotice'
import { todoFixture } from '../../test/todoFixture'
import { useArchiveCompletedMutation } from './hooks/useArchiveCompletedMutation'
import { useArchivedTodosQuery } from './hooks/useArchivedTodosQuery'
import { useRestoreTodoMutation } from './hooks/useRestoreTodoMutation'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import { TodosPage } from './TodosPage'
import type { Filter, Todo } from './types'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./hooks/useArchivedTodosQuery', () => ({
  useArchivedTodosQuery: vi.fn(),
}))
vi.mock('./hooks/useArchiveCompletedMutation', () => ({
  useArchiveCompletedMutation: vi.fn(),
}))
vi.mock('./hooks/useRestoreTodoMutation', () => ({
  useRestoreTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: ({
    disabled,
    archivableCount,
    onCreate,
    onArchiveCompleted,
  }: {
    disabled: boolean
    archivableCount: number
    onCreate: () => void
    onArchiveCompleted: () => void
  }) => (
    <header>
      <h1>Tasks</h1>
      {archivableCount > 0 && (
        <button disabled={disabled} onClick={onArchiveCompleted}>
          Archive completed ({archivableCount})
        </button>
      )}
      <button disabled={disabled} onClick={onCreate}>
        New task
      </button>
    </header>
  ),
}))
vi.mock('./components/TodoFilters', () => ({
  TodoFilters: ({
    onFilterChange,
  }: {
    onFilterChange: (filter: Filter) => void
  }) => (
    <div>
      <button onClick={() => onFilterChange('archived')}>Show archived</button>
      <button onClick={() => onFilterChange('completed')}>Show completed</button>
    </div>
  ),
}))
vi.mock('./components/TodoList', () => ({
  TodoList: ({
    todos,
    hasTodos,
    loading,
    failed,
    onToggle,
    onEdit,
    onDelete,
    onRestore,
  }: {
    todos: Todo[]
    hasTodos: boolean
    loading: boolean
    failed: boolean
    onToggle: (todo: Todo) => void
    onEdit: (todo: Todo) => void
    onDelete: (todo: Todo) => void
    onRestore?: (todo: Todo) => void
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
          {onRestore && (
            <button onClick={() => onRestore(todo)}>
              Restore {todo.title}
            </button>
          )}
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
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useArchivedTodosQuery).mockReturnValue({
    data: undefined,
    isPending: true,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useArchivedTodosQuery>)
  vi.mocked(useArchiveCompletedMutation).mockReturnValue({
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useArchiveCompletedMutation>)
  vi.mocked(useRestoreTodoMutation).mockReturnValue({
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useRestoreTodoMutation>)
})

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
  const setFilter = vi.fn()
  vi.mocked(useTodoFilters).mockImplementation((source) => ({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: source,
    setFilter,
    setSearch: vi.fn(),
    setSort: vi.fn(),
  }))
  return { notify, setFilter }
}

function mockArchivedQuery({
  todos = [],
  isPending = false,
  isFetching = false,
  error = null,
  refetch = vi.fn().mockResolvedValue(undefined),
}: {
  todos?: Todo[]
  isPending?: boolean
  isFetching?: boolean
  error?: Error | null
  refetch?: ReturnType<typeof vi.fn>
} = {}) {
  vi.mocked(useArchivedTodosQuery).mockReturnValue({
    data: isPending ? undefined : todos,
    isPending,
    isFetching,
    isError: error !== null,
    error,
    refetch,
  } as unknown as ReturnType<typeof useArchivedTodosQuery>)
  return { refetch }
}

function mockArchiveMutation(mutateAsync = vi.fn(), error: Error | null = null) {
  const reset = vi.fn()
  vi.mocked(useArchiveCompletedMutation).mockReturnValue({
    error,
    reset,
    mutateAsync,
  } as unknown as ReturnType<typeof useArchiveCompletedMutation>)
  return { mutateAsync, reset }
}

function mockRestoreMutation(mutateAsync = vi.fn(), error: Error | null = null) {
  const reset = vi.fn()
  vi.mocked(useRestoreTodoMutation).mockReturnValue({
    error,
    reset,
    mutateAsync,
  } as unknown as ReturnType<typeof useRestoreTodoMutation>)
  return { mutateAsync, reset }
}

const openTask: Todo = { ...todoFixture, id: 1, title: 'Open task' }
const doneTask: Todo = {
  ...todoFixture,
  id: 2,
  title: 'Done task',
  completed: true,
}
const otherDoneTask: Todo = {
  ...todoFixture,
  id: 3,
  title: 'Other done task',
  completed: true,
}
const archivedTask: Todo = {
  ...todoFixture,
  id: 4,
  title: 'Archived task',
  completed: true,
  archived: true,
}
const otherArchivedTask: Todo = {
  ...archivedTask,
  id: 5,
  title: 'Other archived task',
}

it('offers archiving with the number of completed tasks', () => {
  mockLoadedPage({ todos: [doneTask, openTask, otherDoneTask] })
  render(<TodosPage />)
  expect(
    screen.getByRole('button', { name: 'Archive completed (2)' }),
  ).toBeEnabled()
})

it('does not offer archiving when no task is completed', () => {
  mockLoadedPage({ todos: [openTask] })
  render(<TodosPage />)
  expect(
    screen.queryByRole('button', { name: /Archive completed/ }),
  ).not.toBeInTheDocument()
})

it('disables archiving while another task operation is busy', () => {
  mockLoadedPage({ todos: [doneTask], busy: true })
  render(<TodosPage />)
  expect(
    screen.getByRole('button', { name: 'Archive completed (1)' }),
  ).toBeDisabled()
})

it.each([
  [2, '2 tasks archived'],
  [1, '1 task archived'],
])(
  'archives completed tasks and confirms %i archived',
  async (archived, notice) => {
    const user = userEvent.setup()
    const { notify } = mockLoadedPage({
      todos: [doneTask, openTask, otherDoneTask],
    })
    const { mutateAsync } = mockArchiveMutation(
      vi.fn().mockResolvedValue({ archived }),
    )
    render(<TodosPage />)
    await user.click(
      screen.getByRole('button', { name: 'Archive completed (2)' }),
    )
    await waitFor(() => expect(notify).toHaveBeenCalledWith(notice))
    expect(mutateAsync).toHaveBeenCalledTimes(1)
  },
)

it('does not confirm archiving when it fails', async () => {
  const user = userEvent.setup()
  const { notify } = mockLoadedPage({ todos: [doneTask, openTask] })
  const { mutateAsync } = mockArchiveMutation(
    vi.fn().mockRejectedValue(new Error('Could not archive.')),
  )
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Archive completed (1)' }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
  expect(notify).not.toHaveBeenCalled()
})

it('shows the archive error and keeps the task list', () => {
  mockLoadedPage({ todos: [doneTask, openTask] })
  mockArchiveMutation(vi.fn(), new Error('Could not archive the tasks.'))
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'Could not archive the tasks.',
  )
  expect(
    screen.getByText(/2 visible, has tasks true,\s+loading false, failed false/),
  ).toBeVisible()
})

it('loads only the active task list by default without restore actions', () => {
  mockLoadedPage({ todos: [openTask] })
  render(<TodosPage />)
  expect(useArchivedTodosQuery).toHaveBeenLastCalledWith(false)
  expect(
    screen.getByRole('button', { name: 'Toggle Open task' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Restore Open task' }),
  ).not.toBeInTheDocument()
})

it('shows only the archived tasks with restore actions when selecting Archived', async () => {
  const user = userEvent.setup()
  const { setFilter } = mockLoadedPage({ todos: [openTask, doneTask] })
  mockArchivedQuery({ todos: [archivedTask, otherArchivedTask] })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Show archived' }))
  expect(setFilter).toHaveBeenCalledWith('archived')
  expect(useArchivedTodosQuery).toHaveBeenLastCalledWith(true)
  expect(useTodoFilters).toHaveBeenLastCalledWith([
    archivedTask,
    otherArchivedTask,
  ])
  expect(
    screen.getByText(/2 visible, has tasks true,\s+loading false, failed false/),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Restore Archived task' }),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Restore Other archived task' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Toggle Open task' }),
  ).not.toBeInTheDocument()
})

it('keeps counting archivable tasks from the active list in the archived view', async () => {
  const user = userEvent.setup()
  mockLoadedPage({ todos: [openTask, doneTask] })
  mockArchivedQuery({ todos: [archivedTask] })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Show archived' }))
  expect(
    screen.getByRole('button', { name: 'Archive completed (1)' }),
  ).toBeVisible()
})

it('returns to the active task list when leaving the archived view', async () => {
  const user = userEvent.setup()
  mockLoadedPage({ todos: [openTask] })
  mockArchivedQuery({ todos: [archivedTask] })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Show archived' }))
  await user.click(screen.getByRole('button', { name: 'Show completed' }))
  expect(useArchivedTodosQuery).toHaveBeenLastCalledWith(false)
  expect(useTodoFilters).toHaveBeenLastCalledWith([openTask])
  expect(
    screen.queryByRole('button', { name: 'Restore Archived task' }),
  ).not.toBeInTheDocument()
})

it('shows the archived list as loading while archived tasks are fetched', async () => {
  const user = userEvent.setup()
  mockLoadedPage({ todos: [openTask] })
  mockArchivedQuery({ isPending: true, isFetching: true })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Show archived' }))
  expect(
    screen.getByText(/0 visible, has tasks false,\s+loading true, failed false/),
  ).toBeVisible()
})

it('restores an archived task and tells the user', async () => {
  const user = userEvent.setup()
  const { notify } = mockLoadedPage({ todos: [openTask] })
  mockArchivedQuery({ todos: [archivedTask] })
  const { mutateAsync } = mockRestoreMutation(
    vi.fn().mockResolvedValue({ ...archivedTask, archived: false }),
  )
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Show archived' }))
  await user.click(
    screen.getByRole('button', { name: 'Restore Archived task' }),
  )
  await waitFor(() => expect(notify).toHaveBeenCalledWith('Task restored.'))
  expect(mutateAsync).toHaveBeenCalledExactlyOnceWith(archivedTask.id)
})

it('does not notify when restoring fails', async () => {
  const user = userEvent.setup()
  const { notify } = mockLoadedPage({ todos: [openTask] })
  mockArchivedQuery({ todos: [archivedTask] })
  const { mutateAsync } = mockRestoreMutation(
    vi.fn().mockRejectedValue(new Error('Task not found.')),
  )
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Show archived' }))
  await user.click(
    screen.getByRole('button', { name: 'Restore Archived task' }),
  )
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
  expect(notify).not.toHaveBeenCalled()
})

it('shows the restore error in the alert', () => {
  mockLoadedPage({ todos: [openTask] })
  mockRestoreMutation(vi.fn(), new Error('Could not restore the task.'))
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'Could not restore the task.',
  )
})

it('ignores restoring while another task operation is busy', async () => {
  const user = userEvent.setup()
  const { notify } = mockLoadedPage({ todos: [openTask], busy: true })
  mockArchivedQuery({ todos: [archivedTask] })
  const { mutateAsync } = mockRestoreMutation()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Show archived' }))
  await user.click(
    screen.getByRole('button', { name: 'Restore Archived task' }),
  )
  expect(mutateAsync).not.toHaveBeenCalled()
  expect(notify).not.toHaveBeenCalled()
})

it('shows an archived list failure and retries the archived query after resetting mutation errors', async () => {
  const user = userEvent.setup()
  mockLoadedPage({ todos: [openTask] })
  const { refetch } = mockArchivedQuery({
    error: new Error('Archived tasks are unavailable.'),
  })
  const archive = mockArchiveMutation()
  const restore = mockRestoreMutation()
  render(<TodosPage />)
  expect(screen.queryByTestId('alert')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Show archived' }))
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'Archived tasks are unavailable.',
  )
  expect(
    screen.getByText(/failed true/),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  expect(vi.mocked(useTodosQuery).mock.results[0].value.refetch).not.toHaveBeenCalled()
  expect(archive.reset).toHaveBeenCalledTimes(1)
  expect(restore.reset).toHaveBeenCalledTimes(1)
  expect(archive.reset.mock.invocationCallOrder[0]).toBeLessThan(
    refetch.mock.invocationCallOrder[0],
  )
  expect(restore.reset.mock.invocationCallOrder[0]).toBeLessThan(
    refetch.mock.invocationCallOrder[0],
  )
})

it('disables retrying while the archived list is being refetched', async () => {
  const user = userEvent.setup()
  mockLoadedPage({ todos: [openTask] })
  mockArchivedQuery({
    error: new Error('Archived tasks are unavailable.'),
    isFetching: true,
  })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Show archived' }))
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
})

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
