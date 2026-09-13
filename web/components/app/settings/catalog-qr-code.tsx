"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR code SVG pour l'URL du catalogue liseuse (affichee une seule fois). */
export function CatalogQrCode({ url, size = 180 }: { url: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div className="flex size-[180px] items-center justify-center rounded-md border border-border/60 bg-muted/30 text-xs text-muted-foreground">
        …
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt=""
      width={size}
      height={size}
      className="size-[180px] rounded-md border border-border/60 bg-white p-1"
    />
  );
}
