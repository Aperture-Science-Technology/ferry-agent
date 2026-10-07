/**
 * Docs guide polish harness: no illustration, success callouts, expanded glossary,
 * step-by-step terminal commands, i18n symmetry.
 * Run: npm run test:ui-harness
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { ByoInstallGuide } from "@/components/docs/byo-install-guide";
import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn() }),
}));

function renderGuide(locale: "fr" | "en") {
  const messages = locale === "fr" ? frMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ByoInstallGuide />
    </NextIntlClientProvider>
  );
}

function assertExpandedGlossary(
  entries: { term: string; def: string }[]
) {
  for (const { term, def } of entries) {
    expect(def.length).toBeGreaterThanOrEqual(140);
    fireEvent.click(screen.getByRole("button", { name: term }));
    expect(document.body.textContent ?? "").toContain(def);
  }
}

describe("UI harness — docs guide polish", () => {
  it("renders FR guide without illustration, with success callouts and expanded glossary", () => {
    const { container } = renderGuide("fr");

    expect(container.querySelector('img[src*="cloud-gateway"]')).toBeNull();

    const successBoxes = container.querySelectorAll(
      '[data-testid="step-success"]'
    );
    expect(successBoxes).toHaveLength(5);
    for (const box of successBoxes) {
      expect(box.textContent).toContain(frMessages.docs.stepSuccessLabel);
    }

    assertExpandedGlossary([
      {
        term: frMessages.docs.glossaryAccessTerm,
        def: frMessages.docs.glossaryAccessDef,
      },
      {
        term: frMessages.docs.glossaryCodesTerm,
        def: frMessages.docs.glossaryCodesDef,
      },
      {
        term: frMessages.docs.glossaryIndexerTerm,
        def: frMessages.docs.glossaryIndexerDef,
      },
      {
        term: frMessages.docs.glossaryProwlarrTerm,
        def: frMessages.docs.glossaryProwlarrDef,
      },
    ]);

    const text = document.body.textContent ?? "";
    const pres = container.querySelectorAll("pre");
    expect(pres).toHaveLength(7);
    expect(text).toContain("docker exec ferry-gateway cat /config/prowlarr-credentials");
    expect(text).toContain("Créer un dossier pour le Gateway");
    expect(text).toContain("Télécharger le fichier de démarrage");
    expect(text).toContain("Enregistrer votre code de connexion");
    expect(text).toContain("Démarrer le Gateway");
    expect(text).toContain("Ajouter un indexeur");
    expect(text).toContain("sans indexeur");
    expect(text).toContain("document personnel");
    expect(text).toContain("PROWLARR_USER");
    expect(text).toContain("PROWLARR_PASSWORD");
  });

  it("renders EN guide without illustration, with success callouts and expanded glossary", () => {
    const { container } = renderGuide("en");

    expect(container.querySelector('img[src*="cloud-gateway"]')).toBeNull();

    const successBoxes = container.querySelectorAll(
      '[data-testid="step-success"]'
    );
    expect(successBoxes).toHaveLength(5);
    for (const box of successBoxes) {
      expect(box.textContent).toContain(enMessages.docs.stepSuccessLabel);
    }

    assertExpandedGlossary([
      {
        term: enMessages.docs.glossaryAccessTerm,
        def: enMessages.docs.glossaryAccessDef,
      },
      {
        term: enMessages.docs.glossaryCodesTerm,
        def: enMessages.docs.glossaryCodesDef,
      },
      {
        term: enMessages.docs.glossaryIndexerTerm,
        def: enMessages.docs.glossaryIndexerDef,
      },
      {
        term: enMessages.docs.glossaryProwlarrTerm,
        def: enMessages.docs.glossaryProwlarrDef,
      },
    ]);

    const text = document.body.textContent ?? "";
    const pres = container.querySelectorAll("pre");
    expect(pres).toHaveLength(7);
    expect(text).toContain("docker exec ferry-gateway cat /config/prowlarr-credentials");
    expect(text).toContain("Create a folder for the Gateway");
    expect(text).toContain("Download the startup file");
    expect(text).toContain("Save your connection code");
    expect(text).toContain("Start the Gateway");
    expect(text).toContain("Add an indexer");
    expect(text).toContain("without an indexer");
    expect(text).toContain("personal documents");
  });

  it("keeps docs i18n keys symmetric and terminal steps aligned", () => {
    expect(Object.keys(frMessages.docs).sort()).toEqual(
      Object.keys(enMessages.docs).sort()
    );

    const frSteps = frMessages.docs.step4TerminalSteps;
    const enSteps = enMessages.docs.step4TerminalSteps;
    expect(frSteps).toHaveLength(6);
    expect(enSteps).toHaveLength(6);

    for (let i = 0; i < 6; i++) {
      expect(Object.keys(frSteps[i]).sort()).toEqual(["command", "label"]);
      expect(Object.keys(enSteps[i]).sort()).toEqual(["command", "label"]);
    }
  });
});
