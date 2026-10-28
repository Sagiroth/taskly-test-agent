export const todoKeys = {
  all: ['todos'] as const,
  list: ['todos', 'list'] as const,
  archived: ['todos', 'archived'] as const,
  archive: ['todos', 'archive'] as const,
  restore: ['todos', 'restore'] as const,
  create: ['todos', 'create'] as const,
  update: ['todos', 'update'] as const,
  delete: ['todos', 'delete'] as const,
}
