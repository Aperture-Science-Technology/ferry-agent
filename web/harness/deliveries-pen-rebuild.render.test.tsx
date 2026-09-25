/**
 * Pen deliveries rebuild (ba89b7b): PageHeader + queue hint + history panel,
 * StatusRows (not a table), functional filters, FR/EN labels, unknown ≠ delivered.
 * Run: npm run test:ui-harness
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { DeliveriesView } from "@/components/app/deliveries/deliveries-view";
import type { DeliveryJob } from "@/lib/types";
import messagesFr from "@/messages/fr.json";
import messagesEn from "@/messages/en.json";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: async () => null,
  }),
}));

vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  useApiClient: () => ({
    call: vi.fn(),
  }),
}));

vi.mock("motion/react", () => {
  const passthrough = ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>;
  return {
    motion: {
      div: passthrough,
    },
    useReducedMotion: () => true,
  };
});

function baseJob(overrides: Partial<DeliveryJob> = {}): DeliveryJob {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    created_at: "2026-03-01T10:00:00Z",
    delivered_at: null,
    device_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    device_label: "Kindle Paperwhite",
    download_url: null,
    error: null,
    item_author: "Camille Durand",
    item_title: "Le Passage du Nord",
    library_item_id: null,
    method: "email",
    status: "delivered",
    target_format: "epub",
    ...overrides,
  };
}

function renderDeliveries(
  locale: "fr" | "en",
  props?: Partial<React.ComponentProps<typeof DeliveriesView>>
) {
  const messages = locale === "fr" ? messagesFr : messagesEn;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DeliveriesView
        title={locale === "fr" ? "Livraisons" : "Deliveries"}
        description={
          locale === "fr" ? "Historique des transferts" : "Transfer history"
        }
        initialDeliveries={[
          baseJob(),
          baseJob({
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            item_title: "Ink & Transfer",
            device_label: "Kobo Clara",
            status: "sent",
          }),
        ]}
        deliveriesUnavailable={false}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — Pen deliveries composition", () => {
  it("renders StatusRows (not a table) with book → device hierarchy", () => {
    renderDeliveries("fr");

    expect(screen.getByTestId("deliveries-pen-layout")).toBeTruthy();
    expect(screen.getByTestId("deliveries-status-rows")).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();

    const rows = screen.getAllByTestId("delivery-status-row");
    expect(rows.length).toBe(2);

    expect(
      within(rows[0]!).getByRole("heading", {
        name: "Le Passage du Nord → Kindle Paperwhite",
      })
    ).toBeTruthy();
    expect(within(rows[0]!).getByText("Livré")).toBeTruthy();
    expect(
      within(rows[1]!).getByRole("heading", {
        name: "Ink & Transfer → Kobo Clara",
      })
    ).toBeTruthy();
    expect(within(rows[1]!).getByText("En cours")).toBeTruthy();
  });

  it("uses PageHeader with a single refresh control", () => {
    renderDeliveries("fr");
    const layout = screen.getByTestId("deliveries-pen-layout");
    const title = within(layout).getByRole("heading", {
      level: 1,
      name: "Livraisons",
    });
    expect(title.className).toMatch(/text-\[28px\]/);
    expect(title.className).toMatch(/font-bold/);
    expect(screen.getAllByRole("button", { name: "Actualiser" }).length).toBe(
      1
    );
  });

  it("shows Pen page header copy in FR and EN without SaaS section chrome", () => {
    const { unmount } = renderDeliveries("fr");
    expect(
      screen.getByRole("heading", { level: 1, name: "Livraisons" })
    ).toBeTruthy();
    expect(screen.getAllByText("Historique des transferts").length).toBeGreaterThan(
      0
    );
    expect(screen.getByText("Historique")).toBeTruthy();
    expect(screen.getByText("2 livraisons")).toBeTruthy();
    expect(screen.queryByText("Vos envois")).toBeNull();
    unmount();

    renderDeliveries("en");
    expect(
      screen.getByRole("heading", { level: 1, name: "Deliveries" })
    ).toBeTruthy();
    expect(screen.getAllByText("Transfer history").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Delivered").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);
    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.queryByText("Your deliveries")).toBeNull();
  });

  it("keeps unknown status explicit and never maps it to Livré", () => {
    renderDeliveries("fr", {
      initialDeliveries: [
        baseJob({ status: "in_transit" as DeliveryJob["status"] }),
      ],
    });

    expect(screen.getByText("Inconnu")).toBeTruthy();
    const rows = screen.getAllByTestId("delivery-status-row");
    expect(rows.length).toBe(1);
    expect(within(rows[0]!).queryByText("Livré")).toBeNull();
    expect(screen.getByText(/Statut non reconnu/i)).toBeTruthy();
  });

  it("does not crush into a desktop table markup at mobile density", () => {
    renderDeliveries("fr");
    const layout = screen.getByTestId("deliveries-pen-layout");
    expect(layout.className).toMatch(/min-w-0/);
    expect(screen.getByTestId("deliveries-body")).toBeTruthy();
    expect(
      document.querySelectorAll("[data-testid='delivery-status-row']").length
    ).toBe(2);
    expect(document.querySelector("thead")).toBeNull();
  });

  it("shows an honest queue hint from real counts and filters the list", () => {
    renderDeliveries("fr", {
      initialDeliveries: [
        baseJob({ status: "delivered" }),
        baseJob({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          item_title: "Ink & Transfer",
          status: "sent",
        }),
        baseJob({
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          item_title: "Ferry Notes",
          status: "failed",
        }),
        baseJob({
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          item_title: "Catalogues silencieux",
          status: "queued",
        }),
      ],
    });

    const hint = screen.getByTestId("deliveries-queue-hint");
    expect(within(hint).getByText(/2 en cours · 1 échec/)).toBeTruthy();

    const filters = screen.getByTestId("deliveries-filters");
    fireEvent.click(within(filters).getByRole("button", { name: "Livré" }));
    const deliveredRows = screen.getAllByTestId("delivery-status-row");
    expect(deliveredRows.length).toBe(1);
    expect(screen.getByText(/Le Passage du Nord/)).toBeTruthy();
    expect(within(deliveredRows[0]!).getByText("Livré")).toBeTruthy();
    expect(screen.queryByText(/Ink & Transfer/)).toBeNull();
    expect(screen.queryByText(/Ferry Notes/)).toBeNull();
    expect(screen.queryByText(/Catalogues silencieux/)).toBeNull();

    fireEvent.click(within(filters).getByRole("button", { name: "En cours" }));
    const activeRows = screen.getAllByTestId("delivery-status-row");
    expect(activeRows.length).toBe(2);
    expect(screen.getByText(/Ink & Transfer/)).toBeTruthy();
    expect(screen.getByText(/Catalogues silencieux/)).toBeTruthy();
    expect(
      activeRows.some((row) => within(row).queryByText("Demandé"))
    ).toBe(true);
    expect(
      activeRows.some((row) => within(row).queryByText("En cours"))
    ).toBe(true);
    expect(screen.queryByText(/Le Passage du Nord/)).toBeNull();
    expect(screen.queryByText(/Ferry Notes/)).toBeNull();

    fireEvent.click(within(filters).getByRole("button", { name: "Échec" }));
    const failedRows = screen.getAllByTestId("delivery-status-row");
    expect(failedRows.length).toBe(1);
    expect(screen.getByText(/Ferry Notes/)).toBeTruthy();
    expect(within(failedRows[0]!).getByText("Échec")).toBeTruthy();

    fireEvent.click(within(filters).getByRole("button", { name: "Tous" }));
    expect(screen.getAllByTestId("delivery-status-row").length).toBe(4);
  });

  it("hides the queue hint when nothing is active or failed", () => {
    renderDeliveries("fr", {
      initialDeliveries: [baseJob({ status: "delivered" })],
    });
    expect(screen.queryByTestId("deliveries-queue-hint")).toBeNull();
  });
});
