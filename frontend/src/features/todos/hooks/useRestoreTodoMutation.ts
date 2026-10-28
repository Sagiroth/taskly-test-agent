import { useMutation, useQueryClient } from '@tanstack/react-query'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'

export function useRestoreTodoMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: todoKeys.restore,
    mutationFn: (id: number) => todosApi.restore(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  })
}
