/**
 * Gateway start guide harness: Docker Desktop / OrbStack / terminal steps,
 * no tuto-à-trous placeholders (CODE/KEY bare).
 * Run: npm run test:ui-harness
 */
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { GatewayStartGuide } from "@/components/docs/gateway-start-guide";
import messages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";

function renderWithLocale(
  locale: "fr" | "en",
  msgs: typeof messages | typeof enMessages
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={msgs}>
      <GatewayStartGuide />
    </NextIntlClientProvider>
  );
}

function expectTerminalCommands(text: string, firstLabel: string) {
  const pres = document.querySelectorAll("pre");
  expect(pres).toHaveLength(6);
  for (const pre of pres) {
    const lines = (pre.textContent ?? "")
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);
    expect(lines).toHaveLength(1);
  }

  expect(text).toContain(firstLabel);
  expect(text).toContain("mkdir -p ~/ferry-gateway");
  expect(text).toContain("compose.yaml");
  expect(text).toContain("PAIRING_TOKEN");
  expect(text).toContain("GATEWAY_KEY");
  expect(text).toContain("docker load -i");
  expect(text).toContain("ferry-agent-gateway-amd64.tar");
  expect(text).toContain("docker compose up -d");
}

describe("UI harness — Gateway start guide", () => {
  it("renders FR Docker Desktop, OrbStack, and terminal fallback with env vars", () => {
    renderWithLocale("fr", messages);

    const text = document.body.textContent ?? "";
    expect(text).toContain("Docker Desktop");
    expect(text).toContain("OrbStack");
    expect(text).toContain("Terminal");
    expect(text).toContain("PAIRING_TOKEN");
    expect(text).toContain("GATEWAY_KEY");
    expect(text).toContain("/state");
    expect(text).toContain("Optional settings");
    expect(text).toContain("docker compose up -d");
    expect(text).toContain(
      "ferry-agent.aperture-agency.org/bundle/compose.yaml"
    );
    expect(text).toContain("oublie son appairage");
    expect(text).toContain("'VOTRE_CODE_DE_CONNEXION'");
    expectTerminalCommands(text, "Créer un dossier pour le Gateway");
    expect(
      document.querySelectorAll('[data-testid="platform-logo-windows"]').length
    ).toBe(1);
    expect(
      document.querySelectorAll('[data-testid="platform-logo-apple"]').length
    ).toBe(1);
  });

  it("renders EN Docker Desktop, OrbStack, and terminal commands", () => {
    renderWithLocale("en", enMessages);

    const text = document.body.textContent ?? "";
    expect(text).toContain("Docker Desktop");
    expect(text).toContain("OrbStack");
    expect(text).toContain("PAIRING_TOKEN");
    expect(text).toContain("GATEWAY_KEY");
    expect(text).toContain("/state");
    expect(text).toContain("docker compose up -d");
    expect(text).toContain("'YOUR_CONNECTION_CODE'");
    expectTerminalCommands(text, "Create a folder for the Gateway");
    expect(
      document.querySelectorAll('[data-testid="platform-logo-windows"]').length
    ).toBe(1);
    expect(
      document.querySelectorAll('[data-testid="platform-logo-apple"]').length
    ).toBe(1);
  });
});
