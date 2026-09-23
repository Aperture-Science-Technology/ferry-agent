/**
 * Library empty vs unavailable: an API failure must not render the empty-library CTA.
 * Run: npm run test:ui-harness
 */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { LibraryView } from "@/components/app/library/library-view";
import messages from "@/messages/fr.json";

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
    call: vi.fn(async () => {
      throw new Error("unused");
    }),
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

describe("UI harness — library unavailable vs empty", () => {
  it("shows the unavailable state (not empty CTAs) when the API failed", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <LibraryView
          title="Bibliothèque"
          description="Votre collection."
          initialItems={[]}
          itemsUnavailable
          itemsPartial={false}
          devices={[]}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(
      screen.getByText("Impossible d'afficher votre bibliothèque")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.queryByText("Votre bibliothèque commence ici")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Rechercher dans les sources" })
    ).toBeNull();
  });
});
