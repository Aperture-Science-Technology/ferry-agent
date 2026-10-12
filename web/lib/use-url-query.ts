"use client";

import { useSyncExternalStore } from "react";

const CHANGE = "ferry-query-change";
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(CHANGE, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(CHANGE, listener);
  };
}
export function useUrlQuery() {
  const query = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  return new URLSearchParams(query);
}
export function updateUrlQuery(values: Record<string, string | null>, resetKeys: string[] = []) {
  const params = new URLSearchParams(window.location.search);
  resetKeys.forEach(key => params.delete(key));
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === "" || (value === "all" && ["fmt", "src", "status", "brand", "cloud"].includes(key))) params.delete(key);
    else params.set(key, value);
  }
  const search = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
  window.dispatchEvent(new Event(CHANGE));
}
export function queryPage(params: URLSearchParams) {
  const value = Number(params.get("page") ?? 1);
  return Number.isSafeInteger(value) && value > 0 && value <= 100000 ? value : 1;
}
