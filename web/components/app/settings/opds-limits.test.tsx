import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { ReaderCatalogSection } from "./reader-catalog-section";
import { OpdsTokenUsage, parseOptionalLimit } from "./opds-limits";

const call = vi.fn();
vi.mock("@/lib/api-client", () => ({ useApiClient: () => ({ call }) }));
vi.mock("./catalog-qr-code", () => ({ CatalogQrCode: () => null }));
afterEach(cleanup);
beforeEach(() => call.mockReset());

const token = { id: "reader", label: "Salon", created_at: "2025-01-01T00:00:00Z", last_used_at: "2025-01-02T00:00:00Z", downloads_count: 2, max_downloads: 3, expires_at: "2025-02-01T00:00:00Z" };
const text = messages.settings.readerCatalog;

it("shows usage, expiry, last use, and expired status", () => {
  render(<NextIntlClientProvider locale="fr" messages={messages}>
    <ReaderCatalogSection initialTokens={[token]} tokensUnavailable={false} />
  </NextIntlClientProvider>);
  expect(screen.getByText("2 téléchargement(s) sur 3")).toBeTruthy();
  expect(screen.getByText(/^Expire le /)).toBeTruthy();
  expect(screen.getByText(text.statusExpired)).toBeTruthy();
  expect(screen.getByText(/Dernier usage/i)).toBeTruthy();
});

it("shows unlimited access without expiry", () => {
  render(<NextIntlClientProvider locale="fr" messages={messages}>
    <OpdsTokenUsage token={{ ...token, max_downloads: null, expires_at: null }} />
  </NextIntlClientProvider>);
  expect(screen.getByText("2 téléchargement(s) · sans limite")).toBeTruthy();
  expect(screen.getByText(text.noExpiration)).toBeTruthy();
});

it("submits optional limits and preserves them in the created card", async () => {
  call.mockResolvedValue({ ...token, max_downloads: 5, downloads_count: 0, expires_at: "2099-01-01T00:00:00Z", token: "test-secret", url: "http://test/opds/test-secret" });
  render(<NextIntlClientProvider locale="fr" messages={messages}>
    <ReaderCatalogSection initialTokens={[]} tokensUnavailable={false} />
  </NextIntlClientProvider>);
  fireEvent.click(screen.getAllByRole("button", { name: text.createCta })[0]);
  fireEvent.change(screen.getByLabelText(text.maxDownloadsLabel), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText(text.expiresDaysLabel), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: messages.common.create }));
  await waitFor(() => expect(call).toHaveBeenCalledOnce());
  expect(JSON.parse(call.mock.calls[0][1].body)).toEqual({ label: text.defaultLabel, max_downloads: 5, expires_in_days: 2 });
  await waitFor(() => expect(screen.getByText("0 téléchargement(s) sur 5")).toBeTruthy());
});

it("rejects nonpositive or fractional values and accepts blank limits", () => {
  expect(parseOptionalLimit("", 36500)).toBeNull();
  expect(parseOptionalLimit("2", 36500)).toBe(2);
  for (const value of ["0", "-1", "1.5", "36501", "nope"]) {
    expect(parseOptionalLimit(value, 36500)).toBeUndefined();
  }
  render(<NextIntlClientProvider locale="fr" messages={messages}>
    <ReaderCatalogSection initialTokens={[]} tokensUnavailable={false} />
  </NextIntlClientProvider>);
  fireEvent.click(screen.getAllByRole("button", { name: text.createCta })[0]);
  fireEvent.change(screen.getByLabelText(text.maxDownloadsLabel), { target: { value: "-1" } });
  expect(screen.getByRole("button", { name: messages.common.create }).hasAttribute("disabled")).toBe(true);
  fireEvent.keyDown(screen.getByLabelText(text.maxDownloadsLabel), { key: "Enter" });
  expect(call).not.toHaveBeenCalled();
});
