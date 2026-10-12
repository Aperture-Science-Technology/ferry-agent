import { useSyncExternalStore } from "react";
function subscribe(listener: () => void) { window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); }
function push(href: string) { window.history.pushState(null, "", href); window.dispatchEvent(new PopStateEvent("popstate")); }
export function usePathname() { return useSyncExternalStore(subscribe, () => window.location.pathname); }
export function useRouter() { return { push, replace: push, refresh: () => {}, prefetch: () => {} }; }
export function Link({ href, ...props }: React.ComponentProps<"a">) { return <a href={href} {...props} onClick={event => { event.preventDefault(); push(href ?? "/"); }} />; }
