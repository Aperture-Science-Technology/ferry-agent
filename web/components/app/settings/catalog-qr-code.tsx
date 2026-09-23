"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import { resolveQrRenderState } from "@/components/app/settings/settings-state";
import { cn } from "@/lib/utils";

/** QR as a high-contrast data URL for the one-time catalog URL. Pen OPDS: 96. */
export function CatalogQrCode({
  url,
  size = 96,
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
      // Ink on paper — avoid dark-teal QR fills.
      color: { dark: "#271d16", light: "#FFFFFF" },
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
  // Pen QR placeholder is 96×96 (size-24). Larger sizes only for legacy callers.
  const sizeClass = size <= 96 ? "size-24" : "size-[180px]";
  const boxClass = cn(
    "flex shrink-0 items-center justify-center rounded-sm border border-border bg-muted px-2 text-center text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground",
    sizeClass
  );

  if (state === "loading") {
    return (
      <div
        className={boxClass}
        role="status"
        aria-live="polite"
        data-qr-state="loading"
      >
        {t("qrLoading")}
      </div>
    );
  }

  if (state === "error" || !dataUrl) {
    return (
      <div className={boxClass} role="alert" data-qr-state="error">
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
      className={cn(
        "max-w-full shrink-0 rounded-sm border border-border bg-white p-1",
        sizeClass
      )}
      data-qr-state="ready"
    />
  );
}
