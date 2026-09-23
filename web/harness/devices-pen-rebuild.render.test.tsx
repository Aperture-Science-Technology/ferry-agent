/**
 * Pen devices rebuild: DeviceRow composition (TJFgO / mF003e), no desktop table,
 * header Appareils + Destinations, FR/EN labels, API tier only.
 * Run: npm run test:ui-harness
 */
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { DevicesView } from "@/components/app/devices/devices-view";
import type { Device } from "@/lib/types";
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

function baseDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Kindle Paperwhite",
    brand: "kindle",
    model: "Paperwhite",
    cloud_linked: true,
    cloud_provider: "dropbox",
    conversion_profile: "reader_6in",
    delivery_tier: "A",
    last_synced_at: "2026-03-01T10:00:00Z",
    ...overrides,
  };
}

function renderDevices(
  locale: "fr" | "en",
  props?: Partial<React.ComponentProps<typeof DevicesView>>
) {
  const messages = locale === "fr" ? messagesFr : messagesEn;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DevicesView
        title={locale === "fr" ? "Appareils" : "Devices"}
        description={
          locale === "fr" ? "Destinations enregistrées" : "Registered destinations"
        }
        initialDevices={[
          baseDevice(),
          baseDevice({
            id: "22222222-2222-4222-8222-222222222222",
            name: "Kobo Clara",
            brand: "kobo",
            model: "Clara 2E",
            cloud_linked: false,
            cloud_provider: null,
            delivery_tier: "B",
          }),
        ]}
        devicesUnavailable={false}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — Pen devices composition", () => {
  it("renders DeviceRows (not a table) with name → brand/model hierarchy", () => {
    renderDevices("fr");

    expect(screen.getByTestId("devices-pen-layout")).toBeTruthy();
    expect(screen.getByTestId("devices-rows")).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();

    const rows = screen.getAllByTestId("device-row");
    expect(rows.length).toBe(2);

    expect(
      within(rows[0]!).getByRole("heading", { name: "Kindle Paperwhite" })
    ).toBeTruthy();
    expect(within(rows[0]!).getByText("Kindle")).toBeTruthy();
    expect(within(rows[0]!).getByText(/— Paperwhite/)).toBeTruthy();
    expect(within(rows[0]!).getByText(/Arrive par email \(Kindle\)/)).toBeTruthy();
    expect(within(rows[0]!).getByText("Lié à Dropbox")).toBeTruthy();

    expect(
      within(rows[1]!).getByRole("heading", { name: "Kobo Clara" })
    ).toBeTruthy();
    expect(within(rows[1]!).getByText("Non lié")).toBeTruthy();
    expect(within(rows[1]!).getByText("Arrive via le cloud")).toBeTruthy();
  });

  it("shows Pen page header copy in FR and EN without SaaS section chrome", () => {
    const { unmount } = renderDevices("fr");
    expect(screen.getByRole("heading", { level: 1, name: "Appareils" })).toBeTruthy();
    expect(screen.getByText("Destinations enregistrées")).toBeTruthy();
    expect(screen.queryByText("Vos appareils")).toBeNull();
    unmount();

    renderDevices("en");
    expect(screen.getByRole("heading", { level: 1, name: "Devices" })).toBeTruthy();
    expect(screen.getByText("Registered destinations")).toBeTruthy();
    expect(screen.getByText("Arrives by email (Kindle)")).toBeTruthy();
    expect(screen.getByText("Arrives via the cloud")).toBeTruthy();
    expect(screen.queryByText("Your devices")).toBeNull();
  });

  it("displays only the API delivery tier label, never inventing other methods", () => {
    renderDevices("fr", {
      initialDevices: [baseDevice({ delivery_tier: "A" })],
    });

    expect(screen.getByText(/Arrive par email \(Kindle\)/)).toBeTruthy();
    expect(screen.queryByText("Code dans le navigateur")).toBeNull();
    expect(screen.queryByText("Transfert USB")).toBeNull();
    expect(screen.queryByText(/smtp/i)).toBeNull();
  });

  it("does not crush into a desktop table markup at mobile density", () => {
    renderDevices("fr");
    const layout = screen.getByTestId("devices-pen-layout");
    expect(layout.className).toMatch(/min-w-0/);
    expect(document.querySelectorAll("[data-testid='device-row']").length).toBe(2);
    expect(document.querySelector("thead")).toBeNull();
  });
});
