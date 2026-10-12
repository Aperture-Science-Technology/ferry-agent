import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import { GatewayVersion } from "./gateway-version";

afterEach(cleanup);

it("shows the installed version and update steps for an older release", () => {
  render(<NextIntlClientProvider locale="fr" messages={messages}>
    <GatewayVersion installed="0.1.1" available="0.1.2" />
  </NextIntlClientProvider>);
  expect(screen.getByText("Version installée : 0.1.1")).toBeTruthy();
  expect(screen.getByText(messages.access.updateArchiveReminder)).toBeTruthy();
});

it.each(["unknown", "0.2.0rc1", "0.2.0", "0.1.2"])("does not invent an update for %s", (installed) => {
  render(<NextIntlClientProvider locale="fr" messages={messages}>
    <GatewayVersion installed={installed} available="0.1.2" />
  </NextIntlClientProvider>);
  expect(screen.queryByText(messages.access.updateArchiveReminder)).toBeNull();
});
