import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Pen Form/Field lz3PJ — vertical gap 6, label 12/500 muted, input surface-2 r md.
 * Shared by create / recreate credentials dialogs (Dialog width 420, pad 24, gap 16).
 */
export const gatewayFormControlClass =
  "h-auto min-h-10 w-full rounded-md border-border bg-ferry-surface-2 px-3 py-3 text-sm font-medium";

export const gatewayFormLabelClass =
  "text-xs font-medium text-muted-foreground";

export function GatewayFormField({
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
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className={gatewayFormLabelClass}>
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
