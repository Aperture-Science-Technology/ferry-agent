import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatePanel } from "@/components/app/state-panel";

export function EmptyState({
  icon,
  visual,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  /** Optional illustration (e.g. EmptyLibraryIllustration); decorative when title carries meaning. */
  visual?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StatePanel
      icon={icon}
      visual={visual}
      title={title}
      description={description}
      action={action}
    />
  );
}
