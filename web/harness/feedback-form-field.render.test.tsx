/**
 * Lot 8b — Feedback/Loading|Error|Partial anatomy + Form/Field gap 6 / controls.
 * Mounts domain feedback specimens directly (actions fire callbacks).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DeliveryFeedbackError,
  DeliveryFeedbackLoading,
  DeliveryFeedbackPartial,
} from "@/components/app/deliveries/delivery-feedback";
import {
  DeviceFeedbackError,
  DeviceFeedbackLoading,
  DeviceFeedbackPartial,
} from "@/components/app/devices/device-feedback";
import { DeviceFormField, deviceFormControlClass } from "@/components/app/devices/device-form-field";
import {
  GatewayFeedbackError,
  GatewayFeedbackLoading,
  GatewayFeedbackPartial,
} from "@/components/app/gateways/gateway-feedback";
import { GatewayFormField, gatewayFormControlClass } from "@/components/app/gateways/gateway-form-field";
import {
  LibraryFeedbackError,
  LibraryFeedbackLoading,
  LibraryFeedbackPartial,
} from "@/components/app/library/library-feedback";
import {
  SettingsFeedbackError,
  SettingsFeedbackLoading,
  SettingsFeedbackPartial,
} from "@/components/app/settings/settings-feedback";
import {
  SettingsFormField,
  settingsFormControlClass,
} from "@/components/app/settings/settings-form-field";
import {
  SourcesFeedbackError,
  SourcesFeedbackLoading,
  SourcesFeedbackPartial,
} from "@/components/app/sources/source-feedback";
import { Input } from "@/components/ui/input";
import messagesFr from "@/messages/fr.json";

const shellRe =
  /rounded-md.*border-border-strong.*bg-ferry-surface.*p-4|p-4.*rounded-md.*border-border-strong.*bg-ferry-surface/;

function expectLoadingAnatomy(root: HTMLElement) {
  expect(root.getAttribute("data-feedback-state")).toBe("loading");
  expect(root.getAttribute("role")).toBe("status");
  expect(root.className).toMatch(/flex/);
  expect(root.className).toMatch(/items-center/);
  expect(root.className).toMatch(/gap-3/);
  expect(root.className).toMatch(shellRe);
  expect(root.querySelector("svg[aria-hidden='true']")).toBeTruthy();
}

function expectErrorAnatomy(root: HTMLElement) {
  expect(root.getAttribute("data-feedback-state")).toBe("error");
  expect(root.getAttribute("role")).toBe("alert");
  expect(root.className).toMatch(/flex-col/);
  expect(root.className).toMatch(/gap-4/);
  expect(root.className).toMatch(shellRe);
  expect(root.querySelector("svg[aria-hidden='true']")).toBeTruthy();
}

function expectPartialAnatomy(root: HTMLElement) {
  expect(root.getAttribute("data-feedback-state")).toBe("partial");
  expect(root.getAttribute("role")).toBe("status");
  expect(root.className).toMatch(/flex-col/);
  expect(root.className).toMatch(/gap-4/);
  expect(root.className).toMatch(shellRe);
  expect(root.querySelector("svg[aria-hidden='true']")).toBeTruthy();
}

function expectFormFieldAnatomy(field: HTMLElement, controlClass: string) {
  expect(field.className).toMatch(/gap-1\.5/);
  expect(field.className).toMatch(/flex-col/);
  const label = field.querySelector("label");
  expect(label?.className).toMatch(/text-xs/);
  expect(label?.className).toMatch(/font-medium/);
  expect(controlClass).toMatch(/bg-ferry-surface-2/);
  expect(controlClass).toMatch(/border-border-strong/);
  expect(controlClass).toMatch(/rounded-md/);
  expect(controlClass).toMatch(/px-3/);
  expect(controlClass).toMatch(/py-3/);
  expect(controlClass).toMatch(/text-sm/);
  expect(controlClass).toMatch(/font-medium/);
}

describe("UI harness — Feedback Loading/Error/Partial + Form/Field", () => {
  const suites = [
    {
      name: "library",
      Loading: LibraryFeedbackLoading,
      Error: LibraryFeedbackError,
      Partial: LibraryFeedbackPartial,
    },
    {
      name: "deliveries",
      Loading: DeliveryFeedbackLoading,
      Error: DeliveryFeedbackError,
      Partial: DeliveryFeedbackPartial,
    },
    {
      name: "devices",
      Loading: DeviceFeedbackLoading,
      Error: DeviceFeedbackError,
      Partial: DeviceFeedbackPartial,
    },
    {
      name: "gateways",
      Loading: GatewayFeedbackLoading,
      Error: GatewayFeedbackError,
      Partial: GatewayFeedbackPartial,
    },
    {
      name: "sources",
      Loading: SourcesFeedbackLoading,
      Error: SourcesFeedbackError,
      Partial: SourcesFeedbackPartial,
    },
    {
      name: "settings",
      Loading: SettingsFeedbackLoading,
      Error: SettingsFeedbackError,
      Partial: SettingsFeedbackPartial,
    },
  ] as const;

  for (const suite of suites) {
    it(`${suite.name}: distinguishes loading, error and partial with specimen anatomy`, () => {
      const onDismiss = vi.fn();
      const onRetry = vi.fn();
      const onIgnore = vi.fn();
      const onRefresh = vi.fn();

      const { unmount: unmountLoading } = render(
        <suite.Loading title="Chargement…" description="Récupération." />
      );
      expectLoadingAnatomy(screen.getByRole("status"));
      unmountLoading();

      const { unmount: unmountError } = render(
        <suite.Error
          title="Erreur persistante"
          description="Impossible de joindre."
          dismissLabel={messagesFr.common.dismiss}
          onDismiss={onDismiss}
          retryLabel={messagesFr.common.retry}
          onRetry={onRetry}
        />
      );
      const errorRoot = screen.getByRole("alert");
      expectErrorAnatomy(errorRoot);
      fireEvent.click(
        screen.getByRole("button", { name: messagesFr.common.dismiss })
      );
      fireEvent.click(
        screen.getByRole("button", { name: messagesFr.common.retry })
      );
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledTimes(1);
      unmountError();

      render(
        <suite.Partial
          title="Données partielles"
          description="Certains éléments manquent."
          ignoreLabel={messagesFr.common.ignore}
          onIgnore={onIgnore}
          refreshLabel={messagesFr.common.refresh}
          onRefresh={onRefresh}
        />
      );
      const partialRoot = screen.getByRole("status");
      expectPartialAnatomy(partialRoot);
      fireEvent.click(
        screen.getByRole("button", { name: messagesFr.common.ignore })
      );
      fireEvent.click(
        screen.getByRole("button", { name: messagesFr.common.refresh })
      );
      expect(onIgnore).toHaveBeenCalledTimes(1);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  }

  it("aligns Form/Field anatomy across settings, devices and gateways", () => {
    render(
      <>
        <SettingsFormField label="Nom" hint="Aide">
          <Input className={settingsFormControlClass} />
        </SettingsFormField>
        <DeviceFormField label="Appareil" hint="Aide">
          <Input className={deviceFormControlClass} />
        </DeviceFormField>
        <GatewayFormField label="Gateway" hint="Aide">
          <Input className={gatewayFormControlClass} />
        </GatewayFormField>
      </>
    );

    expectFormFieldAnatomy(
      screen.getByTestId("settings-field"),
      settingsFormControlClass
    );
    expectFormFieldAnatomy(
      screen.getByTestId("device-field"),
      deviceFormControlClass
    );
    expectFormFieldAnatomy(
      screen.getByTestId("gateway-field"),
      gatewayFormControlClass
    );
  });
});
