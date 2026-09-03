"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Client-side helper for calling the core API through the same-origin
 * `/api/v1` proxy (see next.config.ts rewrites), attaching the Clerk
 * session token as a Bearer token. `path` must start with `/api/v1`.
 */
export function useApiClient() {
  const { getToken } = useAuth();

  const call = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      const isFormData = init?.body instanceof FormData;
      const res = await fetch(path, {
        ...init,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          ...init?.headers,
        },
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ApiError(res.status, detail || `${res.status} ${res.statusText}`);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },
    [getToken]
  );

  return { call };
}
