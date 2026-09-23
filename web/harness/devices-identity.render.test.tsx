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
          title="Appareils"
          description="Destinations enregistrées"
          initialDevices={[device]}
          devicesUnavailable={false}
        />
      </NextIntlClientProvider>
    );

    const name = screen.getByText(LONG_NAME);
    expect(name.className.includes("break-words")).toBe(true);
    expect(name.className.includes("whitespace-normal")).toBe(true);

    const model = screen.getByText(`— ${LONG_MODEL}`);
    expect(model.className.includes("break-words")).toBe(true);
    expect(model.className.includes("whitespace-normal")).toBe(true);

    expect(screen.getByText("Kindle")).toBeTruthy();
    expect(screen.getByText(/Arrive par email \(Kindle\)/)).toBeTruthy();

    expect(screen.queryByText(/smtp/i)).toBeNull();
    expect(screen.queryByText(/\/devices\/.+\/methods/i)).toBeNull();
    expect(screen.queryByText("Arrive via le cloud")).toBeNull();
    expect(screen.queryByText("Code dans le navigateur")).toBeNull();
    expect(screen.queryByText("Transfert USB")).toBeNull();
  });
});
