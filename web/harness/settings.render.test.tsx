/**
 * Settings / OPDS: dirty detection, Kindle null PATCH, QR states,
 * create/revoke/copy without secret snapshots, unavailable≠empty.
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

import { CatalogQrCode } from "@/components/app/settings/catalog-qr-code";
import { ReaderCatalogSection } from "@/components/app/settings/reader-catalog-section";
import { SettingsForm } from "@/components/app/settings/settings-form";
import type { OpdsToken, OpdsTokenCreated } from "@/lib/types";
import messages from "@/messages/fr.json";

const callMock = vi.fn();
const refreshMock = vi.fn();
const copyMock = vi.fn();

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
  usePathname: () => "/app/reglages",
  useRouter: () => ({
    refresh: refreshMock,
    replace: vi.fn(),
  }),
}));

vi.mock("@/components/app/gateways/gateways-state", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/app/gateways/gateways-state")
  >("@/components/app/gateways/gateways-state");
  return {
    ...actual,
    copyTextToClipboard: (...args: unknown[]) => copyMock(...args),
  };
});

const qrToDataUrl = vi.fn();

vi.mock("qrcode", () => ({
  default: {
    toDataURL: (...args: unknown[]) => qrToDataUrl(...args),
  },
}));

const CATALOG_URL = "https://example.test/opds/catalog-secret-not-for-logs";

function baseToken(overrides: Partial<OpdsToken> = {}): OpdsToken {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    label: "Kobo Clara",
    created_at: "2026-01-01T00:00:00.000Z",
    last_used_at: null,
    ...overrides,
  };
}

function renderSettings(
  props: {
    initialEmail?: string;
    initialKindleEmail?: string;
    initialDefaultFormat?: string;
    settingsUnavailable?: boolean;
    initialOpdsTokens?: OpdsToken[];
    opdsTokensUnavailable?: boolean;
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <SettingsForm
        title={messages.pages.settings.title}
        description={messages.pages.settings.description}
        descriptionMobile={messages.pages.settings.descriptionMobile}
        initialEmail={props.initialEmail ?? "alex@example.com"}
        initialKindleEmail={props.initialKindleEmail ?? "alex@kindle.com"}
        initialDefaultFormat={props.initialDefaultFormat ?? "epub"}
        settingsUnavailable={props.settingsUnavailable ?? false}
        initialOpdsTokens={props.initialOpdsTokens ?? []}
        opdsTokensUnavailable={props.opdsTokensUnavailable ?? false}
      />
    </NextIntlClientProvider>
  );
}

function renderCatalog(
  props: {
    initialTokens?: OpdsToken[];
    tokensUnavailable?: boolean;
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ReaderCatalogSection
        initialTokens={props.initialTokens ?? []}
        tokensUnavailable={props.tokensUnavailable ?? false}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — settings / OPDS", () => {
  beforeEach(() => {
    callMock.mockReset();
    refreshMock.mockReset();
    copyMock.mockReset();
    qrToDataUrl.mockReset();
    copyMock.mockResolvedValue(true);
  });

  it("keeps settings unavailable distinct from ready", () => {
    const { unmount } = renderSettings({ settingsUnavailable: true });
    expect(
      document.querySelector('[data-settings-state="unavailable"]')
    ).toBeTruthy();
    expect(screen.getByText(messages.settings.unavailableTitle)).toBeTruthy();
    unmount();

    renderSettings();
    expect(document.querySelector('[data-settings-state="ready"]')).toBeTruthy();
    expect(screen.queryByText(messages.settings.unavailableTitle)).toBeNull();
  });

  it("marks dirty edits and PATCHes null when Kindle email is cleared", async () => {
    callMock.mockResolvedValueOnce({
      kindle_email: null,
      default_format: "epub",
    });

    renderSettings({ initialKindleEmail: "alex@kindle.com" });

    expect(
      document.querySelector('[data-settings-dirty="false"]')
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: messages.settings.clearKindleEmail })
    );

    expect(document.querySelector('[data-settings-dirty="true"]')).toBeTruthy();
    expect(screen.getByText(messages.settings.unsavedChanges)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: messages.common.save }));

    await waitFor(() => {
      expect(callMock).toHaveBeenCalledTimes(1);
    });

    const [, options] = callMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({
      kindle_email: null,
      default_format: "epub",
    });
  });

  it("distinguishes catalog unavailable from empty", () => {
    const { unmount } = renderCatalog({ tokensUnavailable: true });
    expect(
      document.querySelector('[data-catalog-state="unavailable"]')
    ).toBeTruthy();
    expect(
      screen.getByText(messages.settings.readerCatalog.unavailableTitle)
    ).toBeTruthy();
    expect(
      screen.queryByText(messages.settings.readerCatalog.emptyTitle)
    ).toBeNull();
    unmount();

    renderCatalog({ initialTokens: [] });
    expect(document.querySelector('[data-catalog-state="empty"]')).toBeTruthy();
    expect(
      screen.getByText(messages.settings.readerCatalog.emptyTitle)
    ).toBeTruthy();
    expect(
      screen.queryByText(messages.settings.readerCatalog.unavailableTitle)
    ).toBeNull();
  });

  it("distinguishes QR loading, ready, and error states", async () => {
    let resolveQr: ((value: string) => void) | undefined;
    qrToDataUrl.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveQr = resolve;
        })
    );

    const { unmount } = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <CatalogQrCode url={CATALOG_URL} />
      </NextIntlClientProvider>
    );

    expect(document.querySelector('[data-qr-state="loading"]')).toBeTruthy();
    expect(screen.getByText(messages.settings.readerCatalog.qrLoading)).toBeTruthy();

    resolveQr?.("data:image/png;base64,abc");
    await waitFor(() => {
      expect(document.querySelector('[data-qr-state="ready"]')).toBeTruthy();
    });
    expect(screen.getByAltText(messages.settings.readerCatalog.qrAlt)).toBeTruthy();
    // Do not snapshot the catalog URL or QR payload.
    unmount();

    qrToDataUrl.mockRejectedValueOnce(new Error("qr failed"));
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <CatalogQrCode url={CATALOG_URL} />
      </NextIntlClientProvider>
    );

    await waitFor(() => {
      expect(document.querySelector('[data-qr-state="error"]')).toBeTruthy();
    });
    expect(screen.getByText(messages.settings.readerCatalog.qrError)).toBeTruthy();
    expect(document.querySelector('[data-qr-state="loading"]')).toBeNull();
  });

  it("creates a catalog link once, copies without snapshotting the secret", async () => {
    const created: OpdsTokenCreated = {
      id: "22222222-2222-4222-8222-222222222222",
      label: "KOReader",
      created_at: "2026-02-01T00:00:00.000Z",
      token: "opds-token-secret-not-for-logs",
      url: CATALOG_URL,
    };
    callMock.mockResolvedValueOnce(created);
    qrToDataUrl.mockResolvedValue("data:image/png;base64,ready");

    renderCatalog({ initialTokens: [] });

    fireEvent.click(
      screen.getAllByRole("button", {
        name: messages.settings.readerCatalog.createCta,
      })[0]!
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText(messages.settings.readerCatalog.labelField)
      ).toBeTruthy();
    });

    fireEvent.change(
      screen.getByLabelText(messages.settings.readerCatalog.labelField),
      { target: { value: "KOReader" } }
    );
    fireEvent.click(screen.getByRole("button", { name: messages.common.create }));

    await waitFor(() => {
      expect(document.querySelector("[data-catalog-created]")).toBeTruthy();
    });

    const urlInput = document.querySelector(
      "[data-catalog-url]"
    ) as HTMLInputElement | null;
    expect(urlInput).toBeTruthy();
    expect(urlInput!.value).toBe(CATALOG_URL);

    fireEvent.click(
      screen.getByRole("button", {
        name: messages.settings.readerCatalog.copyUrlAria,
      })
    );

    await waitFor(() => {
      expect(copyMock).toHaveBeenCalledWith(CATALOG_URL);
    });
    // Explicitly no snapshot — catalog URL must never enter snapshot artifacts.
  });

  it("revokes a catalog link and removes it from the list", async () => {
    const token = baseToken();
    callMock.mockResolvedValueOnce(undefined);

    renderCatalog({ initialTokens: [token] });

    expect(document.querySelectorAll(`[data-token-id="${token.id}"]`).length).toBeGreaterThan(
      0
    );

    fireEvent.click(
      screen.getAllByRole("button", {
        name: messages.settings.readerCatalog.revoke,
      })[0]!
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: messages.settings.readerCatalog.revokeConfirmTitle,
        })
      ).toBeTruthy();
    });

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(
        messages.settings.readerCatalog.revokeConfirmDescription
      )
    ).toBeTruthy();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: messages.settings.readerCatalog.revoke,
      })
    );

    await waitFor(() => {
      expect(callMock).toHaveBeenCalledWith(
        "/api/v1/opds/tokens/revoke",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(document.querySelector(`[data-token-id="${token.id}"]`)).toBeNull();
    });
  });
});
