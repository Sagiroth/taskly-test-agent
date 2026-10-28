import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TodosHeader } from './TodosHeader'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

it('invokes creation when enabled and blocks it when disabled', async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn()
  const { rerender } = render(
    <TodosHeader
      disabled={false}
      archivableCount={0}
      onCreate={onCreate}
      onArchiveCompleted={vi.fn()}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Tasks' })).toBeVisible()
  expect(
    screen.getByText('Create, organize, and complete tasks.'),
  ).toBeVisible()
  const button = screen.getByRole('button', { name: 'New task' })
  await user.click(button)
  expect(onCreate).toHaveBeenCalledTimes(1)
  rerender(
    <TodosHeader
      disabled
      archivableCount={0}
      onCreate={onCreate}
      onArchiveCompleted={vi.fn()}
    />,
  )
  expect(button).toBeDisabled()
  await user.click(button)
  expect(onCreate).toHaveBeenCalledTimes(1)
})

it('does not offer archiving when there are no completed tasks', () => {
  render(
    <TodosHeader
      disabled={false}
      archivableCount={0}
      onCreate={vi.fn()}
      onArchiveCompleted={vi.fn()}
    />,
  )
  expect(
    screen.queryByRole('button', { name: /Archive completed/ }),
  ).not.toBeInTheDocument()
})

it.each([1, 2])(
  'offers archiving with the count of %i completed tasks in the accessible name',
  async (count) => {
    const user = userEvent.setup()
    const onArchiveCompleted = vi.fn()
    const onCreate = vi.fn()
    render(
      <TodosHeader
        disabled={false}
        archivableCount={count}
        onCreate={onCreate}
        onArchiveCompleted={onArchiveCompleted}
      />,
    )
    await user.click(
      screen.getByRole('button', { name: `Archive completed (${count})` }),
    )
    expect(onArchiveCompleted).toHaveBeenCalledTimes(1)
    expect(onCreate).not.toHaveBeenCalled()
  },
)

it('archives with the keyboard', async () => {
  const user = userEvent.setup()
  const onArchiveCompleted = vi.fn()
  render(
    <TodosHeader
      disabled={false}
      archivableCount={2}
      onCreate={vi.fn()}
      onArchiveCompleted={onArchiveCompleted}
    />,
  )
  await user.tab()
  expect(
    screen.getByRole('button', { name: 'Archive completed (2)' }),
  ).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(onArchiveCompleted).toHaveBeenCalledTimes(1)
})

it('blocks archiving while disabled', async () => {
  const user = userEvent.setup()
  const onArchiveCompleted = vi.fn()
  render(
    <TodosHeader
      disabled
      archivableCount={2}
      onCreate={vi.fn()}
      onArchiveCompleted={onArchiveCompleted}
    />,
  )
  const button = screen.getByRole('button', { name: 'Archive completed (2)' })
  expect(button).toBeDisabled()
  await user.click(button)
  expect(onArchiveCompleted).not.toHaveBeenCalled()
})
