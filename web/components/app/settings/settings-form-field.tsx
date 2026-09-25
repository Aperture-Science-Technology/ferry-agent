import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Pen Form/Field — vertical gap 6, label 12/500 muted, input surface-2 r md,
 * ferry-border (border-strong), padding 12, text 14/500; optional hint 12/500.
 */
export const settingsFormControlClass =
  "h-auto min-h-10 w-full rounded-md border border-border-strong bg-ferry-surface-2 px-3 py-3 text-sm font-medium text-foreground shadow-none";

export const settingsFormLabelClass =
  "text-xs font-medium break-words whitespace-normal text-muted-foreground";

export function SettingsFormField({
  label,
  htmlFor,
  hint,
  hintId,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  hintId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid="settings-field"
      className={cn("flex min-w-0 w-full flex-col gap-1.5", className)}
    >
      <Label htmlFor={htmlFor} className={settingsFormLabelClass}>
        {label}
      </Label>
      {children}
      {hint ? (
        <p
          id={hintId}
          className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
