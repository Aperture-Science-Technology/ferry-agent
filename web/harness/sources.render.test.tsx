/**
 * Sources surface: PATCH failure restores previous state; unknown/missing
 * providers are never shown as enabled; unavailable ≠ empty ≠ partial ≠ error.
 * Run: npm run test:ui-harness
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { SourcesManager } from "@/components/app/sources/sources-manager";
import type { Source } from "@/lib/types";
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

function baseSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    type: "gutenberg",
    enabled: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderSources(
  props: {
    initialSources?: Source[];
    sourcesUnavailable?: boolean;
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <SourcesManager
        initialSources={props.initialSources ?? []}
        sourcesUnavailable={props.sourcesUnavailable ?? false}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — sources", () => {
  beforeEach(() => {
    callMock.mockReset();
  });

  it("keeps unavailable, empty, partial and success distinct", () => {
    const { unmount } = renderSources({ sourcesUnavailable: true });
    expect(document.querySelector('[data-sources-state="unavailable"]')).toBeTruthy();
    expect(screen.getByText(messages.sources.unavailableTitle)).toBeTruthy();
    expect(screen.queryByText(messages.sources.emptyTitle)).toBeNull();
    unmount();

    const empty = renderSources({ initialSources: [] });
    expect(document.querySelector('[data-sources-state="empty"]')).toBeTruthy();
    expect(screen.getByText(messages.sources.emptyTitle)).toBeTruthy();
    expect(screen.queryByText(messages.sources.unavailableTitle)).toBeNull();
    empty.unmount();

    const partial = renderSources({
      initialSources: [
        baseSource({ type: "gutenberg", enabled: true }),
        baseSource({
          id: "22222222-2222-4222-8222-222222222222",
          type: "upload",
          enabled: true,
        }),
      ],
    });
    expect(document.querySelector('[data-sources-state="partial"]')).toBeTruthy();
    expect(screen.getByText(messages.sources.partialTitle)).toBeTruthy();
    const standard = document.querySelector(
      '[data-source-type="standard_ebooks"]'
    );
    expect(standard?.getAttribute("data-source-availability")).toBe("unknown");
    expect(
      screen.queryByLabelText(
        messages.sources.disableAria.replace(
          "{name}",
          messages.sources.providers.standardEbooks.name
        )
      )
    ).toBeNull();
    partial.unmount();

    renderSources({
      initialSources: [
        baseSource({ type: "gutenberg", enabled: true }),
        baseSource({
          id: "33333333-3333-4333-8333-333333333333",
          type: "standard_ebooks",
          enabled: false,
        }),
      ],
    });
    expect(document.querySelector('[data-sources-state="success"]')).toBeTruthy();
  });

  it("does not show an unknown provider as enabled or toggleable", () => {
    renderSources({
      initialSources: [
        baseSource({
          id: "44444444-4444-4444-8444-444444444444",
          type: "mystery_provider",
          enabled: true,
        }),
      ],
    });

    const gutenberg = document.querySelector('[data-source-type="gutenberg"]');
    expect(gutenberg?.getAttribute("data-source-availability")).toBe("unknown");
    expect(
      screen.queryByLabelText(
        messages.sources.disableAria.replace(
          "{name}",
          messages.sources.providers.gutenberg.name
        )
      )
    ).toBeNull();
    expect(
      screen.queryByLabelText(
        messages.sources.enableAria.replace(
          "{name}",
          messages.sources.providers.gutenberg.name
        )
      )
    ).toBeNull();
    expect(screen.queryByText("mystery_provider")).toBeNull();
  });

  it("restores the previous enabled state when PATCH fails", async () => {
    callMock.mockRejectedValueOnce(new Error("patch failed"));

    renderSources({
      initialSources: [
        baseSource({ type: "gutenberg", enabled: true }),
        baseSource({
          id: "55555555-5555-4555-8555-555555555555",
          type: "standard_ebooks",
          enabled: false,
        }),
      ],
    });

    const gutenberg = document.querySelector('[data-source-type="gutenberg"]');
    expect(gutenberg?.getAttribute("data-source-availability")).toBe("enabled");

    const disableSwitch = screen.getByLabelText(
      messages.sources.disableAria.replace(
        "{name}",
        messages.sources.providers.gutenberg.name
      )
    );
    fireEvent.click(disableSwitch);

    await waitFor(() => {
      expect(callMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(document.querySelector('[data-sources-state="error"]')).toBeTruthy();
    });

    expect(
      document
        .querySelector('[data-source-type="gutenberg"]')
        ?.getAttribute("data-source-availability")
    ).toBe("enabled");
    expect(screen.getByText(messages.sources.updateErrorTitle)).toBeTruthy();
    expect(screen.getByText(messages.sources.toastUpdateFailed)).toBeTruthy();
  });

  it("toggles a known source on successful PATCH", async () => {
    callMock.mockResolvedValueOnce(
      baseSource({ type: "gutenberg", enabled: false })
    );

    renderSources({
      initialSources: [
        baseSource({ type: "gutenberg", enabled: true }),
        baseSource({
          id: "66666666-6666-4666-8666-666666666666",
          type: "standard_ebooks",
          enabled: true,
        }),
      ],
    });

    fireEvent.click(
      screen.getByLabelText(
        messages.sources.disableAria.replace(
          "{name}",
          messages.sources.providers.gutenberg.name
        )
      )
    );

    await waitFor(() => {
      expect(
        document
          .querySelector('[data-source-type="gutenberg"]')
          ?.getAttribute("data-source-availability")
      ).toBe("disabled");
    });

    expect(callMock).toHaveBeenCalledWith(
      "/api/v1/sources/11111111-1111-4111-8111-111111111111",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      })
    );
  });
});
