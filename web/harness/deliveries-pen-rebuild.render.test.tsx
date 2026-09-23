/**
 * Pen deliveries rebuild: StatusRow composition (SAPRI / mF0035), no desktop table,
 * header Livraisons + Historique, FR/EN labels, unknown ≠ delivered.
 * Run: npm run test:ui-harness
 */
import { render, screen, within } from "@testing-library/react";
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
    expect(within(rows[0]!).getByText("Terminé")).toBeTruthy();
    expect(
      within(rows[1]!).getByRole("heading", {
        name: "Ink & Transfer → Kobo Clara",
      })
    ).toBeTruthy();
    expect(within(rows[1]!).getByText("En cours")).toBeTruthy();
  });

  it("shows Pen page header copy in FR and EN without SaaS section chrome", () => {
    const { unmount } = renderDeliveries("fr");
    expect(screen.getByRole("heading", { level: 1, name: "Livraisons" })).toBeTruthy();
    expect(screen.getByText("Historique des transferts")).toBeTruthy();
    expect(screen.queryByText("Vos envois")).toBeNull();
    unmount();

    renderDeliveries("en");
    expect(screen.getByRole("heading", { level: 1, name: "Deliveries" })).toBeTruthy();
    expect(screen.getByText("Transfer history")).toBeTruthy();
    expect(screen.getByText("Finished")).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.queryByText("Your deliveries")).toBeNull();
  });

  it("keeps unknown status explicit and never maps it to Finished/Terminé", () => {
    renderDeliveries("fr", {
      initialDeliveries: [
        baseJob({ status: "in_transit" as DeliveryJob["status"] }),
      ],
    });

    expect(screen.getByText("Inconnu")).toBeTruthy();
    expect(screen.queryByText("Terminé")).toBeNull();
    expect(screen.getByText(/Statut non reconnu/i)).toBeTruthy();
  });

  it("does not crush into a desktop table markup at mobile density", () => {
    renderDeliveries("fr");
    const layout = screen.getByTestId("deliveries-pen-layout");
    expect(layout.className).toMatch(/min-w-0/);
    expect(document.querySelectorAll("[data-testid='delivery-status-row']").length).toBe(
      2
    );
    expect(document.querySelector("thead")).toBeNull();
  });
});
