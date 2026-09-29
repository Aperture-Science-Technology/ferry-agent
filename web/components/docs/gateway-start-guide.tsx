"use client";

import { useTranslations } from "next-intl";

export function GatewayStartGuide() {
  const t = useTranslations("docs");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("step4ImageName")}</p>
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        {t("step4VolumeWarn")}
      </p>

      <div className="space-y-2">
        <h4 className="font-heading text-base font-medium">
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
        <h4 className="font-heading text-base font-medium">
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
        <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          {t("step4TerminalCommands")}
        </pre>
        <p className="text-sm text-muted-foreground">{t("step4TerminalNote")}</p>
      </div>
    </div>
  );
}
