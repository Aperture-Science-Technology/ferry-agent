/**
 * Devices list: identity hierarchy, cloud OAuth error ≠ linked/success,
 * soft-refresh keeps previous rows, CRUD dialog opens.
 * Run: npm run test:ui-harness
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { DevicesView } from "@/components/app/devices/devices-view";
import type { Device } from "@/lib/types";
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

function baseDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Liseuse du salon",
    brand: "kindle",
    model: "Paperwhite",
    cloud_linked: false,
    cloud_provider: null,
    conversion_profile: "reader_6in",
    delivery_tier: "A",
    last_synced_at: null,
    ...overrides,
  };
}

function renderDevices(
  props: {
    initialDevices?: Device[];
    devicesUnavailable?: boolean;
    cloudLinkStatus?: "ok" | "error";
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <DevicesView
        initialDevices={props.initialDevices ?? []}
        devicesUnavailable={props.devicesUnavailable ?? false}
        cloudLinkStatus={props.cloudLinkStatus}
      />
    </NextIntlClientProvider>
  );
}

describe("UI harness — devices list", () => {
  beforeEach(() => {
    callMock.mockReset();
  });

  it("prefers custom name, then brand/model, then brand alone", () => {
    const { unmount } = renderDevices({
      initialDevices: [
        baseDevice({
          name: "Salon",
          brand: "kindle",
          model: "Paperwhite",
        }),
      ],
    });

    expect(screen.getAllByText("Salon").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kindle").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/— Paperwhite/).length).toBeGreaterThan(0);
    unmount();

    const { unmount: unmountModel } = renderDevices({
      initialDevices: [
        baseDevice({
          name: null,
          brand: "kobo",
          model: "Clara BW",
        }),
      ],
    });

    expect(screen.getAllByText("Kobo").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/— Clara BW/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Salon")).toBeNull();
    unmountModel();

    renderDevices({
      initialDevices: [
        baseDevice({
          name: null,
          brand: "tolino",
          model: null,
        }),
      ],
    });

    expect(screen.getAllByText("Tolino").length).toBeGreaterThan(0);
    expect(screen.queryByText(/— /)).toBeNull();
  });

  it("shows cloud OAuth error without linked/success labels", async () => {
    const { toast } = await import("sonner");

    renderDevices({
      initialDevices: [
        baseDevice({
          cloud_linked: false,
          delivery_tier: "B",
        }),
      ],
      cloudLinkStatus: "error",
    });

    const errorBanner = document.querySelector('[data-cloud-link="error"]');
    expect(errorBanner).toBeTruthy();
    expect(
      within(errorBanner as HTMLElement).getByText("Liaison cloud interrompue")
    ).toBeTruthy();
    expect(
      within(errorBanner as HTMLElement).getByText(
        /n’a pas pu être lié|Aucune nouvelle connexion/i
      )
    ).toBeTruthy();

    expect(screen.getAllByText("Non lié").length).toBeGreaterThan(0);
    expect(screen.queryByText("Lié")).toBeNull();
    expect(screen.queryByText("Lié à Dropbox")).toBeNull();
    expect(screen.queryByText("Lié à Google Drive")).toBeNull();
    expect(
      screen.queryByText(/enregistrée avec succès|lié avec succès/i)
    ).toBeNull();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("keeps known devices and shows partial refresh when refresh fails", async () => {
    callMock.mockImplementation(async () => {
      throw new Error("network");
    });

    renderDevices({
      initialDevices: [baseDevice({ name: "Kindle Cuisine" })],
      devicesUnavailable: false,
    });

    expect(screen.getAllByText("Kindle Cuisine").length).toBeGreaterThan(0);
    expect(screen.queryByText("Aucun appareil")).toBeNull();
    expect(screen.queryByText("Appareils indisponibles")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));

    await waitFor(() => {
      expect(screen.getByText("Actualisation incomplète")).toBeTruthy();
    });
    expect(screen.getAllByText("Kindle Cuisine").length).toBeGreaterThan(0);
    expect(screen.queryByText("Aucun appareil")).toBeNull();
  });

  it("shows unavailable (not empty) when the API failed with no rows", () => {
    renderDevices({
      initialDevices: [],
      devicesUnavailable: true,
    });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Appareils indisponibles")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.queryByText("Aucun appareil")).toBeNull();
  });

  it("opens the new-device dialog from the list action", async () => {
    renderDevices({
      initialDevices: [baseDevice()],
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Nouvel appareil" })[0]!
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Nouvel appareil")).toBeTruthy();
    expect(
      within(dialog).getByText(
        /Indiquez la marque et le modèle : le mode d'arrivée/
      )
    ).toBeTruthy();
  });

  it("opens edit dialog for an existing device", async () => {
    renderDevices({
      initialDevices: [baseDevice({ name: "À modifier" })],
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Modifier" })[0]!);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Modifier l'appareil")).toBeTruthy();
    expect(within(dialog).getByDisplayValue("À modifier")).toBeTruthy();
  });
});
