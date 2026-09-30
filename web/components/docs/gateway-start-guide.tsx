"use client";

import { useTranslations } from "next-intl";
import { AppleLogo, WindowsLogo } from "@/components/docs/platform-logos";

type TerminalStep = {
  label: string;
  command: string;
};

export function GatewayStartGuide() {
  const t = useTranslations("docs");
  const terminalSteps = t.raw("step4TerminalSteps") as TerminalStep[];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("step4ImageName")}</p>
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        {t("step4VolumeWarn")}
      </p>

      <div className="space-y-2">
        <h4 className="flex items-center gap-2 font-heading text-base font-medium">
          <WindowsLogo className="size-4 shrink-0" />
          {t("step4DockerTitle")}
        </h4>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t("step4DockerStep1")}</li>
          <li>{t("step4DockerStep2")}</li>
          <li>{t("step4DockerStep3")}</li>
          <li>{t("step4DockerStep4")}</li>
          <li>{t("step4DockerStep5")}</li>
        </ol>
      </div>

      <div className="space-y-2">
        <h4 className="flex items-center gap-2 font-heading text-base font-medium">
          <AppleLogo className="size-4 shrink-0" />
          {t("step4OrbstackTitle")}
        </h4>
        <p className="text-sm text-muted-foreground">{t("step4OrbstackStep1")}</p>
        <p className="text-sm text-muted-foreground">{t("step4OrbstackStep2")}</p>
      </div>

      <div className="space-y-2">
        <h4 className="font-heading text-base font-medium">
          {t("step4TerminalTitle")}
        </h4>
        <p className="text-sm text-muted-foreground">{t("step4TerminalIntro")}</p>
        <ol className="space-y-3">
          {terminalSteps.map((step, index) => (
            <li key={step.command} className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                {index + 1}. {step.label}
              </p>
              <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                {step.command}
              </pre>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">{t("step4TerminalNote")}</p>
      </div>
    </div>
  );
}
