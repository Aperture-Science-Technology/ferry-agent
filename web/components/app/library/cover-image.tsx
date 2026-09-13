"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { getToken } = useAuth();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCover) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/v1/covers/${itemId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [itemId, hasCover, getToken]);

  if (!src) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-gradient-to-br from-muted via-muted to-accent/40",
          className
        )}
      >
        <BookOpen className={cn("size-10 text-chart-1/70", iconClassName)} />
      </div>
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
  if (!coverUrl) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center", className)}>
        <BookOpen className={cn("size-4 text-chart-1/70", iconClassName)} />
      </div>
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
    />
  );
}
