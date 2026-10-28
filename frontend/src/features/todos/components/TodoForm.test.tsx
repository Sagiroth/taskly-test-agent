import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TodoForm } from './TodoForm'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

describe('TodoForm', () => {
  it('rejects a whitespace-only title without submitting', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), '   ')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(screen.getByText('Enter a task title.')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed values and the selected priority', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), '  Prepare a demo  ')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Prepare a demo',
      description: '',
      priority: 'high',
      due_date: null,
      completed: false,
    })
  })

  it('prefills the fields from an existing task and submits its changes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        initial={{
          title: 'Prepare a demo',
          description: 'Slides',
          priority: 'low',
          due_date: '2026-11-02',
          completed: true,
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    expect(screen.getByLabelText(/Task title/)).toHaveValue('Prepare a demo')
    expect(screen.getByLabelText(/Description/)).toHaveValue('Slides')
    expect(screen.getByLabelText('Priority')).toHaveValue('low')
    expect(screen.getByLabelText('Due date (optional)')).toHaveValue(
      '2026-11-02',
    )
    await user.type(screen.getByLabelText(/Description/), ' and notes  ')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Prepare a demo',
      description: 'Slides and notes',
      priority: 'low',
      due_date: '2026-11-02',
      completed: true,
    })
  })

  it('submits a chosen due date', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), 'Prepare a demo')
    await user.type(screen.getByLabelText('Due date (optional)'), '2026-11-02')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Prepare a demo',
      description: '',
      priority: 'medium',
      due_date: '2026-11-02',
      completed: false,
    })
  })

  it('sends a cleared due date as null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        initial={{
          title: 'Prepare a demo',
          description: '',
          priority: 'medium',
          due_date: '2026-11-02',
          completed: false,
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.clear(screen.getByLabelText('Due date (optional)'))
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Prepare a demo',
      description: '',
      priority: 'medium',
      due_date: null,
      completed: false,
    })
  })

  it('rejects a description longer than 2000 characters without submitting', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <TodoForm
        initial={{
          title: 'Prepare a demo',
          description: 'a'.repeat(2001),
          priority: 'medium',
          due_date: null,
          completed: false,
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(
      screen.getByText('The description must be at most 2000 characters.'),
    ).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('clears a validation error after a corrected submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(screen.getByText('Enter a task title.')).toBeVisible()
    await user.type(screen.getByLabelText(/Task title/), 'Prepare a demo')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(screen.queryByText('Enter a task title.')).not.toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows a server error passed by the parent', () => {
    render(
      <TodoForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        busy={false}
        error="The server is unavailable."
      />,
    )
    expect(screen.getByTestId('alert')).toHaveTextContent(
      'The server is unavailable.',
    )
  })

  it('cancels without submitting', async () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        busy={false}
        error={null}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables the fields and actions while saving', () => {
    render(
      <TodoForm onSubmit={vi.fn()} onCancel={vi.fn()} busy error={null} />,
    )
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText(/Task title/)).toBeDisabled()
    expect(screen.queryByTestId('alert')).not.toBeInTheDocument()
  })
})
