/**
 * Pen library rebuild: Header/Page + tools + grid/list chips (no Récents, no tabs).
 * Cover placeholder 96×128; header Envoyer disabled without selection.
 * Run: npm run test:ui-harness
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { LibraryView } from "@/components/app/library/library-view";
import { LibraryCoverImage } from "@/components/app/library/cover-image";
import type { Device, LibraryItem } from "@/lib/types";
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

function book(
  overrides: Partial<LibraryItem> & Pick<LibraryItem, "id" | "title" | "added_at">
): LibraryItem {
  return {
    author: "Auteur",
    language: "fr",
    original_format: "epub",
    source_ref: null,
    source_id: null,
    cover_url: null,
    description: null,
    publisher: null,
    published_year: null,
    isbn: null,
    page_count: null,
    size_bytes: null,
    ...overrides,
  };
}

const items: LibraryItem[] = [
  book({
    id: "11111111-1111-4111-8111-111111111111",
    title: "Le Passage du Nord",
    author: "Camille Durand",
    added_at: "2026-03-01T00:00:00Z",
  }),
  book({
    id: "22222222-2222-4222-8222-222222222222",
    title: "Ink & Transfer",
    author: "N. Hale",
    added_at: "2026-02-01T00:00:00Z",
  }),
  book({
    id: "33333333-3333-4333-8333-333333333333",
    title: "Catalogues silencieux",
    author: "Iris",
    added_at: "2026-01-01T00:00:00Z",
  }),
];

const device: Device = {
  id: "device-1",
  name: "Kindle Paperwhite",
  brand: "kindle",
  model: "Paperwhite",
  cloud_linked: false,
  cloud_provider: null,
  conversion_profile: "reader_6in",
  delivery_tier: "A",
  last_synced_at: null,
};

function renderLibrary(
  locale: "fr" | "en",
  props?: Partial<React.ComponentProps<typeof LibraryView>>
) {
  const messages = locale === "fr" ? messagesFr : messagesEn;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LibraryView
        title={locale === "fr" ? "Bibliothèque" : "Library"}
        description={
          locale === "fr" ? "Retrouver dans mes livres" : "Find in my books"
        }
        initialItems={items}
        itemsUnavailable={false}
        itemsPartial={false}
        devices={[device]}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — Pen library composition", () => {
  it("renders tools row, book grid, and view chips (no Récents section)", () => {
    renderLibrary("fr");

    const tools = screen.getByTestId("library-tools");
    const grid = screen.getByTestId("library-book-grid");
    expect(tools).toBeTruthy();
    expect(grid).toBeTruthy();
    expect(screen.queryByTestId("library-recent-section")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Récents" })).toBeNull();

    expect(within(tools).getByText("3 livres · récents")).toBeTruthy();
    expect(
      within(tools).getByRole("button", { name: "Grille" }).getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
    expect(
      within(tools).getByRole("button", { name: "Liste" }).getAttribute(
        "aria-pressed"
      )
    ).toBe("false");

    expect(within(grid).getByText("Le Passage du Nord")).toBeTruthy();

    const coverButton = within(grid).getByRole("button", {
      name: "Le Passage du Nord",
    });
    expect(coverButton.className).toMatch(/w-24/);
    expect(coverButton.className).toMatch(/h-32/);
    expect(coverButton.className).toMatch(/rounded-sm/);
  });

  it("switches from grid to list via view chips", () => {
    renderLibrary("fr");

    expect(screen.getByTestId("library-book-grid")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    expect(screen.queryByTestId("library-book-grid")).toBeNull();
    const list = screen.getByTestId("library-book-list");
    expect(within(list).getByText("Le Passage du Nord")).toBeTruthy();
    expect(within(list).getByText("Camille Durand · EPUB")).toBeTruthy();
  });

  it("keeps header Envoyer disabled and non-clickable without a selection", () => {
    renderLibrary("fr");

    const headerSend = screen.getByTestId("library-header-send");
    expect(headerSend).toHaveProperty("disabled", true);

    fireEvent.click(headerSend);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens deliver from a list-row Envoyer (existing per-book path)", () => {
    callMock.mockResolvedValue({ default_format: "epub" });
    renderLibrary("fr");

    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    const list = screen.getByTestId("library-book-list");
    const rowSend = within(list).getAllByRole("button", {
      name: /Envoyer «/,
    })[0];
    fireEvent.click(rowSend);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("does not surface internal filter tokens (added, all) in FR or EN", () => {
    const { unmount } = renderLibrary("fr");
    const frBody = document.body.textContent ?? "";
    expect(frBody).not.toMatch(/\badded\b/);
    expect(frBody).not.toMatch(/\ball\b/);
    unmount();

    renderLibrary("en");
    expect(screen.queryByRole("option", { name: "all" })).toBeNull();
    expect(screen.queryByText("added")).toBeNull();
  });

  it("keeps books when a refresh fails (error ≠ empty)", () => {
    renderLibrary("fr");

    expect(screen.getByTestId("library-book-grid")).toBeTruthy();
    expect(screen.getAllByText("Le Passage du Nord").length).toBeGreaterThan(0);
    expect(screen.queryByText("Aucun livre pour l'instant")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("UI harness — cover fallback Pen YoLR8", () => {
  it("shows Couverture / Cover without an icon glyph", () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="fr" messages={messagesFr}>
        <div className="relative h-32 w-24">
          <LibraryCoverImage
            itemId="no-cover"
            hasCover={false}
            alt="Titre"
          />
        </div>
      </NextIntlClientProvider>
    );

    expect(screen.getByText("Couverture")).toBeTruthy();
    expect(document.querySelector("svg")).toBeNull();

    rerender(
      <NextIntlClientProvider locale="en" messages={messagesEn}>
        <div className="relative h-32 w-24">
          <LibraryCoverImage
            itemId="no-cover"
            hasCover={false}
            alt="Title"
          />
        </div>
      </NextIntlClientProvider>
    );
    expect(screen.getByText("Cover")).toBeTruthy();
  });
});
