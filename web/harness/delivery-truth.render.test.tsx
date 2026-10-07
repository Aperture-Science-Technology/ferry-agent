import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryFeedback } from "@/components/app/deliveries/delivery-feedback";
import { DeliveryDetailDialog } from "@/components/app/deliveries/delivery-detail-dialog";
import { DeliveriesView } from "@/components/app/deliveries/deliveries-view";
import type { DeliveryJob } from "@/lib/types";
import messages from "@/messages/fr.json";

const call = vi.fn();
vi.mock("@/lib/api-client", () => ({ useApiClient: () => ({ call }) }));
vi.mock("motion/react", () => ({
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  useReducedMotion: () => true,
}));

const job: DeliveryJob = {
  id: "mail", device_id: "device", status: "sent", method: "email", terminal: true,
  created_at: "2026-10-07T12:00:00Z", delivered_at: null, error: null, item_title: "Livre email",
};
const wrap = (children: React.ReactNode) => render(<NextIntlClientProvider locale="fr" messages={messages}>{children}</NextIntlClientProvider>);
beforeEach(() => { call.mockReset(); });

describe("Delivery truth", () => {
  it("excludes accepted email from active count and filter but keeps cloud sent", () => {
    wrap(<DeliveriesView title="Livraisons" description="Suivi" initialDeliveries={[job, { ...job, id: "cloud", method: "drive", terminal: false, item_title: "Livre cloud" }]} deliveriesUnavailable={false} />);
    expect(screen.getByText("Envoyé — accepté par le relais")).toBeTruthy();
    expect(screen.getByText("En cours d’envoi")).toBeTruthy();
    expect(screen.getByText("1 en cours")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "En cours" }));
    expect(screen.queryByText(/Livre email →/)).toBeNull();
    expect(screen.getByText(/Livre cloud →/)).toBeTruthy();
  });

  it("shows API sender address, Amazon link and silent discard warning in feedback", async () => {
    call.mockResolvedValue({ sender_address: "sender@example.test" });
    wrap(<DeliveryFeedback title="Demande enregistrée" method="email" />);
    expect(await screen.findByText("sender@example.test")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://www.amazon.com/mycd");
    expect(screen.getByText(/abandonné en silence/)).toBeTruthy();
  });

  it.each([401, 500])("a settings failure (%s) hides the address without breaking feedback", async (status) => {
    call.mockRejectedValue(new Error(String(status)));
    wrap(<DeliveryFeedback title="Demande enregistrée" method="email" />);
    await waitFor(() => expect(call).toHaveBeenCalledWith("/api/v1/mail/settings"));
    expect(screen.getByText("Demande enregistrée")).toBeTruthy();
    expect(screen.queryByText(/Adresse d’envoi à approuver/)).toBeNull();
    expect(screen.getByRole("link")).toBeTruthy();
  });

  it("does not request email settings for cloud feedback", () => {
    wrap(<DeliveryFeedback title="Demande enregistrée" method="drive" />);
    expect(call).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the sender and email terminal hint in delivery details", async () => {
    call.mockImplementation(async (path: string) => path === "/api/v1/mail/settings" ? { sender_address: "sender@example.test" } : job);
    wrap(<DeliveryDetailDialog jobId={job.id} seedJob={job} onOpenChange={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("sender@example.test")).toBeTruthy();
    expect(within(dialog).getByText(/Amazon ne confirme pas la remise/)).toBeTruthy();
    expect(within(dialog).getByText("Envoyé — accepté par le relais")).toBeTruthy();
  });
});
