import { useMutation, useQueryClient } from '@tanstack/react-query'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'

export function useArchiveCompletedMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: todoKeys.archive,
    mutationFn: () => todosApi.archiveCompleted(),
    // Archiving moves tasks between the task list and the archive: reload both from the server.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  })
}
