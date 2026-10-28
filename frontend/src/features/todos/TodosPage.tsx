import { useState } from 'react'
import { Alert, Button } from '../../design-system'
import { SuccessNotice } from '../../components/SuccessNotice'
import { useNotice } from '../../hooks/useNotice'
import { DeleteTodoDialog } from './components/DeleteTodoDialog'
import { TodoEditor } from './components/TodoEditor'
import { TodoFilters } from './components/TodoFilters'
import { TodoList } from './components/TodoList'
import { TodosHeader } from './components/TodosHeader'
import { useArchiveCompletedMutation } from './hooks/useArchiveCompletedMutation'
import { useArchivedTodosQuery } from './hooks/useArchivedTodosQuery'
import { useRestoreTodoMutation } from './hooks/useRestoreTodoMutation'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import type { Filter, Todo } from './types'

export function TodosPage() {
  const todosQuery = useTodosQuery()
  const [showArchived, setShowArchived] = useState(false)
  const archivedQuery = useArchivedTodosQuery(showArchived)
  const activeTodos = todosQuery.data ?? []
  const todos = showArchived ? (archivedQuery.data ?? []) : activeTodos
  const filters = useTodoFilters(todos)
  const toggleTodo = useUpdateTodoMutation()
  const archiveCompleted = useArchiveCompletedMutation()
  const restoreTodo = useRestoreTodoMutation()
  const busy = useTodosBusy()
  const { message, notify } = useNotice()
  const [editor, setEditor] = useState<Todo | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Todo | null>(null)
  const listQuery = showArchived ? archivedQuery : todosQuery
  const error =
    toggleTodo.error ??
    archiveCompleted.error ??
    restoreTodo.error ??
    listQuery.error
  const archivableCount = activeTodos.filter((todo) => todo.completed).length

  function changeFilter(filter: Filter) {
    filters.setFilter(filter)
    setShowArchived(filter === 'archived')
  }

  async function toggle(todo: Todo) {
    if (busy) return
    try {
      const saved = await toggleTodo.mutateAsync({
        id: todo.id,
        input: { completed: !todo.completed },
      })
      notify(
        saved.completed
          ? 'Another task complete. Well done!'
          : 'Task marked as active.',
      )
    } catch {
      // Display the mutation error in the page alert.
    }
  }
  async function archive() {
    if (busy) return
    try {
      const { archived } = await archiveCompleted.mutateAsync()
      notify(`${archived} ${archived === 1 ? 'task' : 'tasks'} archived`)
    } catch {
      // Display the mutation error in the page alert.
    }
  }
  async function restore(todo: Todo) {
    if (busy) return
    try {
      await restoreTodo.mutateAsync(todo.id)
      notify('Task restored.')
    } catch {
      // Display the mutation error in the page alert.
    }
  }
  async function retry() {
    toggleTodo.reset()
    archiveCompleted.reset()
    restoreTodo.reset()
    await listQuery.refetch()
  }

  return (
    <>
      <main id="main" className="page-layout">
        <TodosHeader
          disabled={todosQuery.isPending || busy}
          archivableCount={archivableCount}
          onCreate={() => setEditor('new')}
          onArchiveCompleted={() => void archive()}
        />
        <TodoFilters
          filter={filters.filter}
          search={filters.search}
          sort={filters.sort}
          onFilterChange={changeFilter}
          onSearchChange={filters.setSearch}
          onSortChange={filters.setSort}
        />
        {error && (
          <Alert variant="warning">
            {error.message}
            <Button
              variant="secondary"
              disabled={listQuery.isFetching || busy}
              onClick={() => void retry()}
            >
              Try again
            </Button>
          </Alert>
        )}
        <TodoList
          todos={filters.visible}
          hasTodos={todos.length > 0}
          loading={listQuery.isPending}
          failed={listQuery.isError}
          busy={busy}
          onCreate={() => setEditor('new')}
          onToggle={(todo) => void toggle(todo)}
          onEdit={setEditor}
          onDelete={setDeleting}
          onRestore={showArchived ? (todo) => void restore(todo) : undefined}
        />
      </main>
      <SuccessNotice message={message} />
      {editor && (
        <TodoEditor
          todo={editor}
          busy={busy}
          onClose={() => setEditor(null)}
          onSaved={(notice) => {
            setEditor(null)
            notify(notice)
          }}
        />
      )}
      {deleting && (
        <DeleteTodoDialog
          todo={deleting}
          busy={busy}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            notify('Task deleted.')
          }}
        />
      )}
    </>
  )
}
