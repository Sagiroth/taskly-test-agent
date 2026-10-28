import { useQuery } from '@tanstack/react-query'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'

export function useArchivedTodosQuery(enabled: boolean) {
  return useQuery({
    queryKey: todoKeys.archived,
    queryFn: ({ signal }) => todosApi.listArchived(signal),
    enabled,
  })
}
