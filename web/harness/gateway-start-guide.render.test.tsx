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
    const pre = document.querySelector("pre");
    expect(pre?.textContent?.trim().split("\n")).toHaveLength(6);
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
    const pre = document.querySelector("pre");
    expect(pre?.textContent?.trim().split("\n")).toHaveLength(6);
  });
});
