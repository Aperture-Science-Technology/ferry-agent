import type { Device, LibraryItem, DeliveryJob } from "@/lib/types";
export const books: LibraryItem[] = Array.from({ length: 27 }, (_, i) => ({
  id: String(i), title: i === 0 ? "Un très long titre de livre pour tester les petits écrans" : `Livre ${i + 1}`, author: "Camille Durand", language: "fr", original_format: "epub", added_at: "2026-10-01T00:00:00Z", source_ref: null, source_id: null, cover_url: null, description: null, publisher: null, published_year: null, isbn: null, page_count: null, size_bytes: null,
}));
export const devices: Device[] = [{ id: "reader", name: "Ma liseuse de voyage", brand: "kobo", model: null, delivery_tier: "C", conversion_profile: null, cloud_linked: true, cloud_provider: "dropbox", last_synced_at: null }];
export const jobs: DeliveryJob[] = [{ id: "job", device_id: "reader", device_label: devices[0].name, item_title: books[0].title, status: "delivered", terminal: true, error: null, method: "cloud", created_at: "2026-10-01T00:00:00Z", delivered_at: "2026-10-01T00:01:00Z" }];
export class ApiError extends Error { status = 500; }
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, location.origin);
  let result: unknown = [];
  if (path.includes("/methods")) result = [{ method: "cloud", available: true }];
  else if (path.includes("/users/me")) result = { default_format: "epub" };
  else if (path.includes("/deliveries")) result = init?.method === "POST" ? { ...jobs[0], status: "queued" } : jobs;
  else if (path.includes("/books") && init?.method !== "DELETE") result = { items: books.filter(book => book.title.toLowerCase().includes((url.searchParams.get("q") ?? "").toLowerCase())).slice(0, 8), total: 27, page: 1, limit: 8 };
  return result as T;
}
export function useApiClient() { return { call }; }
