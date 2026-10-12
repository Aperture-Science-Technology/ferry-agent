"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";

export type OnboardingStatus = { books: boolean | null; devices: boolean | null; deliveries: boolean | null; gateways: boolean | null };
const CHANGED = "ferry-onboarding-change";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGED, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(CHANGED, listener); };
}
function remember(key: string) {
  try { localStorage.setItem(key, "done"); } catch { /* Storage can be disabled. */ }
  window.dispatchEvent(new Event(CHANGED));
}

export function Onboarding({ status, userKey }: { status: OnboardingStatus; userKey: string }) {
  const t = useTranslations("enhance.onboarding");
  const key = `ferry:onboarding:${userKey}`;
  const dismissed = useSyncExternalStore(subscribe, useCallback(() => {
    try { return localStorage.getItem(key) === "done"; } catch { return false; }
  }, [key]), () => true);
  const complete = Object.values(status).every(value => value === true);
  useEffect(() => { if (complete) remember(key); }, [complete, key]);
  if (dismissed || complete) return null;
  const steps = [
    { key: "books", href: "/app/bibliotheque?mode=sources&action=import" },
    { key: "devices", href: "/app/appareils?action=new" },
    { key: "deliveries", href: "/app/livraisons" },
    { key: "gateways", href: "/app/gateways?action=new" },
  ] as const;
  return <Reveal><Card><CardHeader>
    <CardTitle>{t("title")}</CardTitle><CardDescription>{t("description")}</CardDescription>
    <Button variant="ghost" size="sm" className="w-fit" onClick={() => remember(key)}>{t("dismiss")}</Button>
  </CardHeader><CardContent><ol className="grid min-w-0 gap-4 sm:grid-cols-2">
    {steps.map(step => <li key={step.key} className="flex min-w-0 gap-3 rounded-lg border p-4">
      {status[step.key] ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-primary" /> : <Circle aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 space-y-2">
        <h3 className="font-medium">{t(`${step.key}.title`)}</h3><p className="text-sm text-muted-foreground">{t(`${step.key}.description`)}</p>
        {status[step.key] === true ? <Badge variant="secondary">{t("done")}</Badge> : status[step.key] === null ? <p className="text-sm">{t("unknown")}</p> : null}
        <Button variant="outline" className="h-auto whitespace-normal" nativeButton={false} render={<Link href={step.href} />}>{t(`${step.key}.action`)}</Button>
      </div>
    </li>)}
  </ol></CardContent></Card></Reveal>;
}
