/**
 * Pen Sources rebuild: SourceRows (FXBHb / mF0050), no table/SaaS cards,
 * header Sources + cloud/Gateway subtitle, FR/EN provider identity.
 * Run: npm run test:ui-harness
 */
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { SourcesView } from "@/components/app/sources/sources-view";
import type { Source } from "@/lib/types";
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
}));

function baseSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    type: "gutenberg",
    enabled: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const filledSources: Source[] = [
  baseSource({ type: "gutenberg", enabled: true }),
  baseSource({
    id: "22222222-2222-4222-8222-222222222222",
    type: "standard_ebooks",
    enabled: true,
  }),
  baseSource({
    id: "33333333-3333-4333-8333-333333333333",
    type: "upload",
    enabled: true,
  }),
];

function renderSources(locale: "fr" | "en") {
  const messages = locale === "fr" ? messagesFr : messagesEn;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SourcesView
        title={messages.pages.sources.title}
        description={messages.pages.sources.description}
        descriptionMobile={messages.pages.sources.descriptionMobile}
        initialSources={filledSources}
        sourcesUnavailable={false}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — Pen sources composition", () => {
  it("renders SourceRows (not a table) with provider → meta hierarchy", () => {
    renderSources("fr");

    expect(screen.getByTestId("sources-pen-layout")).toBeTruthy();
    expect(screen.getByTestId("sources-rows")).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();

    const rows = screen.getAllByTestId("source-row");
    expect(rows.length).toBe(4);

    expect(
      within(rows[0]!).getByRole("heading", {
        name: messagesFr.sources.providers.gutenberg.name,
      })
    ).toBeTruthy();
    expect(rows[0]!.getAttribute("data-source-type")).toBe("gutenberg");
    expect(rows[0]!.getAttribute("data-source-availability")).toBe("enabled");

    expect(
      within(rows[1]!).getByRole("heading", {
        name: messagesFr.sources.providers.standardEbooks.name,
      })
    ).toBeTruthy();
    expect(
      within(rows[2]!).getByRole("heading", {
        name: messagesFr.sources.providers.upload.name,
      })
    ).toBeTruthy();
    expect(rows[2]!.getAttribute("data-source-availability")).toBe("always_on");
    expect(
      within(rows[3]!).getByRole("heading", {
        name: messagesFr.sources.providers.torrentGateway.name,
      })
    ).toBeTruthy();
    expect(rows[3]!.getAttribute("data-source-availability")).toBe("gateway");
  });

  it("shows Pen page header and supported hint without SaaS section chrome", () => {
    const { unmount } = renderSources("fr");
    expect(
      screen.getByRole("heading", { level: 1, name: "Sources" })
    ).toBeTruthy();
    expect(
      screen.getByText(messagesFr.pages.sources.description)
    ).toBeTruthy();
    expect(screen.getByText(messagesFr.sources.supportedHint)).toBeTruthy();
    expect(screen.queryByText(messagesFr.sources.sectionTitle)).toBeNull();
    expect(screen.queryByText(messagesFr.sources.openAccessTitle)).toBeNull();
    expect(screen.queryByText(messagesFr.sources.localTitle)).toBeNull();
    unmount();

    renderSources("en");
    expect(
      screen.getByRole("heading", { level: 1, name: "Sources" })
    ).toBeTruthy();
    expect(
      screen.getByText(messagesEn.pages.sources.description)
    ).toBeTruthy();
    expect(screen.getByText(messagesEn.sources.supportedHint)).toBeTruthy();
    expect(screen.queryByText(messagesEn.sources.sectionTitle)).toBeNull();
    expect(
      screen.getByRole("heading", {
        name: messagesEn.sources.providers.gutenberg.name,
      })
    ).toBeTruthy();
  });

  it("does not crush into a desktop table markup at mobile density", () => {
    renderSources("fr");
    const layout = screen.getByTestId("sources-pen-layout");
    expect(layout.querySelector("table")).toBeNull();
    expect(screen.getAllByTestId("source-row").length).toBe(4);
  });
});
