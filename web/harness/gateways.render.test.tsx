/**
 * Gateway surface: connection honesty, empty≠unavailable, both secrets in copy
 * block without snapshot/log leaks, create/revoke interactions.
 * Run: npm run test:ui-harness
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { bothSecretsBlock } from "@/components/app/gateways/create-gateway-dialog";
import { GatewaysView } from "@/components/app/gateways/gateways-view";
import type { Gateway, GatewayCredentials } from "@/lib/types";
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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

const PAIRING_TOKEN = "test-pairing-token-not-for-logs";
const GATEWAY_KEY = "test-gateway-key-not-for-logs";

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

function baseCredentials(
  overrides: Partial<GatewayCredentials> = {}
): GatewayCredentials {
  return {
    gateway_id: "22222222-2222-4222-8222-222222222222",
    pairing_token: PAIRING_TOKEN,
    gateway_key: GATEWAY_KEY,
    pairing_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    pairing_token_ttl_minutes: 15,
    gateway_online_seconds: 60,
    ...overrides,
  };
}

function renderGateways(
  props: {
    initialGateways?: Gateway[];
    gatewaysUnavailable?: boolean;
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <GatewaysView
        title={messages.pages.access.title}
        description={messages.pages.access.description}
        initialGateways={props.initialGateways ?? []}
        gatewaysUnavailable={props.gatewaysUnavailable ?? false}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — gateways", () => {
  beforeEach(() => {
    callMock.mockReset();
    // Paired gateways fetch activity (+ optional list poll). Always return a Promise.
    callMock.mockResolvedValue([]);
  });

  it("distinguishes unavailable from empty", () => {
    const { unmount } = renderGateways({
      initialGateways: [],
      gatewaysUnavailable: true,
    });
    expect(
      document.querySelector('[data-gateways-state="unavailable"]')
    ).toBeTruthy();
    expect(screen.getByText(messages.access.emptyUnavailableTitle)).toBeTruthy();
    expect(screen.queryByText(messages.access.emptyTitle)).toBeNull();
    unmount();

    renderGateways({ initialGateways: [], gatewaysUnavailable: false });
    expect(document.querySelector('[data-gateways-state="empty"]')).toBeTruthy();
    expect(screen.getByText(messages.access.emptyTitle)).toBeTruthy();
    expect(screen.queryByText(messages.access.emptyUnavailableTitle)).toBeNull();
  });

  it("shows expired pairing, not connected", () => {
    renderGateways({
      initialGateways: [
        baseGateway({
          status: "pending",
          last_seen_at: null,
          pairing_expires_at: new Date(Date.now() - 60_000).toISOString(),
        }),
      ],
    });

    const expired = document.querySelectorAll('[data-connection="expired"]');
    expect(expired.length).toBeGreaterThan(0);
    expect(document.querySelector('[data-connection="connected"]')).toBeNull();
    expect(
      screen.getAllByText(messages.access.statusExpired).length
    ).toBeGreaterThan(0);
  });

  it("shows cold heartbeat as offline, not connected", () => {
    renderGateways({
      initialGateways: [
        baseGateway({
          status: "paired",
          last_seen_at: new Date(Date.now() - 10 * 60_000).toISOString(),
          gateway_online_seconds: 60,
        }),
      ],
    });

    expect(
      document.querySelectorAll('[data-connection="offline"]').length
    ).toBeGreaterThan(0);
    expect(document.querySelector('[data-connection="connected"]')).toBeNull();
  });

  it("keeps unknown job status away from success labels", async () => {
    callMock.mockImplementation(async (path: string) => {
      if (String(path).includes("/jobs")) {
        return [
          {
            job_id: "j1",
            type: "fetch",
            status: "mystery-status",
            attempts: 1,
            error: null,
            library_item_id: null,
          },
          {
            job_id: "j2",
            type: "fetch",
            status: "failed",
            attempts: 3,
            error: "boom",
            library_item_id: null,
          },
        ];
      }
      return [];
    });

    renderGateways({
      initialGateways: [baseGateway({ status: "paired" })],
    });

    await waitFor(() => {
      expect(document.querySelector('[data-activity="ready"]')).toBeTruthy();
    });

    expect(document.querySelector('[data-job-status="uncertain"]')).toBeTruthy();
    expect(document.querySelector('[data-job-status="failed"]')).toBeTruthy();
    expect(
      screen.getAllByText(messages.access.jobStatusUncertain).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(messages.access.jobStatusFailed).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(messages.access.jobStatusDone)).toBeNull();
  });

  it("builds both secrets in the copy block without leaking via snapshots", () => {
    const credentials = baseCredentials();
    const block = bothSecretsBlock(credentials);

    expect(block).toContain("PAIRING_TOKEN=");
    expect(block).toContain("GATEWAY_KEY=");
    expect(block).toContain(PAIRING_TOKEN);
    expect(block).toContain(GATEWAY_KEY);
    expect(block.split("\n")).toHaveLength(2);
    // Explicitly no snapshot — secrets must never enter snapshot artifacts.
  });

  it("shows both secrets in the created credentials panel", async () => {
    const credentials = baseCredentials();
    callMock.mockResolvedValueOnce(credentials);

    renderGateways({ initialGateways: [] });

    fireEvent.click(
      screen.getAllByRole("button", { name: messages.access.createLink })[0]!
    );

    await waitFor(() => {
      expect(screen.getByLabelText(messages.createAccess.name)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: messages.common.create }));

    await waitFor(() => {
      expect(document.querySelector("[data-credentials-panel]")).toBeTruthy();
    });

    const block = document.querySelector("[data-both-secrets]");
    expect(block).toBeTruthy();
    expect(block!.textContent).toContain("PAIRING_TOKEN=");
    expect(block!.textContent).toContain("GATEWAY_KEY=");
    expect(block!.textContent).toContain(PAIRING_TOKEN);
    expect(block!.textContent).toContain(GATEWAY_KEY);

    // Pen Dialog/GatewayCredentials anatomy
    const credentialsDialog = screen.getByRole("dialog");
    expect(credentialsDialog.className).toMatch(/sm:max-w-\[500px\]/);
    expect(credentialsDialog.className).toMatch(/p-7/);
    expect(document.querySelector("[data-credentials-ttl]")).toBeTruthy();
    expect(document.querySelector("[data-credentials-next-steps]")).toBeTruthy();
    expect(
      screen.getByLabelText(messages.createAccess.gatewayId)
    ).toBeTruthy();
    expect(
      screen.getByLabelText(messages.createAccess.pairingToken)
    ).toBeTruthy();
    expect(
      screen.getByLabelText(messages.createAccess.gatewayKey)
    ).toBeTruthy();
    const credentialsFooter = credentialsDialog.querySelector(
      '[data-slot="dialog-footer"]'
    );
    expect(credentialsFooter).toBeTruthy();
    expect(credentialsFooter!.className).toMatch(/sm:justify-end/);
  });

  it("opens revoke confirmation for a paired gateway", async () => {
    renderGateways({
      initialGateways: [baseGateway({ status: "paired" })],
    });

    const revokeButtons = screen.getAllByRole("button", {
      name: messages.access.revoke,
    });
    fireEvent.click(revokeButtons[0]!);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: messages.access.revokeConfirmTitle })
      ).toBeTruthy();
    });

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(messages.access.revokeConfirmDescription)
    ).toBeTruthy();

    // Pen Dialog/ConfirmDestructive anatomy
    expect(dialog.className).toMatch(/sm:max-w-\[400px\]/);
    const footer = dialog.querySelector('[data-slot="dialog-footer"]');
    expect(footer).toBeTruthy();
    expect(footer!.className).toMatch(/sm:justify-end/);
    const cancel = within(dialog).getByRole("button", {
      name: messages.common.cancel,
    });
    expect(cancel.className).not.toMatch(/bg-destructive/);
    const confirm = within(dialog).getByRole("button", {
      name: messages.access.revoke,
    });
    // Primary confirm (not destructive tint) — Pen Actions
    expect(confirm.className).not.toMatch(/bg-destructive\/10/);

    callMock.mockResolvedValueOnce(undefined);
    fireEvent.click(
      within(dialog).getByRole("button", { name: messages.access.revoke })
    );

    await waitFor(() => {
      expect(callMock).toHaveBeenCalledWith(
        "/api/v1/gateways/revoke",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("renders the Pen ConnectionState panel with honest status", () => {
    renderGateways({
      initialGateways: [baseGateway({ status: "paired" })],
    });
    expect(document.querySelector("[data-gateway-connection-panel]")).toBeTruthy();
    expect(
      screen.getAllByText(messages.access.cloudLocalTitle).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(messages.access.cloudLocalBody)).toBeTruthy();
    expect(
      document.querySelector('[data-connection-summary="connected"]')
    ).toBeTruthy();
    expect(screen.queryByText(messages.access.sectionTitle)).toBeNull();
    expect(document.querySelector("table")).toBeNull();
  });
});
