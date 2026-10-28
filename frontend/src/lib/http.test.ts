import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { request } from './http'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('prefixes the path with /api and returns the parsed JSON body', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse([{ id: 1 }]))
  await expect(request('/todos')).resolves.toEqual([{ id: 1 }])
  expect(fetch).toHaveBeenCalledWith('/api/todos', {
    headers: { 'Content-Type': 'application/json' },
  })
})

it('forwards method, body and extra headers along with the JSON content type', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: 2 }, 201))
  await request('/todos', {
    method: 'POST',
    body: '{"title":"A"}',
    headers: { 'X-Trace': 'abc' },
  })
  expect(fetch).toHaveBeenCalledWith('/api/todos', {
    method: 'POST',
    body: '{"title":"A"}',
    headers: { 'Content-Type': 'application/json', 'X-Trace': 'abc' },
  })
})

it('returns undefined for a 204 response without reading the body', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
  await expect(request('/todos/1', { method: 'DELETE' })).resolves.toBe(
    undefined,
  )
})

it('throws a task details message for a 422 response regardless of the body detail', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse({ detail: 'title too long' }, 422),
  )
  await expect(request('/todos')).rejects.toThrow(
    'Check the task details: title up to 120 characters, description up to 2000 characters, and a valid due date.',
  )
})

it('throws the server detail for other error responses', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse({ detail: 'Task not found' }, 404),
  )
  await expect(request('/todos/99')).rejects.toThrow('Task not found')
})

it.each([
  ['a non-string detail', () => jsonResponse({ detail: [{ msg: 'x' }] }, 500)],
  ['a body without detail', () => jsonResponse({}, 500)],
  [
    'a body that is not JSON',
    () => new Response('Internal Server Error', { status: 500 }),
  ],
])(
  'throws a generic message for an error response with %s',
  async (_, makeResponse) => {
    vi.mocked(fetch).mockResolvedValue(makeResponse())
    await expect(request('/todos')).rejects.toThrow(
      'The operation failed. Please try again.',
    )
  },
)

it('throws a connection message when the network request fails', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
  await expect(request('/todos')).rejects.toThrow(
    'Cannot connect to the server. Please try again.',
  )
})

it('rethrows the original error when the request was aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  const abortError = new DOMException('Aborted', 'AbortError')
  vi.mocked(fetch).mockRejectedValue(abortError)
  await expect(
    request('/todos', { signal: controller.signal }),
  ).rejects.toBe(abortError)
})
