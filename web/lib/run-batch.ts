/** Every item settles independently; at most three requests are in flight. */
export async function runBatch<T, R>(items: readonly T[], action: (item: T) => Promise<R>, onSettled?: (completed: number) => void) {
  const results: ({ item: T; ok: true; value: R } | { item: T; ok: false })[] = new Array(items.length);
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      try { results[index] = { item, ok: true, value: await action(item) }; }
      catch { results[index] = { item, ok: false }; }
      onSettled?.(++completed);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, worker));
  return results;
}
