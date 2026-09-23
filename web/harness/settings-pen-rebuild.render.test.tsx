/**
 * Pen Settings rebuild: Header/PageTitle + Form/Field + OPDS cards,
 * no table / SaaS section chrome / Sources·Devices shortcuts.
 * Run: npm run test:ui-harness
 */
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { SettingsForm } from "@/components/app/settings/settings-form";
import type { OpdsToken } from "@/lib/types";
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
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

function baseToken(overrides: Partial<OpdsToken> = {}): OpdsToken {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    label: "Kobo Clara",
    created_at: "2026-01-01T00:00:00.000Z",
    last_used_at: null,
    ...overrides,
  };
}

function renderSettings(locale: "fr" | "en", tokens: OpdsToken[] = [baseToken()]) {
  const messages = locale === "fr" ? messagesFr : messagesEn;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SettingsForm
        title={messages.pages.settings.title}
        description={messages.pages.settings.description}
        descriptionMobile={messages.pages.settings.descriptionMobile}
        initialEmail="alex@example.com"
        initialKindleEmail="alex@kindle.com"
        initialDefaultFormat="epub"
        settingsUnavailable={false}
        initialOpdsTokens={tokens}
        opdsTokensUnavailable={false}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — Pen settings composition", () => {
  it("renders Pen header, Form/Fields, and OPDS cards (not a table)", () => {
    renderSettings("fr");

    expect(screen.getByTestId("settings-pen-layout")).toBeTruthy();
    expect(screen.getByTestId("settings-delivery")).toBeTruthy();
    expect(screen.getByTestId("settings-opds")).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();

    expect(
      screen.getByRole("heading", { level: 1, name: "Réglages" })
    ).toBeTruthy();
    expect(
      screen.getByText(messagesFr.pages.settings.description)
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messagesFr.settings.deliveryPreferencesTitle,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messagesFr.settings.readerCatalogTitle,
      })
    ).toBeTruthy();

    const fields = screen.getAllByTestId("settings-field");
    expect(fields.length).toBeGreaterThanOrEqual(2);

    const cards = screen.getAllByTestId("opds-token-card");
    expect(cards.length).toBe(1);
    expect(
      within(cards[0]!).getByRole("heading", {
        name: messagesFr.settings.readerCatalog.tokenTitle.replace(
          "{label}",
          "Kobo Clara"
        ),
      })
    ).toBeTruthy();
  });

  it("drops Sources/Devices shortcut chrome and keeps FR/EN field identity", () => {
    const { unmount } = renderSettings("fr");
    expect(screen.queryByText(messagesFr.settings.sourcesTitle)).toBeNull();
    expect(screen.queryByText(messagesFr.settings.devicesTitle)).toBeNull();
    expect(screen.queryByText(messagesFr.settings.sourcesCta)).toBeNull();
    expect(screen.getByLabelText(messagesFr.settings.kindleEmail)).toBeTruthy();
    expect(screen.getByLabelText(messagesFr.settings.defaultFormat)).toBeTruthy();
    unmount();

    renderSettings("en");
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" })
    ).toBeTruthy();
    expect(
      screen.getByText(messagesEn.pages.settings.description)
    ).toBeTruthy();
    expect(screen.getByLabelText(messagesEn.settings.kindleEmail)).toBeTruthy();
    expect(screen.queryByText(messagesEn.settings.sourcesCta)).toBeNull();
    expect(document.querySelector("table")).toBeNull();
  });

  it("does not crush OPDS tokens into desktop table markup", () => {
    renderSettings("fr", [
      baseToken(),
      baseToken({
        id: "22222222-2222-4222-8222-222222222222",
        label: "KOReader",
      }),
    ]);
    const layout = screen.getByTestId("settings-pen-layout");
    expect(layout.querySelector("table")).toBeNull();
    expect(screen.getAllByTestId("opds-token-card").length).toBe(2);
  });
});
