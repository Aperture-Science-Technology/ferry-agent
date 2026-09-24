"use client";

import { Library } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Pen Library/EmptyState — gap 16, pad 40, icon 32, title 20/600, body 14/500.
 */
export function LibraryEmptyState({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 p-10 text-center">
      <Library className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-xl font-semibold text-foreground text-balance">
        {title}
      </p>
      <p className="max-w-md text-sm font-medium text-muted-foreground">
        {description}
      </p>
      {actions ? (
        <div className="flex w-full flex-col items-center justify-center gap-2.5 sm:flex-row">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
