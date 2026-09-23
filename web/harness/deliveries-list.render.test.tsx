/**
 * Deliveries list: unknown status must never read as finished;
 * download appears only with download_url; unavailable ≠ empty; partial refresh stays distinct.
 * Run: npm run test:ui-harness
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { DeliveriesView } from "@/components/app/deliveries/deliveries-view";
import type { DeliveryJob } from "@/lib/types";
import messages from "@/messages/fr.json";

const callMock = vi.fn();

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
    call: callMock,
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
    status: "queued",
    target_format: "epub",
    ...overrides,
  };
}

function renderDeliveries(
  props: {
    initialDeliveries?: DeliveryJob[];
    deliveriesUnavailable?: boolean;
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <DeliveriesView
        title="Livraisons"
        description="Historique des transferts"
        initialDeliveries={props.initialDeliveries ?? []}
        deliveriesUnavailable={props.deliveriesUnavailable ?? false}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — deliveries list", () => {
  it("shows Inconnu for an unrecognized status and never Terminé", () => {
    renderDeliveries({
      initialDeliveries: [
        baseJob({ status: "in_transit" as DeliveryJob["status"] }),
      ],
    });

    const unknownLabels = screen.getAllByText("Inconnu");
    expect(unknownLabels.length).toBeGreaterThan(0);
    expect(screen.queryByText("Terminé")).toBeNull();
    expect(
      screen.getAllByText(/Statut non reconnu|non reconnu/i).length
    ).toBeGreaterThan(0);
  });

  it("exposes a download control only when download_url is present", () => {
    const { unmount } = renderDeliveries({
      initialDeliveries: [
        baseJob({
          status: "delivered",
          download_url: null,
        }),
      ],
    });

    expect(screen.queryByText("Ouvrir le fichier")).toBeNull();
    expect(
      document.querySelector('a[href="https://example.test/book.epub"]')
    ).toBeNull();
    unmount();

    renderDeliveries({
      initialDeliveries: [
        baseJob({
          status: "delivered",
          download_url: "https://example.test/book.epub",
        }),
      ],
    });

    expect(screen.getAllByText("Ouvrir le fichier").length).toBeGreaterThan(0);
    const anchors = document.querySelectorAll(
      'a[href="https://example.test/book.epub"]'
    );
    expect(anchors.length).toBeGreaterThan(0);
  });

  it("shows unavailable (not empty) when the API failed with no rows", () => {
    renderDeliveries({
      initialDeliveries: [],
      deliveriesUnavailable: true,
    });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Envois indisponibles")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.queryByText("Aucun envoi")).toBeNull();
  });

  it("keeps known rows and shows a partial refresh banner when refresh fails", async () => {
    callMock.mockRejectedValueOnce(new Error("network"));

    renderDeliveries({
      initialDeliveries: [baseJob({ status: "sent" })],
      deliveriesUnavailable: false,
    });

    expect(screen.getAllByText(/Le Passage du Nord/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Envois indisponibles")).toBeNull();
    expect(screen.queryByText("Aucun envoi")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
      expect(screen.getByText("Actualisation incomplète")).toBeTruthy();
    });
    expect(screen.getAllByText(/Le Passage du Nord/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Aucun envoi")).toBeNull();
  });

  it("opens delivery detail from the failed-row action and shows tracking content", async () => {
    const job = baseJob({
      status: "failed",
      error: "SMTP refusé par le serveur distant.",
    });
    callMock.mockImplementation(async (path: string) => {
      if (path === `/api/v1/deliveries/${job.id}`) return job;
      throw new Error(`Unexpected call: ${path}`);
    });

    renderDeliveries({ initialDeliveries: [job] });

    fireEvent.click(
      screen.getAllByRole("button", {
        name: /Voir le problème de l’envoi de Le Passage du Nord/i,
      })[0]!
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Suivi de l’envoi")).toBeTruthy();
    expect(
      within(dialog).getByText("SMTP refusé par le serveur distant.")
    ).toBeTruthy();
    expect(within(dialog).getByText("Échoué")).toBeTruthy();
  });
});
