"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  gatewayReleasesPageUrl,
  resolveGatewayDownloadLinks,
  type GatewayArch,
  type GatewayDownloadLinks,
} from "@/lib/gateway-release";

const ARCH_COPY: Record<
  GatewayArch,
  { labelKey: "step2DownloadAmd64" | "step2DownloadArm64"; hintKey: "step2DownloadAmd64Hint" | "step2DownloadArm64Hint" }
> = {
  amd64: {
    labelKey: "step2DownloadAmd64",
    hintKey: "step2DownloadAmd64Hint",
  },
  arm64: {
    labelKey: "step2DownloadArm64",
    hintKey: "step2DownloadArm64Hint",
  },
};

function AvailableDownloads({ links }: { links: GatewayDownloadLinks }) {
  const t = useTranslations("docs");

  return (
    <div className="space-y-4 border border-border bg-background p-4 sm:p-5">
      <div className="space-y-1">
        <p className="font-heading text-base font-medium tracking-tight">
          {t("step2DownloadTitle")}
        </p>
        <p className="text-sm text-muted-foreground">{t("step2DownloadIntro")}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {t("step2VersionLabel", { version: links.version })}
        </p>
      </div>
      <ul className="space-y-3">
        {links.assets.map((asset) => {
          const copy = ARCH_COPY[asset.arch];
          return (
            <li
              key={asset.arch}
              className="flex flex-col gap-2 border-t border-border/70 pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t(copy.labelKey)}
                </p>
                <p className="text-sm text-muted-foreground">{t(copy.hintKey)}</p>
                <p className="font-mono text-xs break-all text-muted-foreground">
                  {t("step2FilenameHint", { filename: asset.filename })}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                render={
                  <a href={asset.url} download={asset.filename} rel="noopener noreferrer">
                    {t(copy.labelKey)}
                  </a>
                }
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-3 border-t border-border/70 pt-3">
        <Button
          variant="ghost"
          size="sm"
          render={
            <a href={links.checksumsUrl} rel="noopener noreferrer">
              {t("step2Checksums")}
            </a>
          }
        />
        <Button
          variant="ghost"
          size="sm"
          render={
            <a href={gatewayReleasesPageUrl()} rel="noopener noreferrer">
              {t("step2ReleasesPage")}
            </a>
          }
        />
      </div>
    </div>
  );
}

function UnavailableDownloads() {
  const t = useTranslations("docs");

  return (
    <div className="space-y-3 border border-dashed border-border bg-muted/40 p-4 sm:p-5">
      <p className="font-heading text-base font-medium tracking-tight">
        {t("step2Unavailable")}
      </p>
      <p className="text-sm text-muted-foreground">{t("step2UnavailableHint")}</p>
      <Button
        variant="outline"
        size="sm"
        render={
          <a href={gatewayReleasesPageUrl()} rel="noopener noreferrer">
            {t("step2ReleasesPage")}
          </a>
        }
      />
    </div>
  );
}

/**
 * Versioned Gateway install downloads. URLs are only rendered when
 * NEXT_PUBLIC_GATEWAY_RELEASE_VERSION matches a real release tag contract.
 */
export function GatewayDownloadPanel({
  version,
}: {
  version: string | null;
}) {
  const links = resolveGatewayDownloadLinks(version);
  if (!links) {
    return <UnavailableDownloads />;
  }
  return <AvailableDownloads links={links} />;
}
