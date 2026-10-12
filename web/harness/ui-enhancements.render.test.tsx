import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "@/components/app/filter-bar";
import { CommandPalette } from "@/components/app/command-palette";
import { Onboarding } from "@/components/app/onboarding";
import { StorageQuota } from "@/components/app/settings/storage-quota";
import { LibraryView } from "@/components/app/library/library-view";
import { BulkActions } from "@/components/app/library/bulk-actions";
import { DevicesView } from "@/components/app/devices/devices-view";
import { GatewaysView } from "@/components/app/gateways/gateways-view";
import { DeliveriesView } from "@/components/app/deliveries/deliveries-view";
import { runBatch } from "@/lib/run-batch";
import { updateUrlQuery } from "@/lib/use-url-query";
import type { Device, LibraryItem, DeliveryJob } from "@/lib/types";
import fr from "@/messages/fr.json";
import en from "@/messages/en.json";

const call = vi.fn();
const push = vi.fn();
vi.mock("@/lib/api-client", () => ({ useApiClient: () => ({ call }), ApiError: class extends Error {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
  Link: ({ children, href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("motion/react", () => ({ motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }, useReducedMotion: () => true }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ getToken: async () => null }) }));
const wrap = (children: React.ReactNode, locale = "fr") => render(<NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>{children}</NextIntlClientProvider>);
function book(id: string): LibraryItem {
  return { id, title: `Livre ${id}`, author: "Auteur", language: "fr", original_format: "epub", added_at: "2026-01-01T00:00:00Z", source_ref: null, source_id: null, cover_url: null, description: null, publisher: null, published_year: null, isbn: null, page_count: null, size_bytes: null };
}
const device: Device = { id: "reader", name: "Ma liseuse", brand: "kobo", model: null, delivery_tier: "C", conversion_profile: null, cloud_linked: true, cloud_provider: "dropbox", last_synced_at: null };
const job: DeliveryJob = { id: "job", device_id: "reader", device_label: "Ma liseuse", item_title: "Été", status: "delivered", method: "cloud", terminal: true, error: null, created_at: "2026-10-01T00:00:00Z", delivered_at: "2026-10-01T00:01:00Z" };
beforeEach(() => {
  call.mockReset().mockResolvedValue([]); push.mockReset();
  window.history.replaceState(null, "", "/fr/app/bibliotheque");
  localStorage.clear();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
});
afterEach(() => { Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 }); });

