"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function CoverFallback({
  label,
  className,
  iconClassName,
  decorative,
}: {
  label: string;
  className?: string;
  iconClassName?: string;
  /** When true, parent already exposes an accessible name (e.g. book title). */
  decorative?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted px-2 text-center",
        className
      )}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": label })}
    >
      <BookOpen className={cn("size-8 text-primary/70", iconClassName)} />
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

/**
 * Couverture d'un item en bibliotheque via le proxy authentifie
 * GET /api/v1/covers/{item_id} (jamais d'URL tierce dans le navigateur).
 */
export function LibraryCoverImage({
  itemId,
  hasCover,
  alt,
  className,
  iconClassName,
}: {
  itemId: string;
  hasCover: boolean;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  const t = useTranslations("library");
  const { getToken } = useAuth();
  const coverKey = hasCover ? itemId : null;
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(coverKey);
  const fallbackLabel = t("coverFallback");

  // Reset when the cover identity changes (React: adjust state during render).
  if (activeKey !== coverKey) {
    setActiveKey(coverKey);
    setSrc(null);
    setFailed(false);
  }

  useEffect(() => {
    if (!coverKey) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/v1/covers/${coverKey}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok || cancelled) {
          if (!cancelled) setFailed(true);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setFailed(false);
      } catch {
        if (!cancelled) {
          setSrc(null);
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [coverKey, getToken]);

  if (!src || failed) {
    return (
      <CoverFallback
        label={fallbackLabel}
        className={className}
        iconClassName={iconClassName}
        decorative={Boolean(alt)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      className={cn("object-cover", className)}
      sizes="(max-width: 640px) 100vw, 200px"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Couverture d'un resultat de recherche : URL directe allowlistee uniquement.
 */
export function SearchCoverImage({
  coverUrl,
  className,
  iconClassName,
}: {
  coverUrl: string | null | undefined;
  className?: string;
  iconClassName?: string;
}) {
  const t = useTranslations("library");
  const [failed, setFailed] = useState(false);
  const fallbackLabel = t("coverFallback");

  if (!coverUrl || failed) {
    return (
      <CoverFallback
        label={fallbackLabel}
        className={className}
        iconClassName={iconClassName ?? "size-4"}
      />
    );
  }

  return (
    <Image
      src={coverUrl}
      alt=""
      width={40}
      height={40}
      unoptimized
      className={cn("h-full w-full object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
