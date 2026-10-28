import { Archive, Plus } from 'lucide-react'
import { Button, Heading, Text } from '../../../design-system'

export function TodosHeader({
  disabled,
  archivableCount,
  onCreate,
  onArchiveCompleted,
}: {
  disabled: boolean
  archivableCount: number
  onCreate: () => void
  onArchiveCompleted: () => void
}) {
  return (
    <section className="row spread" aria-labelledby="page-title">
      <div className="stack compact">
        <Heading id="page-title">Tasks</Heading>
        <Text muted>Create, organize, and complete tasks.</Text>
      </div>
      <div className="row compact">
        {archivableCount > 0 && (
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={onArchiveCompleted}
          >
            <Archive size={18} aria-hidden="true" />
            Archive completed ({archivableCount})
          </Button>
        )}
        <Button disabled={disabled} onClick={onCreate}>
          <Plus size={18} aria-hidden="true" />
          New task
        </Button>
      </div>
    </section>
  )
}
