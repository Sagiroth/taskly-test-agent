import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useCreateTodoMutation } from '../hooks/useCreateTodoMutation'
import { useUpdateTodoMutation } from '../hooks/useUpdateTodoMutation'
import type { TodoInput } from '../types'
import { TodoEditor } from './TodoEditor'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('../hooks/useCreateTodoMutation', () => ({
  useCreateTodoMutation: vi.fn(),
}))
vi.mock('../hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./TodoForm', () => ({
  TodoForm: ({
    initial,
    busy,
    error,
    onSubmit,
    onCancel,
  }: {
    initial?: TodoInput
    busy: boolean
    error: string | null
    onSubmit: (input: TodoInput) => Promise<void>
    onCancel: () => void
  }) => (
    <div>
      <p>Initial title: {initial ? initial.title : 'none'}</p>
      {error && <p>Form error: {error}</p>}
      <button disabled={busy} onClick={() => void onSubmit(todoFixture)}>
        Submit form
      </button>
      <button onClick={onCancel}>Cancel form</button>
    </div>
  ),
}))
beforeEach(() => vi.clearAllMocks())

it('creates a new task and reports a successful save', async () => {
  const user = userEvent.setup()
  const create = vi.fn().mockResolvedValue(todoFixture)
  const update = vi.fn()
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: create,
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: update,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  const onSaved = vi.fn()
  render(
    <TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={onSaved} />,
  )
  expect(screen.getByRole('dialog', { name: 'New task' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Submit form' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('New task added.'))
  expect(create).toHaveBeenCalledWith(todoFixture)
  expect(update).not.toHaveBeenCalled()
})

it('opens an empty form for a new task', () => {
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  render(
    <TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={vi.fn()} />,
  )
  expect(screen.getByText('Initial title: none')).toBeVisible()
})

it('updates an existing task by id and reports the saved changes', async () => {
  const user = userEvent.setup()
  const create = vi.fn()
  const update = vi.fn().mockResolvedValue(todoFixture)
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: create,
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: update,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  const onSaved = vi.fn()
  const task = { ...todoFixture, id: 12, title: 'Review the plan' }
  render(
    <TodoEditor todo={task} busy={false} onClose={vi.fn()} onSaved={onSaved} />,
  )
  expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeVisible()
  expect(screen.getByText('Initial title: Review the plan')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Submit form' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Changes saved.'))
  expect(update).toHaveBeenCalledWith({ id: 12, input: todoFixture })
  expect(create).not.toHaveBeenCalled()
})

it('does not report a save when the request fails', async () => {
  const user = userEvent.setup()
  const update = vi.fn().mockRejectedValue(new Error('Could not save.'))
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: update,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  const onSaved = vi.fn()
  const onClose = vi.fn()
  render(
    <TodoEditor
      todo={todoFixture}
      busy={false}
      onClose={onClose}
      onSaved={onSaved}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Submit form' }))
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
  expect(onSaved).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeVisible()
})

it('passes the error of the update mutation to the form when editing', () => {
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: new Error('Create failed.'),
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: new Error('Update failed.'),
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  render(
    <TodoEditor
      todo={todoFixture}
      busy={false}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  )
  expect(screen.getByText('Form error: Update failed.')).toBeVisible()
  expect(screen.queryByText('Form error: Create failed.')).not.toBeInTheDocument()
})

it('passes the error of the create mutation to the form for a new task', () => {
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: new Error('Create failed.'),
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: new Error('Update failed.'),
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  render(
    <TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={vi.fn()} />,
  )
  expect(screen.getByText('Form error: Create failed.')).toBeVisible()
  expect(screen.queryByText('Form error: Update failed.')).not.toBeInTheDocument()
})

it('disables saving while the mutation is pending', () => {
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: true,
    error: null,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  render(
    <TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={vi.fn()} />,
  )
  expect(screen.getByRole('button', { name: 'Submit form' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
})

it('disables saving while another task operation is busy', () => {
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  render(
    <TodoEditor
      todo={todoFixture}
      busy
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'Submit form' })).toBeDisabled()
})

it('closes the editor when the form is cancelled', async () => {
  const user = userEvent.setup()
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(
    <TodoEditor todo="new" busy={false} onClose={onClose} onSaved={onSaved} />,
  )
  await user.click(screen.getByRole('button', { name: 'Cancel form' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onSaved).not.toHaveBeenCalled()
})
