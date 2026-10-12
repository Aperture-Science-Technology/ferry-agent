"use client";
import { useLocale, useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import type { SystemHealth } from "@/lib/types";

export function StorageQuota({ storage }: { storage: SystemHealth["storage"] }) {
  const t = useTranslations("enhance.quota");
  const locale = useLocale();
  const { used_bytes: used, quota_bytes: quota } = storage;
  if (!Number.isFinite(used) || !Number.isFinite(quota) || used < 0 || quota <= 0) {
    return <p role="status">{t("unavailable")}</p>;
  }
  const percent = 100 * used / quota;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const label = t("usage", { used: number.format(used / 1024 ** 3), quota: number.format(quota / 1024 ** 3) });
  return <div className="space-y-2">
    <p>{label}</p>
    <Progress aria-label={label} value={Math.min(100, Math.round(percent * 100) / 100)} />
    <p>{number.format(percent)} %</p>
    {percent > 90 ? <p role="alert" className="text-sm text-destructive">{t("warning")}</p> : null}
  </div>;
}