describe("unified filters", () => {
  it.each([320, 390])("puts filters in a Sheet at %i px and permits individual removal", async width => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const change = vi.fn();
    wrap(<FilterBar search={{ label: "Recherche", value: "été" }} count={0} onChange={change} onReset={vi.fn()}
      fields={[{ key: "lang", label: "Langue", value: "fr", defaultValue: "", kind: "text" }]} />);
    expect(screen.queryByRole("textbox", { name: "Langue" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Aucun résultat");
    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre : Recherche" }));
    expect(change).toHaveBeenLastCalledWith({ q: null });
    fireEvent.click(screen.getByRole("button", { name: "Filtres et tri" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Langue" }), { target: { value: "en" } });
    expect(change).toHaveBeenLastCalledWith({ lang: "en" });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("restores device criteria, clears one chip, sorts rows and resets the URL", async () => {
    window.history.replaceState(null, "", "/fr/app/appareils?brand=kobo&cloud=linked&keep=1");
    wrap(<DevicesView title="Liseuses" description="" initialDevices={[device, { ...device, id: "b", name: "Autre", brand: "kindle", cloud_linked: false }]} devicesUnavailable={false} />);
    expect(within(screen.getByTestId("devices-rows")).getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre : Marque" }));
    expect(new URLSearchParams(window.location.search).has("brand")).toBe(false);
    expect(new URLSearchParams(window.location.search).get("cloud")).toBe("linked");
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    expect(within(screen.getByTestId("devices-rows")).getAllByRole("listitem")).toHaveLength(2);
    expect(window.location.search).toBe("?keep=1");
    fireEvent.click(screen.getByRole("button", { name: /Trier par Marque/ }));
    expect(new URLSearchParams(window.location.search).get("sort")).toBe("brand");
    fireEvent.change(screen.getByRole("textbox", { name: "Rechercher une liseuse" }), { target: { value: "absent" } });
    expect(screen.getByText("Aucune liseuse ne correspond")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Réinitialiser" }).length).toBeGreaterThan(0);
  });

  it("replays deliveries URL and changes order without altering delivery states", async () => {
    window.history.replaceState(null, "", "/fr/app/livraisons?status=delivered&device_id=reader&q=Été&sort=date&dir=asc");
    const older = { ...job, id: "older", created_at: "2026-09-01T00:00:00Z", item_title: "Été ancien" };
    call.mockResolvedValue([job, older]);
    wrap(<DeliveriesView title="Livraisons" description="" initialDeliveries={[job, older]} initialDevices={[device]} deliveriesUnavailable={false} />);
    const rows = within(screen.getByTestId("deliveries-status-rows")).getAllByRole("listitem");
    expect(rows[0].textContent).toContain("Été ancien");
    await waitFor(() => expect(call).toHaveBeenCalled());
    const url = new URL(call.mock.calls[0][0], "https://example.test");
    expect(url.searchParams.get("status")).toBe("delivered");
    expect(url.searchParams.get("device_id")).toBe("reader");
    fireEvent.click(screen.getByRole("button", { name: /Trier par Date/ }));
    expect(within(screen.getByTestId("deliveries-status-rows")).getAllByRole("listitem")[0].textContent).not.toContain("Été ancien");
  });

  it("keeps pagination in the library URL and only selects the current page", async () => {
    window.history.replaceState(null, "", "/fr/app/bibliotheque?mode=mine&page=2");
    wrap(<LibraryView title="Livres" description="" initialItems={Array.from({ length: 26 }, (_, index) => book(String(index)))} itemsUnavailable={false} itemsPartial={false} devices={[]} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    fireEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner sur cette page" }));
    expect(screen.getByText("2 livres sélectionnés")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: fr.library.paginationPrevious }));
    expect(new URLSearchParams(window.location.search).get("page")).toBe("1");
    expect(screen.getByRole("checkbox", { name: "Tout sélectionner sur cette page" }).getAttribute("aria-checked")).toBe("false");
    act(() => { window.history.replaceState(null, "", "?mode=mine&page=2"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(screen.getByRole("checkbox", { name: "Tout sélectionner sur cette page" }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("batch actions", () => {
  it("bounds concurrency to three and keeps partial failures in its result", async () => {
    let active = 0; let peak = 0;
    const releases: (() => void)[] = [];
    const running = runBatch([0, 1, 2, 3, 4], async value => {
      active++; peak = Math.max(peak, active);
      await new Promise<void>(resolve => releases.push(resolve)); active--;
      if (value === 1) throw new Error("offline");
      return value * 2;
    });
    expect(active).toBe(3);
    releases.splice(0).forEach(release => release());
    await act(async () => { await Promise.resolve(); });
    expect(active).toBe(2);
    releases.splice(0).forEach(release => release());
    const result = await running;
    expect(peak).toBe(3);
    expect(result.map(entry => entry.ok)).toEqual([true, false, true, true, true]);
    expect(result[4]).toEqual({ item: 4, ok: true, value: 8 });
  });

  it("names the delete count and retains failed books", async () => {
    call.mockImplementation(async (path: string) => { if (path.endsWith("/2")) throw new Error("offline"); });
    wrap(<LibraryView title="Livres" description="" initialItems={[book("1"), book("2")]} itemsUnavailable={false} itemsPartial={false} devices={[]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner sur cette page" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la sélection" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Supprimer 2 livres ?")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Supprimer la sélection" }));
    await screen.findByText("1 livre supprimé · 1 échec.");
    expect(screen.getByText("1 livre sélectionné")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Sélectionner Livre 1" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Sélectionner Livre 2" })).toBeTruthy();
  });

  it("keeps the summary after deleting the last book", async () => {
    call.mockResolvedValue(undefined);
    wrap(<LibraryView title="Livres" description="" initialItems={[book("1")]} itemsUnavailable={false} itemsPartial={false} devices={[]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner sur cette page" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la sélection" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer la sélection" }));
    expect(await screen.findByText("1 livre supprimé · 0 échec.")).toBeTruthy();
    expect(screen.getByText(fr.library.emptyTitle)).toBeTruthy();
  });

  it("uses one reader and format for the batch and reports failed job responses", async () => {
    call.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.endsWith("/methods")) return [{ method: "cloud", available: true }];
      if (path.endsWith("/me")) return { default_format: "epub" };
      const payload = JSON.parse(String(init?.body));
      return { ...job, status: payload.library_item_id === "2" ? "failed" : "queued" };
    });
    wrap(<BulkActions items={[book("1"), book("2")]} devices={[device]} onDeleted={vi.fn()} onFinished={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Livrer la sélection" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("combobox", { name: fr.deliverDialog.device }));
    fireEvent.click(await screen.findByRole("option", { name: /Ma liseuse/ }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: fr.deliverDialog.submit })).toHaveProperty("disabled", false));
    fireEvent.click(within(dialog).getByRole("button", { name: fr.deliverDialog.submit }));
    expect(await screen.findByText(/1 demande d’envoi acceptée · 1 échec/)).toBeTruthy();
    expect(screen.getByText("Livre 2")).toBeTruthy();
    const payloads = call.mock.calls.filter(([path]) => path === "/api/v1/deliveries").map(([, init]) => JSON.parse(init.body));
    expect(payloads).toEqual(["1", "2"].map(id => ({ library_item_id: id, device_id: "reader", format: "epub", method: "cloud" })));
  });
});

describe("command palette", () => {
  it.each(["ctrlKey", "metaKey"] as const)("opens with %s, navigates by arrows and Enter", async modifier => {
    wrap(<CommandPalette />);
    const trigger = screen.getByRole("button", { name: "Rechercher et naviguer" }); trigger.focus();
    fireEvent.keyDown(document, { key: "k", [modifier]: true });
    expect((await screen.findByRole("dialog")).getAttribute("aria-modal")).toBe("true");
    const input = screen.getByRole("combobox");
    await waitFor(() => expect(document.activeElement).toBe(input));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { selected: true }).textContent).toBe("Bibliothèque");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/app/bibliotheque");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("searches books and opens the matching detail; Escape restores the shortcut origin", async () => {
    call.mockResolvedValue({ items: [book("123")], total: 1, page: 1, limit: 8 });
    wrap(<><ButtonForFocus /><CommandPalette /></>);
    const origin = screen.getByRole("button", { name: "Origine" }); origin.focus();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "Livre" } });
    const option = await screen.findByRole("option", { name: "Livre 123 — Auteur" });
    fireEvent.click(option);
    expect(push).toHaveBeenCalledWith("/app/bibliotheque?mode=mine&book=123");
    await waitFor(() => expect(document.activeElement).toBe(origin));
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    await screen.findByRole("combobox");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(origin);
  });

  it.each([320, 390])("renders the empty palette at %i px and offers recovery after a search error", async width => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    call.mockResolvedValue({ items: [], total: 0 });
    wrap(<CommandPalette />);
    fireEvent.click(screen.getByRole("button", { name: "Rechercher et naviguer" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzzz" } });
    expect(await screen.findByText(/Aucun résultat. Essayez/)).toBeTruthy();
    call.mockRejectedValue(new Error("offline"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "autre" } });
    expect(await screen.findByRole("alert")).toBeTruthy();
    call.mockResolvedValue({ items: [book("a")], total: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("option", { name: "Livre a — Auteur" })).toBeTruthy();
  });
});
function ButtonForFocus() { return <button>Origine</button>; }

describe("command destinations", () => {
  it("opens book details from a palette URL and removes the book parameter on close", async () => {
    window.history.replaceState(null, "", "/fr/app/bibliotheque?mode=mine&book=1");
    wrap(<LibraryView title="Livres" description="" initialItems={[book("1")]} itemsUnavailable={false} itemsPartial={false} devices={[]} />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Livre 1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Fermer" }));
    expect(new URLSearchParams(window.location.search).has("book")).toBe(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("opens the existing new-reader dialog from its quick-action URL", async () => {
    window.history.replaceState(null, "", "/fr/app/appareils?action=new");
    wrap(<DevicesView title="Liseuses" description="" initialDevices={[]} devicesUnavailable={false} />);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(call).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Fermer" }));
    expect(new URLSearchParams(window.location.search).has("action")).toBe(false);
  });
  it("opens book import directly from its quick-action URL", () => {
    window.history.replaceState(null, "", "/fr/app/bibliotheque?mode=sources&action=import");
    wrap(<LibraryView title="Livres" description="" initialItems={[]} itemsUnavailable={false} itemsPartial={false} devices={[]} />);
    expect(screen.getByText(fr.library.uploadHelp)).toBeTruthy();
    expect(call).not.toHaveBeenCalled();
  });
  it("offers creation when code regeneration has no Gateway to target", async () => {
    window.history.replaceState(null, "", "/fr/app/gateways?action=regenerate");
    wrap(<GatewaysView title="Gateway" description="" initialGateways={[]} gatewaysUnavailable={false} />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Vous n’avez pas encore de Gateway.")).toBeTruthy();
    expect(call).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Créer un accès Gateway" }));
    expect(new URLSearchParams(window.location.search).get("action")).toBe("new");
  });
});

describe("onboarding and quota", () => {
  const status = { books: true, devices: false, deliveries: null, gateways: false };
  it("uses actual states, remembers dismissal, and isolates users", () => {
    const { rerender } = wrap(<Onboarding status={status} userKey="a" />);
    expect(screen.getAllByText("Fait")).toHaveLength(1);
    expect(screen.getByText("État indisponible pour le moment.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Masquer ce guide" }));
    expect(screen.queryByText("Vos premiers pas")).toBeNull();
    rerender(<NextIntlClientProvider locale="fr" messages={fr}><Onboarding status={status} userKey="b" /></NextIntlClientProvider>);
    expect(screen.getByText("Vos premiers pas")).toBeTruthy();
  });
  it("never reappears after all steps have completed", () => {
    const { rerender } = wrap(<Onboarding status={{ books: true, devices: true, deliveries: true, gateways: true }} userKey="a" />);
    expect(screen.queryByText("Vos premiers pas")).toBeNull();
    rerender(<NextIntlClientProvider locale="fr" messages={fr}><Onboarding status={status} userKey="a" /></NextIntlClientProvider>);
    expect(screen.queryByText("Vos premiers pas")).toBeNull();
  });
  it("does not invent a quota and only warns above 90 percent", () => {
    const { rerender } = wrap(<StorageQuota storage={{ used_bytes: 9, quota_bytes: 10, percentage: null }} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("90");
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<NextIntlClientProvider locale="en" messages={en}><StorageQuota storage={{ used_bytes: 1, quota_bytes: 0, percentage: null }} /></NextIntlClientProvider>);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("unavailable");
  });
  it("warns even just above 90 percent before display rounding", () => {
    wrap(<StorageQuota storage={{ used_bytes: 900001, quota_bytes: 1000000, percentage: 90 }} />);
    expect(screen.getByRole("alert").textContent).toContain("presque plein");
  });
  it("preserves a literal search for all while clearing the all-filter sentinel", () => {
    updateUrlQuery({ q: "all", brand: "all" });
    expect(new URLSearchParams(window.location.search).get("q")).toBe("all");
    expect(new URLSearchParams(window.location.search).has("brand")).toBe(false);
  });
  it("preserves unrelated URL parameters and history state", () => {
    window.history.replaceState({ next: true }, "", "/fr/app/appareils?cloud_link=ok#section");
    updateUrlQuery({ brand: "kobo" });
    expect(window.location.search).toContain("cloud_link=ok");
    expect(window.location.hash).toBe("#section");
    expect(window.history.state).toEqual({ next: true });
  });
});
