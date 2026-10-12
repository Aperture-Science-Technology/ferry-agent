"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useApiClient } from "@/lib/api-client";

export function KindleTest({ deviceId }: { deviceId?: string }) {
  const t = useTranslations("kindleTest");
  const { call } = useApiClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function send() {
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const result = await call<{ recipient: string }>("/api/v1/mail/test", { method: "POST", body: JSON.stringify({ device_id: deviceId ?? null }) });
      setMessage(t("sent", { recipient: result.recipient }));
    } catch (error) {
      setFailed(true);
      let detail = t("error");
      if (error instanceof Error) {
        try { const body = JSON.parse(error.message); if (typeof body.detail === "string") detail = body.detail; } catch { /* Use the translated fallback. */ }
      }
      setMessage(detail);
    } finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <Button type="button" variant="outline" disabled={busy} onClick={() => void send()}>{t(busy ? "sending" : "send")}</Button>
    {message ? <p className="text-sm" role={failed ? "alert" : "status"}>{message}</p> : null}
    <p className="text-xs text-muted-foreground">{t("hint")}</p>
  </div>;
}
