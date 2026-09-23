/**
 * DeliverDialog: without an available method the submit CTA stays disabled
 * and must not POST /api/v1/deliveries.
 * Run: npm run test:ui-harness
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { DeliverDialog } from "@/components/app/library/deliver-dialog";
import type { Device, LibraryItem, MethodAvailability } from "@/lib/types";
import messages from "@/messages/fr.json";

const callMock = vi.fn();

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

const item: LibraryItem = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Le Passage du Nord",
  author: "Camille Durand",
  language: "fr",
  original_format: "epub",
  source_ref: null,
  source_id: null,
  cover_url: null,
  description: null,
  publisher: null,
  published_year: null,
  isbn: null,
  page_count: null,
  size_bytes: null,
  added_at: "2026-01-01T00:00:00Z",
};

const device: Device = {
  id: "device-1",
  name: "Kindle Paperwhite",
  brand: "kindle",
  model: "Paperwhite",
  cloud_linked: false,
  cloud_provider: null,
  conversion_profile: "reader_6in",
  delivery_tier: "A",
  last_synced_at: null,
};

const unavailableMethods: MethodAvailability[] = [
  { method: "email", available: false, reason_code: "smtp_not_configured" },
  { method: "dropbox", available: false, reason_code: "cloud_not_linked" },
  { method: "drive", available: false, reason_code: "cloud_not_linked" },
  { method: "browser_code", available: false, reason_code: null },
  { method: "usb", available: false, reason_code: null },
];

describe("UI harness — library deliver dialog", () => {
  it("keeps Envoyer disabled and skips POST when no method is available", async () => {
    callMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/users/me") {
        return { default_format: "epub" };
      }
      if (path === `/api/v1/devices/${device.id}/methods`) {
        return unavailableMethods;
      }
      throw new Error(`Unexpected call: ${path}`);
    });

    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <DeliverDialog
          item={item}
          devices={[device]}
          onOpenChange={() => undefined}
        />
      </NextIntlClientProvider>
    );

    const deviceTrigger = screen.getByRole("combobox", { name: /appareil/i });
    fireEvent.click(deviceTrigger);
    const option = await screen.findByRole("option", {
      name: "Kindle Paperwhite",
    });
    fireEvent.click(option);

    await waitFor(() => {
      expect(
        screen.getByText(/Send-to-Kindle indisponible|Cloud non relié|Aucun mode d'envoi/i)
      ).toBeTruthy();
    });

    const submit = screen.getByRole("button", { name: "Envoyer" });
    expect(submit).toHaveProperty("disabled", true);

    fireEvent.click(submit);

    expect(
      callMock.mock.calls.some(
        ([path, init]) =>
          path === "/api/v1/deliveries" &&
          init &&
          typeof init === "object" &&
          "method" in init &&
          init.method === "POST"
      )
    ).toBe(false);
  });
});
