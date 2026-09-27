export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!res.ok) {
    const body: { error?: string } | null = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? res.statusText)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}
