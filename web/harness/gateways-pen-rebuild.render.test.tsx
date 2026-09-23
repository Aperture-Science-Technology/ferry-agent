/**
 * Pen Gateway rebuild: ConnectionState + GatewayRow (gEtgk / mF0047), no desktop
 * table, dedicated mobile header, unique page title, FR/EN labels.
 * Run: npm run test:ui-harness
 */
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { GatewaysView } from "@/components/app/gateways/gateways-view";
import type { Gateway } from "@/lib/types";
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
    call: vi.fn().mockResolvedValue([]),
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

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children?: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function baseGateway(overrides: Partial<Gateway> = {}): Gateway {
  return {
    gateway_id: "11111111-1111-4111-8111-111111111111",
    name: "Gateway salon",
    status: "paired",
    last_seen_at: new Date().toISOString(),
    pairing_expires_at: null,
    pairing_token_ttl_minutes: 15,
    gateway_online_seconds: 60,
    ...overrides,
  };
}

function renderGateways(
  locale: "fr" | "en",
  props?: Partial<React.ComponentProps<typeof GatewaysView>>
) {
  const messages = locale === "fr" ? messagesFr : messagesEn;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <GatewaysView
        title={locale === "fr" ? "Gateway" : "Gateway"}
        description={
          locale === "fr"
            ? "Module local optionnel — complémentaire du cloud"
            : "Optional local module — complements the cloud"
        }
        initialGateways={[
          baseGateway(),
          baseGateway({
            gateway_id: "22222222-2222-4222-8222-222222222222",
            name: "Gateway atelier",
            status: "pending",
            last_seen_at: null,
            pairing_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          }),
        ]}
        gatewaysUnavailable={false}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — Pen gateways composition", () => {
  it("renders GatewayRows (not a table) with name → status hierarchy", () => {
    renderGateways("fr");

    expect(screen.getByTestId("gateways-pen-layout")).toBeTruthy();
    expect(screen.getByTestId("gateways-rows")).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();

    const rows = screen.getAllByTestId("gateway-row");
    expect(rows.length).toBe(2);

    expect(
      within(rows[0]!).getByRole("heading", { name: "Gateway salon" })
    ).toBeTruthy();
    expect(within(rows[0]!).getByText(messagesFr.access.statusConnected)).toBeTruthy();

    expect(
      within(rows[1]!).getByRole("heading", { name: "Gateway atelier" })
    ).toBeTruthy();
    expect(within(rows[1]!).getByText(messagesFr.access.statusPending)).toBeTruthy();
  });

  it("exposes dedicated mobile and desktop headers (mF0047 / Hd0003)", () => {
    renderGateways("fr");
    const mobile = screen.getByTestId("gateways-header-mobile");
    const desktop = screen.getByTestId("gateways-header-desktop");
    expect(mobile.className).toMatch(/md:hidden/);
    expect(desktop.className).toMatch(/hidden/);
    expect(desktop.className).toMatch(/md:flex/);
    expect(within(mobile).getByText("Ferry Agent")).toBeTruthy();
    expect(mobile.querySelector("h1")?.textContent).toBe("Gateway");
    expect(desktop.querySelector("h1")?.textContent).toBe("Gateway");
    expect(desktop.querySelector("h1")?.className).toMatch(/text-\[28px\]/);
    expect(mobile.querySelector("h1")?.className).toMatch(/text-\[22px\]/);
    expect(within(desktop).queryByText("Ferry Agent")).toBeNull();
    expect(screen.getAllByRole("link", { name: messagesFr.access.guideLink }).length).toBe(1);
    expect(
      screen.getAllByRole("button", { name: messagesFr.access.createLink }).length
    ).toBe(1);
  });

  it("shows Pen page header and ConnectionState without SaaS section chrome", () => {
    const { unmount } = renderGateways("fr");
    expect(
      screen.getByTestId("gateways-header-mobile").querySelector("h1")?.textContent
    ).toBe("Gateway");
    expect(
      screen.getAllByText("Module local optionnel — complémentaire du cloud").length
    ).toBeGreaterThan(0);
    expect(document.querySelector("[data-gateway-connection-panel]")).toBeTruthy();
    expect(screen.getByText(messagesFr.access.cloudLocalBody)).toBeTruthy();
    expect(screen.queryByText(messagesFr.access.sectionTitle)).toBeNull();
    expect(screen.getByTestId("gateway-torrent-action")).toBeTruthy();
    expect(screen.getByText(messagesFr.access.torrentActionTitle)).toBeTruthy();
    unmount();

    renderGateways("en");
    expect(
      screen.getByTestId("gateways-header-mobile").querySelector("h1")?.textContent
    ).toBe("Gateway");
    expect(
      screen.getAllByText("Optional local module — complements the cloud").length
    ).toBeGreaterThan(0);
    expect(screen.getByText(messagesEn.access.cloudLocalBody)).toBeTruthy();
    expect(screen.getByText(messagesEn.access.torrentActionTitle)).toBeTruthy();
    expect(screen.queryByText(messagesEn.access.sectionTitle)).toBeNull();
  });

  it("does not crush into a desktop table markup at mobile density", () => {
    renderGateways("fr");
    const layout = screen.getByTestId("gateways-pen-layout");
    expect(layout.className).toMatch(/min-w-0/);
    expect(screen.getByTestId("gateways-body")).toBeTruthy();
    expect(layout.querySelector("table")).toBeNull();
    expect(screen.getAllByTestId("gateway-row").length).toBe(2);
  });
});
