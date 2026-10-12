import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import { SystemHealthPanel } from "@/components/app/settings/system-health";
import { KindleTest } from "@/components/app/settings/kindle-test";
import { DeliveriesView } from "@/components/app/deliveries/deliveries-view";
import messages from "@/messages/fr.json";
import type { DeliveryJob } from "@/lib/types";

const call = vi.fn();
vi.mock("@/lib/api-client", () => ({ useApiClient: () => ({ call }) }));
vi.mock("motion/react", () => ({ motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }, useReducedMotion: () => true }));
const wrap = (children: React.ReactNode) => render(<NextIntlClientProvider locale="fr" messages={messages}>{children}</NextIntlClientProvider>);
beforeEach(() => call.mockReset());

it("loads factual system status and offers recovery after a failed request", async () => {
  call.mockRejectedValueOnce(new Error("offline"));
  wrap(<SystemHealthPanel />);
  expect(screen.getByRole("status").textContent).toContain("Chargement");
  expect(await screen.findByRole("alert")).toBeTruthy();
  call.mockResolvedValue({ converters: { ebook_convert_available: false, ebook_convert_version: null }, mail: { configured: true, sender_address: "sender@example.test", domains_allowed: ["kindle.com"] }, storage: { used_bytes: 10, quota_bytes: 100, percentage: 10 }, gateways: { total: 3, online: 1, pending: 1, revoked: 1 }, library: { items: 2, deliveries_last_7_days: { queued: 1, sent: 2, delivered: 3, failed: 4 } }, version: "1.0" });
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(await screen.findByText("Indisponible")).toBeTruthy();
  expect(screen.getByText(/sender@example.test/)).toBeTruthy();
  expect(screen.getByText(/3 au total · 1 en ligne/)).toBeTruthy();
});

it("tests the selected Kindle and displays actionable quota failures", async () => {
  call.mockRejectedValueOnce(new Error(JSON.stringify({ detail: "quota d’envois atteint, réessayez plus tard" })));
  wrap(<KindleTest deviceId="device" />);
  fireEvent.click(screen.getByRole("button", { name: "Tester l’adresse Kindle" }));
  expect((await screen.findByRole("alert")).textContent).toContain("quota");
  expect(JSON.parse(call.mock.calls[0][1].body)).toEqual({ device_id: "device" });
  call.mockResolvedValue({ status: "sent", recipient: "device@kindle.fr" });
  fireEvent.click(screen.getByRole("button", { name: "Tester l’adresse Kindle" }));
  expect((await screen.findByRole("status")).textContent).toContain("Amazon ne confirme pas");
});

const job: DeliveryJob = { id: "job", device_id: "device", status: "failed", method: "opds", terminal: true, error: "Erreur précédente", created_at: "2026-10-10T12:00:00Z", delivered_at: null, item_title: "Livre" };
it("retries a failure and exposes the returned catalog link", async () => {
  call.mockResolvedValue({ ...job, status: "sent", error: null, download_url: "https://example.test/opds/access" });
  wrap(<DeliveriesView title="Livraisons" description="" initialDeliveries={[job]} deliveriesUnavailable={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Relancer l’envoi" }));
  expect(await screen.findByText("Catalogue prêt à consulter")).toBeTruthy();
  expect(screen.getByRole("link").getAttribute("href")).toContain("/opds/access");
  expect(call).toHaveBeenCalledWith("/api/v1/deliveries/job/retry", { method: "POST" });
});

it("sends search, status, device and pagination to the server", async () => {
  call.mockResolvedValue(Array.from({ length: 50 }, (_, index) => ({ ...job, id: String(index) })));
  wrap(<DeliveriesView title="Livraisons" description="" initialDeliveries={Array.from({ length: 50 }, (_, index) => ({ ...job, id: String(index) }))} initialDevices={[{ id: "device", name: "Liseuse", brand: "pocketbook", model: null, delivery_tier: "D", conversion_profile: null, cloud_linked: false, cloud_provider: null, last_synced_at: null }]} deliveriesUnavailable={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Suivante" }));
  await waitFor(() => expect(call.mock.lastCall?.[0]).toContain("page=2"));
  fireEvent.change(screen.getByRole("textbox", { name: "Rechercher un livre ou une liseuse" }), { target: { value: "été" } });
  fireEvent.click(screen.getByRole("combobox", { name: "Filtrer par liseuse" }));
  const deviceOption = await screen.findByRole("option", { name: "Liseuse" });
  fireEvent.pointerDown(deviceOption, { pointerType: "mouse" });
  fireEvent.click(deviceOption);
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("device_id")).toBe("device"));
  fireEvent.click(screen.getByRole("button", { name: "Échec" }));
  await waitFor(() => expect(call.mock.lastCall?.[0]).toContain("status=failed"));
  const url = new URL(call.mock.lastCall![0], "https://example.test");
  expect(Object.fromEntries(url.searchParams)).toEqual({ page: "1", limit: "50", q: "été", device_id: "device", status: "failed" });
});

it("shows a storage gauge using the returned quota and warns above 90 percent", async () => {
  call.mockResolvedValue({ converters: { ebook_convert_available: false, ebook_convert_version: null }, mail: { configured: false, sender_address: "", domains_allowed: [] }, storage: { used_bytes: 4.6 * 1024 ** 3, quota_bytes: 5 * 1024 ** 3, percentage: 92 }, gateways: { total: 0, online: 0, pending: 0, revoked: 0 }, library: { items: 1, deliveries_last_7_days: {} }, version: null });
  wrap(<SystemHealthPanel />);
  const gauge = await screen.findByRole("progressbar");
  expect(gauge.getAttribute("aria-valuenow")).toBe("92");
  expect(screen.getByText(/4,6 Go utilisés sur 5 Go/)).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("presque plein");
});
