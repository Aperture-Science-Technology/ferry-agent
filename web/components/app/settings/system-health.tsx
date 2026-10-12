"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { StorageQuota } from "./storage-quota";
import { Button } from "@/components/ui/button";
import { useApiClient } from "@/lib/api-client";
import type { SystemHealth } from "@/lib/types";

export function SystemHealthPanel() {
  const t = useTranslations("systemHealth");
  const { call } = useApiClient();
  const [data, setData] = useState<SystemHealth | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve(call<SystemHealth>("/api/v1/system/health")).then((result) => {
      if (!result?.converters || !result?.mail || !result?.storage || !result?.gateways || !result?.library) throw new Error("Invalid system status");
      if (active) { setData(result); setError(false); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [call, attempt]);
  return <section className="rounded-lg border bg-card p-6 space-y-3" aria-label={t("title")}>
    <h2 className="text-base font-medium">{t("title")}</h2>
    {error ? <div role="alert"><p>{t("error")}</p><Button variant="outline" onClick={() => { setError(false); setAttempt(v => v + 1); }}>{t("retry")}</Button></div> : !data ? <p role="status">{t("loading")}</p> : <dl className="grid gap-3 text-sm">
      <div><dt>{t("converters")}</dt><dd>{t(data.converters.ebook_convert_available ? "available" : "unavailable")} {data.converters.ebook_convert_version}</dd></div>
      <div><dt>{t("mail")}</dt><dd>{t(data.mail.configured ? "available" : "unavailable")} · {data.mail.sender_address}</dd><dd>{data.mail.domains_allowed.join(", ")}</dd></div>
      <div><dt>{t("storage")}</dt><dd><StorageQuota storage={data.storage} /></dd></div>
      <div><dt>{t("gateways")}</dt><dd>{t("gatewayCounts", { ...data.gateways })}</dd></div>
      <div><dt>{t("library")}</dt><dd>{t("items", { count: data.library.items })}</dd></div>
      <div><dt>{t("deliveries")}</dt><dd>{t("deliveryCounts", { ...data.library.deliveries_last_7_days })}</dd></div>
      <div><dt>{t("version")}</dt><dd>{data.version ?? t("unknown")}</dd></div>
    </dl>}
  </section>;
}
