/**
 * Pen Settings rebuild: Header/PageTitle + Form/Field + OPDS rows in Settings,
 * Compte / OPDS / Préférences sections (no standalone OPDS route).
 * Run: npm run test:ui-harness
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsForm } from "@/components/app/settings/settings-form";
import type { OpdsToken } from "@/lib/types";
import messagesFr from "@/messages/fr.json";
import messagesEn from "@/messages/en.json";

const routerMock = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

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
  usePathname: () => "/app/reglages",
  useRouter: () => routerMock,
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

function renderSettings(
  locale: "fr" | "en",
  tokens: OpdsToken[] = [baseToken()],
  mailSettings: {
    configured: boolean;
    sender_address: string;
  } | null = {
    configured: true,
    sender_address: "send@ferry-agent.aperture-agency.org",
  }
) {
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
        initialMailSettings={mailSettings}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — Pen settings composition", () => {
  beforeEach(() => {
    routerMock.refresh.mockClear();
    routerMock.replace.mockClear();
  });

  it("renders Pen Form/Fields and OPDS rows (not a table)", () => {
    renderSettings("fr");

    expect(screen.getByTestId("settings-pen-layout")).toBeTruthy();
    expect(screen.getByTestId("settings-delivery")).toBeTruthy();
    expect(screen.getByTestId("settings-opds")).toBeTruthy();
    expect(screen.getByTestId("settings-preferences")).toBeTruthy();
    expect(screen.getByTestId("settings-body")).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messagesFr.settings.accountTitle,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messagesFr.settings.opdsTokensTitle,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messagesFr.settings.preferencesTitle,
      })
    ).toBeTruthy();

    const fields = screen.getAllByTestId("settings-field");
    expect(fields.length).toBeGreaterThanOrEqual(2);
    for (const field of fields) {
      expect(field.className).toMatch(/gap-1\.5/);
      expect(field.className).toMatch(/flex-col/);
    }

    const formatGroup = screen.getByRole("group", {
      name: messagesFr.settings.defaultFormat,
    });
    expect(
      within(formatGroup).getByRole("button", { name: "epub", pressed: true })
    ).toBeTruthy();
    expect(
      within(formatGroup).getByRole("button", { name: "pdf", pressed: false })
    ).toBeTruthy();

    const cards = screen.getAllByTestId("opds-token-card");
    expect(cards.length).toBe(1);
    expect(
      within(cards[0]!).getByRole("heading", {
        name: "Kobo Clara",
      })
    ).toBeTruthy();
    expect(
      within(cards[0]!).getByText(messagesFr.settings.readerCatalog.statusActive)
    ).toBeTruthy();
    expect(
      within(cards[0]!).getByText((_, node) => {
        if (!node || node.children.length > 0) return false;
        const text = node.textContent ?? "";
        return text.includes(messagesFr.settings.readerCatalog.neverUsed);
      })
    ).toBeTruthy();
  });

  it("uses PageHeader with a single Settings title (Pen 06 specimen 40/900)", () => {
    renderSettings("fr");
    const layout = screen.getByTestId("settings-pen-layout");
    const titles = within(layout).getAllByRole("heading", {
      level: 1,
      name: "Réglages",
    });
    expect(titles.length).toBe(1);
    expect(titles[0]!.className).toMatch(/text-\[32px\]/);
    expect(titles[0]!.className).toMatch(/md:text-\[40px\]/);
    expect(titles[0]!.className).toMatch(/font-black/);
    expect(screen.queryByTestId("settings-header-mobile")).toBeNull();
    expect(screen.queryByTestId("settings-header-desktop")).toBeNull();
  });

  it("drops Sources/Devices shortcut chrome and keeps preferences identity", () => {
    const { unmount } = renderSettings("fr");
    expect(screen.queryByText(messagesFr.settings.sourcesTitle)).toBeNull();
    expect(screen.queryByText(messagesFr.settings.devicesTitle)).toBeNull();
    expect(screen.queryByText(messagesFr.settings.sourcesCta)).toBeNull();
    expect(screen.getByLabelText(messagesFr.settings.kindleEmail)).toBeTruthy();
    expect(
      screen.getByRole("group", { name: messagesFr.settings.defaultFormat })
    ).toBeTruthy();
    expect(document.querySelector("[data-testid='state-panel']")).toBeNull();
    expect(screen.getByText(messagesFr.settings.email)).toBeTruthy();
    expect(screen.getByText(messagesFr.settings.languageLabel)).toBeTruthy();
    expect(screen.getByText(messagesFr.settings.documentationLabel)).toBeTruthy();
    unmount();

    renderSettings("en");
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }).textContent
    ).toBe("Settings");
    expect(
      screen.getByText(messagesEn.pages.settings.description)
    ).toBeTruthy();
    expect(screen.getByLabelText(messagesEn.settings.kindleEmail)).toBeTruthy();
    expect(screen.queryByText(messagesEn.settings.sourcesCta)).toBeNull();
    expect(document.querySelector("table")).toBeNull();
  });

  it("opens an explicit language menu; first click does not change locale", () => {
    renderSettings("fr");

    const trigger = screen.getByRole("button", {
      name: messagesFr.locale.choose,
    });
    expect(screen.getByText(messagesFr.settings.languageLabel)).toBeTruthy();
    expect(screen.getByText(messagesFr.settings.languageValueFr)).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(routerMock.replace).not.toHaveBeenCalled();

    const french = screen.getByRole("menuitemradio", {
      name: messagesFr.settings.languageValueFr,
    });
    const english = screen.getByRole("menuitemradio", {
      name: messagesFr.settings.languageValueEn,
    });
    expect(french.getAttribute("aria-checked")).toBe("true");
    expect(english.getAttribute("aria-checked")).toBe("false");

    // Compact popup: must not stretch to the settings-row anchor width.
    const popup = french.closest("[data-slot='dropdown-menu-content']");
    expect(popup).toBeTruthy();
    expect(popup!.className).toMatch(/(?:^|\s)w-auto(?:\s|$)/);
    expect(popup!.className).toMatch(/min-w-44/);
    expect(popup!.className).not.toMatch(/w-\(--anchor-width\)/);

    fireEvent.click(english);
    expect(routerMock.replace).toHaveBeenCalledWith("/app/reglages", {
      locale: "en",
    });
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

  it("renders Send-to-Kindle labels from FR and EN message files", () => {
    const { unmount } = renderSettings("fr");
    const sectionFr = screen.getByTestId("settings-send-to-kindle");
    expect(
      within(sectionFr).getByRole("heading", {
        name: messagesFr.settings.sendToKindleTitle,
      })
    ).toBeTruthy();
    expect(
      within(sectionFr).getByText(messagesFr.settings.sendToKindleDescription)
    ).toBeTruthy();
    expect(
      within(sectionFr).getByText(messagesFr.settings.senderAddressLabel)
    ).toBeTruthy();
    expect(
      within(sectionFr).getByText(messagesFr.settings.sendToKindleStep1)
    ).toBeTruthy();
    expect(
      within(sectionFr).getByText(messagesFr.settings.sendToKindleStep2)
    ).toBeTruthy();
    expect(
      within(sectionFr).getByText(messagesFr.settings.sendToKindleNoBounce)
    ).toBeTruthy();
    expect(
      within(sectionFr).getByRole("link", {
        name: messagesFr.settings.sendToKindleAmazonLink,
      })
    ).toBeTruthy();
    unmount();

    renderSettings("en");
    const sectionEn = screen.getByTestId("settings-send-to-kindle");
    expect(
      within(sectionEn).getByRole("heading", {
        name: messagesEn.settings.sendToKindleTitle,
      })
    ).toBeTruthy();
    expect(
      within(sectionEn).getByText(messagesEn.settings.sendToKindleDescription)
    ).toBeTruthy();
    expect(
      within(sectionEn).getByText(messagesEn.settings.senderAddressLabel)
    ).toBeTruthy();
    expect(
      within(sectionEn).getByRole("link", {
        name: messagesEn.settings.sendToKindleAmazonLink,
      })
    ).toBeTruthy();
  });
});
