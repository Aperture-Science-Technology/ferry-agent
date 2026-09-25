"use client";

import { LibraryCoverImage } from "@/components/app/library/cover-image";
import { cn } from "@/lib/utils";
import type { LibraryItem } from "@/lib/types";

/**
 * Pen Library/BookGridItem — width 140, gap 10, cover 96×128.
 */
export function BookGridItem({
  item,
  selected,
  authorFallback,
  onSelect,
  onOpenDetail,
}: {
  item: LibraryItem;
  selected: boolean;
  authorFallback: string;
  onSelect: () => void;
  onOpenDetail: () => void;
}) {
  return (
    <article className="flex w-[140px] flex-col gap-2.5">
      <button
        type="button"
        className={cn(
          "relative h-32 w-24 overflow-hidden rounded-sm bg-secondary text-left",
          "focus-visible:ring-2 focus-visible:ring-ring",
          selected && "ring-2 ring-ring"
        )}
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
        className="min-w-0 text-left"
        onClick={onSelect}
        onDoubleClick={onOpenDetail}
      >
        <h3 className="line-clamp-2 w-full text-sm font-medium text-foreground">
          {item.title}
        </h3>
        <p className="line-clamp-1 text-xs font-medium text-muted-foreground">
          {item.author || authorFallback}
        </p>
      </button>
    </article>
  );
}
