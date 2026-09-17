/**
 * Render: device identity hierarchy (custom name vs brand/model) wraps long values.
 * Run: npm run test:ui-harness
 */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { DevicesView } from "@/components/app/devices/devices-view";
import type { Device } from "@/lib/types";
import messages from "@/messages/fr.json";

vi.mock("@/lib/api-client", () => ({
  useApiClient: () => ({
    call: vi.fn(async () => []),
  }),
}));

const LONG_NAME =
  "Liseuse du salon avec un nom personnalisé très long pour forcer le retour à la ligne";
const LONG_MODEL =
  "Paperwhite Signature Edition avec une désignation de modèle excessivement longue";

const device: Device = {
  id: "11111111-1111-4111-8111-111111111111",
  name: LONG_NAME,
  brand: "kindle",
  model: LONG_MODEL,
  cloud_linked: false,
  cloud_provider: null,
  conversion_profile: "reader_6in",
  delivery_tier: "A",
  last_synced_at: null,
};

describe("UI harness — devices identity", () => {
  it("shows custom name and brand/model with wrapping classes, without inventing methods", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <DevicesView
          initialDevices={[device]}
          devicesUnavailable={false}
        />
      </NextIntlClientProvider>
    );

    const names = screen.getAllByText(LONG_NAME);
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((el) => el.className.includes("font-heading"))).toBe(
      true
    );
    expect(
      names.some(
        (el) =>
          el.className.includes("break-words") &&
          el.className.includes("whitespace-normal")
      )
    ).toBe(true);

    const models = screen.getAllByText(`— ${LONG_MODEL}`);
    expect(models.length).toBeGreaterThan(0);
    expect(
      models.every(
        (el) =>
          el.className.includes("break-words") &&
          el.className.includes("whitespace-normal")
      )
    ).toBe(true);

    expect(screen.getAllByText("Kindle").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Arrive par email \(Kindle\)/).length
    ).toBeGreaterThan(0);

    expect(screen.queryByText(/smtp/i)).toBeNull();
    expect(screen.queryByText(/\/devices\/.+\/methods/i)).toBeNull();
    expect(screen.queryByText("Arrive via le cloud")).toBeNull();
    expect(screen.queryByText("Code dans le navigateur")).toBeNull();
    expect(screen.queryByText("Transfert USB")).toBeNull();
  });
});
