/**
 * Pen devices rebuild (ba89b7b): PageHeader + default-dest hint + registered panel,
 * DeviceRows (not a table), FR/EN labels, API tier only.
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

  it("uses PageHeader with refresh and new-device controls", () => {
    renderDevices("fr");
    const layout = screen.getByTestId("devices-pen-layout");
    const title = within(layout).getByRole("heading", {
      level: 1,
      name: "Appareils",
    });
    expect(title.className).toMatch(/text-\[28px\]/);
    expect(title.className).toMatch(/font-bold/);
    expect(screen.getAllByRole("button", { name: "Actualiser" }).length).toBe(1);
    expect(screen.getAllByRole("button", { name: "Nouvel appareil" }).length).toBe(1);
  });

  it("shows Pen page header copy in FR and EN without SaaS section chrome", () => {
    const { unmount } = renderDevices("fr");
    expect(
      screen.getByRole("heading", { level: 1, name: "Appareils" })
    ).toBeTruthy();
    expect(screen.getAllByText("Destinations enregistrées").length).toBeGreaterThan(0);
    expect(screen.getByText("Appareils enregistrés")).toBeTruthy();
    expect(screen.getByText("2 appareils")).toBeTruthy();
    expect(
      screen.getByText("Destination par défaut : Kindle Paperwhite")
    ).toBeTruthy();
    expect(screen.queryByText("Vos appareils")).toBeNull();
    unmount();

    renderDevices("en");
    expect(
      screen.getByRole("heading", { level: 1, name: "Devices" })
    ).toBeTruthy();
    expect(screen.getAllByText("Registered destinations").length).toBeGreaterThan(0);
    expect(screen.getByText("Arrives by email (Kindle)")).toBeTruthy();
    expect(screen.getByText("Arrives via the cloud")).toBeTruthy();
    expect(screen.getByText("Registered devices")).toBeTruthy();
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
    expect(screen.getByTestId("devices-body")).toBeTruthy();
    expect(screen.getByTestId("devices-panel")).toBeTruthy();
    expect(document.querySelectorAll("[data-testid='device-row']").length).toBe(2);
    expect(document.querySelector("thead")).toBeNull();
  });

  it("keeps DeviceRow actions compressible so narrow viewports do not overflow", () => {
    // Regression for horizontal overflow at ~390px: actions were shrink-0 in a
    // nowrap row, so the line grew to ~550px and scrolled the whole page.
    renderDevices("fr");
    const row = screen.getAllByTestId("device-row")[0]!;
    expect(row.className).toMatch(/flex-wrap/);
    expect(row.className).toMatch(/min-w-0/);
    const actions = within(row).getByTestId("device-row-actions");
    expect(actions.className).toMatch(/min-w-0/);
    expect(actions.className).toMatch(/max-w-full/);
    expect(actions.className).toMatch(/flex-wrap/);
    expect(actions.className).not.toMatch(/(?:^|\s)shrink-0(?:\s|$)/);
  });

  it("hides the default-destination hint when no devices exist", () => {
    renderDevices("fr", { initialDevices: [] });
    expect(screen.queryByTestId("devices-default-dest")).toBeNull();
    expect(screen.queryByText(/Destination par défaut/)).toBeNull();
  });
});
