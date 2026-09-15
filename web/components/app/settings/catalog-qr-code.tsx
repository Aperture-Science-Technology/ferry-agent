"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import { resolveQrRenderState } from "@/components/app/settings/settings-state";

/** QR as a high-contrast data URL for the one-time catalog URL. */
export function CatalogQrCode({
  url,
  size = 180,
}: {
  url: string;
  size?: number;
}) {
  const t = useTranslations("settings.readerCatalog");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState({ url, size });
  if (url !== active.url || size !== active.size) {
    setActive({ url, size });
    setDataUrl(null);
    setFailed(false);
  }

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111C23", light: "#FFFFFF" },
    })
      .then((value) => {
        if (!cancelled) {
          setDataUrl(value);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  const state = resolveQrRenderState(dataUrl, failed);

  if (state === "loading") {
    return (
      <div
        className="flex size-[180px] items-center justify-center rounded-md border border-border/60 bg-muted/30 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {t("qrLoading")}
      </div>
    );
  }

  if (state === "error" || !dataUrl) {
    return (
      <div
        className="flex size-[180px] items-center justify-center rounded-md border border-border/60 bg-muted/30 px-3 text-center text-xs text-muted-foreground"
        role="alert"
      >
        {t("qrError")}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={t("qrAlt")}
      width={size}
      height={size}
      className="size-[180px] rounded-md border border-border/60 bg-white p-1"
    />
  );
}
