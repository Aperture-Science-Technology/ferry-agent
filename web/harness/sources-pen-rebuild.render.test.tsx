/**
 * Pen Sources rebuild (ba89b7b): PageHeader + gateway hint + local panel,
 * SourceRows (not a table), FR/EN provider identity, real toggle API.
 * Run: npm run test:ui-harness
 */
import { render, screen, within, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { SourcesView } from "@/components/app/sources/sources-view";
import type { Source } from "@/lib/types";
import messagesFr from "@/messages/fr.json";
import messagesEn from "@/messages/en.json";

const callMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
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
  beforeEach(() => {
    callMock.mockReset();
    callMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/gateways") return [];
      throw new Error(`unexpected call: ${path}`);
    });
  });

  it("renders SourceRows (not a table) with provider → meta hierarchy", async () => {
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

    await waitFor(() => {
      expect(
        screen.getByTestId("sources-gateway-hint").getAttribute("data-gateway-hint")
      ).toBe("none");
    });
  });

  it("uses PageHeader with Sources title (Header/Page already conforme)", () => {
    renderSources("fr");
    const layout = screen.getByTestId("sources-pen-layout");
    const title = within(layout).getByRole("heading", {
      level: 1,
      name: "Sources",
    });
    expect(title.className).toMatch(/text-\[28px\]/);
    expect(title.className).toMatch(/font-bold/);
    expect(screen.queryByTestId("sources-header-mobile")).toBeNull();
    expect(screen.queryByTestId("sources-header-desktop")).toBeNull();
  });

  it("shows gateway hint and local panel without SaaS section chrome", async () => {
    const { unmount } = renderSources("fr");
    expect(
      screen.getByRole("heading", { level: 1, name: "Sources" })
    ).toBeTruthy();
    expect(screen.getByTestId("sources-gateway-hint")).toBeTruthy();
    expect(screen.getByText(messagesFr.sources.gatewayHintBody)).toBeTruthy();
    expect(screen.getByTestId("sources-panel")).toBeTruthy();
    expect(screen.getByText(messagesFr.sources.localSourcesTitle)).toBeTruthy();
    expect(screen.getByText("4 sources")).toBeTruthy();
    expect(screen.queryByText(messagesFr.sources.sectionTitle)).toBeNull();
    expect(screen.queryByText(messagesFr.sources.openAccessTitle)).toBeNull();
    expect(screen.queryByText(messagesFr.sources.supportedHint)).toBeNull();
    unmount();

    renderSources("en");
    expect(
      screen.getByRole("heading", { level: 1, name: "Sources" })
    ).toBeTruthy();
    expect(screen.getByText(messagesEn.sources.gatewayHintBody)).toBeTruthy();
    expect(screen.getByText(messagesEn.sources.localSourcesTitle)).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: messagesEn.sources.providers.gutenberg.name,
      })
    ).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByTestId("sources-gateway-hint").getAttribute("data-gateway-hint")
      ).toBe("none");
    });
  });

  it("does not claim Gateway connected when the list is empty", async () => {
    renderSources("fr");
    await waitFor(() => {
      expect(
        screen.getByTestId("sources-gateway-hint").getAttribute("data-gateway-hint")
      ).toBe("none");
    });
    expect(screen.getByText(messagesFr.sources.gatewayHintTitleNone)).toBeTruthy();
    expect(
      screen.queryByText(messagesFr.sources.gatewayHintTitleConnected)
    ).toBeNull();
  });

  it("does not crush into a desktop table markup at mobile density", () => {
    renderSources("fr");
    const layout = screen.getByTestId("sources-pen-layout");
    expect(layout.className).toMatch(/min-w-0/);
    expect(layout.className).toMatch(/gap-5/);
    expect(screen.getByTestId("sources-body")).toBeTruthy();
    expect(screen.getByTestId("sources-panel")).toBeTruthy();
    expect(layout.querySelector("table")).toBeNull();
    expect(screen.getAllByTestId("source-row").length).toBe(4);
  });
});
