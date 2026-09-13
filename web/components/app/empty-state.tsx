import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatePanel } from "@/components/app/state-panel";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StatePanel
      icon={icon}
      title={title}
      description={description}
      action={action}
    />
  );
}
