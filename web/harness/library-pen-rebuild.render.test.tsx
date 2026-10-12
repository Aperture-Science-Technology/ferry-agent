/**
 * Pen library rebuild: Header/Page + tools + grid/list chips (no Récents, no tabs).
 * Cover placeholder 96×128; header Envoyer disabled without selection.
 * Run: npm run test:ui-harness
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LibraryView } from "@/components/app/library/library-view";
import { LibraryCoverImage } from "@/components/app/library/cover-image";
import type { Device, LibraryItem } from "@/lib/types";
import messagesFr from "@/messages/fr.json";
import messagesEn from "@/messages/en.json";

const callMock = vi.fn();
beforeEach(() => {
  window.history.replaceState(null, "", "/library");
  callMock.mockReset().mockResolvedValue([]);
});

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


describe("UI harness — search query criteria", () => {
  it("replays a shared URL and applies the language filter on the server", async () => {
    window.history.replaceState(null, "", "/library?q=book&lang=fr&fmt=epub&src=gutenberg&owned=1&sort=title");
    callMock.mockImplementation(async (_path, init) => {
      const body = JSON.parse(init.body);
      return body.filters.language === "fr" ? [{
        source: "gutenberg", result_id: "1", title: "Livre français", author: "Auteur",
        format: "epub", owned: true,
      }] : [];
    });
    renderLibrary("fr");
    expect(screen.getByRole("group", { name: "Filtres et affichage" })).toBeTruthy();
    expect(await screen.findByText("Livre français")).toBeTruthy();
    expect(JSON.parse(callMock.mock.calls[0][1].body)).toEqual({
      query: "book", scope: ["legal", "gateways"],
      filters: { language: "fr", formats: ["epub"], sources: ["gutenberg"], owned: true },
      sort: "title", limit: 25, offset: 0,
    });
    expect(screen.getByRole("switch", { name: "Déjà en bibliothèque" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.change(screen.getByLabelText("Langue"), { target: { value: "en" } });
    await waitFor(() => expect(screen.queryByText("Livre français")).toBeNull());
    expect(await screen.findByText(messagesFr.library.noResultsHint)).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get("lang")).toBe("en");
    expect(JSON.parse(callMock.mock.lastCall![1].body).filters.language).toBe("en");
  });

  it("restores collection criteria and updates the URL when filtering", () => {
    window.history.replaceState(null, "", "/library?mode=mine&lang=fr&fmt=epub&src=manual&sort=title");
    renderLibrary("fr", { initialItems: [items[0], { ...items[1], language: "en" }] });
    expect(screen.getByText(items[0].title)).toBeTruthy();
    expect(screen.queryByText(items[1].title)).toBeNull();
    fireEvent.change(screen.getByLabelText("Langue"), { target: { value: "en" } });
    expect(screen.queryByText(items[0].title)).toBeNull();
    expect(screen.getByText(items[1].title)).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get("lang")).toBe("en");
    expect(callMock).not.toHaveBeenCalled();
  });

  it("requests the next page and resets it when filters change", async () => {
    window.history.replaceState(null, "", "/library?q=book");
    callMock.mockImplementation(async (_path, init) => {
      const body = JSON.parse(init.body);
      return Array.from({ length: body.offset ? 1 : 25 }, (_, index) => ({
        source: "gutenberg", result_id: String(body.offset + index),
        title: `Book ${body.offset + index}`, format: "epub", author: "Author",
      }));
    });
    renderLibrary("en");
    expect(await screen.findByText("Book 0")).toBeTruthy();
    expect(screen.queryByText("Book 24")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Book 24")).toBeTruthy();
    expect(JSON.parse(callMock.mock.lastCall![1].body).offset).toBe(24);
    expect(screen.getByRole("button", { name: "Next page" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "fr" } });
    expect(await screen.findByText("Book 0")).toBeTruthy();
    expect(JSON.parse(callMock.mock.lastCall![1].body).offset).toBe(0);
  });

  it("ignores an older response and restores criteria on browser navigation", async () => {
    window.history.replaceState(null, "", "/library?q=book&lang=fr");
    let resolveOld!: (value: unknown[]) => void;
    callMock.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValue([]);
    renderLibrary("en");
    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText(messagesEn.library.searching)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "en" } });
    expect(await screen.findByText(messagesEn.library.noResultsHint)).toBeTruthy();
    await act(async () => resolveOld([{ title: "Stale result", source: "gutenberg", result_id: "1" }]));
    expect(screen.queryByText("Stale result")).toBeNull();
    act(() => {
      window.history.replaceState(null, "", "/library?q=book&lang=de");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => expect(JSON.parse(callMock.mock.lastCall![1].body).filters.language).toBe("de"));
    expect(screen.getByLabelText("Language")).toHaveProperty("value", "de");
  });
});
