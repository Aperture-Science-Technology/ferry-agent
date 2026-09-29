"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  GATEWAY_DEFAULT_ARCH,
  detectGatewayArch,
  gatewayImageFilename,
  gatewayImageUrl,
  type GatewayArch,
} from "@/lib/gateway-image";

type NavigatorUAData = {
  getHighEntropyValues?: (
    hints: string[]
  ) => Promise<{ architecture?: string }>;
};

export function GatewayDownloadButton() {
  const t = useTranslations("docs");
  const [arch, setArch] = useState<GatewayArch>(GATEWAY_DEFAULT_ARCH);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      let architecture: string | null = null;
      try {
        const uaData = (
          navigator as Navigator & { userAgentData?: NavigatorUAData }
        ).userAgentData;
        if (uaData?.getHighEntropyValues) {
          const values = await uaData.getHighEntropyValues(["architecture"]);
          architecture = values.architecture ?? null;
        }
      } catch {
        // Ignore: fall through to UA / platform heuristics.
      }

      if (cancelled) {
        return;
      }

      setArch(
        detectGatewayArch({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          architecture,
        })
      );
    }

    void detect();

    return () => {
      cancelled = true;
    };
  }, []);

  const other: GatewayArch = arch === "arm64" ? "amd64" : "arm64";

  return (
    <div className="space-y-3">
      <Button
        render={
          <a
            href={gatewayImageUrl(arch)}
            download={gatewayImageFilename(arch)}
          >
            {t("step2Cta")}
          </a>
        }
      />
      <p className="text-muted-foreground">{t("step2UseFile")}</p>
      <p className="text-sm text-muted-foreground">
        {t(arch === "arm64" ? "step2DetectedArm64" : "step2DetectedAmd64")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("step2OtherMachine")}{" "}
        <a
          href={gatewayImageUrl(other)}
          download={gatewayImageFilename(other)}
          className="underline underline-offset-4"
        >
          {t(other === "arm64" ? "archLabelArm64" : "archLabelAmd64")}
        </a>
      </p>
    </div>
  );
}
