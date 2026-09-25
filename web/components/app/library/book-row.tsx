"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LibraryCoverImage } from "@/components/app/library/cover-image";
import { cn } from "@/lib/utils";
import type { LibraryItem } from "@/lib/types";

/**
 * Pen Library/BookRow — border-b, gap 16, pad [12,0], cover 96×128,
 * Meta 16/500 + 12/500, Actions Icon 40 + Ghost send.
 */
export function BookRow({
  item,
  selected,
  canDeliver,
  onSelect,
  onOpenDetail,
  onDeliver,
  onDelete,
}: {
  item: LibraryItem;
  selected: boolean;
  canDeliver: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
  onDeliver: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const author = item.author || tCommon("dash");
  const format = item.original_format.toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center gap-4 border-b border-border py-3",
        selected && "bg-muted/40"
      )}
    >
      <button
        type="button"
        className="relative h-32 w-24 shrink-0 overflow-hidden rounded-sm bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
        aria-pressed={selected}
        aria-label={item.title}
        onClick={onSelect}
        onDoubleClick={onOpenDetail}
      >
        <LibraryCoverImage
          itemId={item.id}
          hasCover={Boolean(item.cover_url)}
          alt={item.title}
        />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col gap-1 text-left"
        onClick={onSelect}
        onDoubleClick={onOpenDetail}
      >
        <p className="line-clamp-1 text-base font-medium text-foreground">
          {item.title}
        </p>
        <p className="line-clamp-1 text-xs font-medium text-muted-foreground">
          {t("authorFormat", { author, format })}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("deleteOf", { title: item.title })}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!canDeliver}
          aria-disabled={!canDeliver}
          aria-label={t("deliverOf", { title: item.title })}
          onClick={onDeliver}
        >
          {t("deliver")}
        </Button>
      </div>
    </div>
  );
}
