import { auth } from "@clerk/nextjs/server";

const BACKEND_BASE =
  process.env.BACKEND_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_BACKEND_BASE ??
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Fetch the core API from a server component/action, forwarding the
 * caller's Clerk session token as a Bearer token. `path` must start with
 * `/api/v1`.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken();

  const isFormData = init?.body instanceof FormData;
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(res.status, detail || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Same as `apiFetch`, but returns `null` instead of throwing. Useful for
 * server components rendering optional data from endpoints that may not be
 * deployed yet, so a missing route degrades to an empty state instead of a
 * broken page.
 */
export async function safeApiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await apiFetch<T>(path, init);
  } catch {
    return null;
  }
}
