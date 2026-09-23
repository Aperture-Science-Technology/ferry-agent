/**
 * Pen Settings rebuild: Header/PageTitle (EYJrN / mF005b) + Form/Field + OPDS cards,
 * no table / SaaS section chrome / Sources·Devices shortcuts / EmptyState·StatePanel.
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
  it("renders Pen Form/Fields and OPDS cards (not a table)", () => {
    renderSettings("fr");

    expect(screen.getByTestId("settings-pen-layout")).toBeTruthy();
    expect(screen.getByTestId("settings-delivery")).toBeTruthy();
    expect(screen.getByTestId("settings-opds")).toBeTruthy();
    expect(screen.getByTestId("settings-body")).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messagesFr.settings.deliveryPreferencesTitle,
        hidden: true,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messagesFr.settings.readerCatalogTitle,
        hidden: true,
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
    expect(
      within(cards[0]!).getAllByText((_, node) => {
        if (node?.tagName !== "SPAN") return false;
        const text = node.textContent ?? "";
        return (
          text.includes(messagesFr.settings.readerCatalog.actionsHintMobile) ||
          text.includes(messagesFr.settings.readerCatalog.actionsHint)
        );
      }).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("exposes dedicated mobile and desktop headers (mF005b / Hd0003)", () => {
    renderSettings("fr");
    const mobile = screen.getByTestId("settings-header-mobile");
    const desktop = screen.getByTestId("settings-header-desktop");
    expect(mobile.className).toMatch(/md:hidden/);
    expect(desktop.className).toMatch(/hidden/);
    expect(desktop.className).toMatch(/md:flex/);
    expect(within(mobile).getByText("Ferry Agent")).toBeTruthy();
    expect(mobile.querySelector("h1")?.textContent).toBe("Réglages");
    expect(desktop.querySelector("h1")?.textContent).toBe("Réglages");
    expect(desktop.querySelector("h1")?.className).toMatch(/text-\[28px\]/);
    expect(mobile.querySelector("h1")?.className).toMatch(/text-\[22px\]/);
    expect(within(desktop).queryByText("Ferry Agent")).toBeNull();
    expect(
      within(mobile).getByText(messagesFr.pages.settings.descriptionMobile)
    ).toBeTruthy();
    expect(
      within(desktop).getByText(messagesFr.pages.settings.description)
    ).toBeTruthy();
  });

  it("drops Sources/Devices shortcut chrome and keeps FR/EN field identity", () => {
    const { unmount } = renderSettings("fr");
    expect(screen.queryByText(messagesFr.settings.sourcesTitle)).toBeNull();
    expect(screen.queryByText(messagesFr.settings.devicesTitle)).toBeNull();
    expect(screen.queryByText(messagesFr.settings.sourcesCta)).toBeNull();
    expect(screen.getByLabelText(messagesFr.settings.kindleEmail)).toBeTruthy();
    expect(screen.getByLabelText(messagesFr.settings.defaultFormat)).toBeTruthy();
    expect(document.querySelector("[data-testid='state-panel']")).toBeNull();
    unmount();

    renderSettings("en");
    expect(
      screen.getByTestId("settings-header-desktop").querySelector("h1")
        ?.textContent
    ).toBe("Settings");
    expect(
      within(screen.getByTestId("settings-header-desktop")).getByText(
        messagesEn.pages.settings.description
      )
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
    expect(layout.className).toMatch(/min-w-0/);
    expect(layout.querySelector("table")).toBeNull();
    expect(document.querySelector("thead")).toBeNull();
    expect(screen.getAllByTestId("opds-token-card").length).toBe(2);
  });
});
