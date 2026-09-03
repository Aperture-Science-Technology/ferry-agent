import { cn } from "@/lib/utils";

export function StatusDot({
  online = true,
  className,
}: {
  online?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      {online && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          online ? "bg-emerald-500" : "bg-muted-foreground/40"
        )}
      />
    </span>
  );
}
