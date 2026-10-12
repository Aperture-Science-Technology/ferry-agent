"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DeliverDialog, type DeliveryChoice } from "./deliver-dialog";
import { runBatch } from "@/lib/run-batch";
import { useApiClient } from "@/lib/api-client";
import type { Device, DeliveryJob, LibraryItem } from "@/lib/types";

export function BulkActions({ items, devices, onDeleted, onFinished }: {
  items: LibraryItem[]; devices: Device[];
  onDeleted: (ids: string[]) => void;
  onFinished: (successfulIds: string[]) => void;
}) {
  const t = useTranslations("enhance.bulk");
  const common = useTranslations("common");
  const { call } = useApiClient();
  const running = useRef(false);
  const [dialog, setDialog] = useState<"delete" | "deliver" | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [result, setResult] = useState<{ success: number; failures: string[]; action: "delete" | "deliver" } | null>(null);

  async function execute(action: "delete" | "deliver", choice?: DeliveryChoice) {
    if (running.current || !items.length) return;
    running.current = true;
    const snapshot = [...items];
    setDialog(null);
    setResult(null);
    setProgress({ completed: 0, total: snapshot.length });
    const outcomes = await runBatch(snapshot, async item => {
      if (action === "delete") return call(`/api/v1/books/${item.id}`, { method: "DELETE" });
      const job = await call<DeliveryJob>("/api/v1/deliveries", {
        method: "POST", body: JSON.stringify({ library_item_id: item.id, ...choice }),
      });
      if (job.status === "failed") throw new Error("Delivery failed");
      return job;
    }, completed => setProgress({ completed, total: snapshot.length }));
    const ids = outcomes.filter(outcome => outcome.ok).map(outcome => outcome.item.id);
    if (action === "delete") onDeleted(ids);
    onFinished(ids);
    setResult({ success: ids.length, failures: outcomes.filter(outcome => !outcome.ok).map(outcome => outcome.item.title), action });
    setProgress(null);
    running.current = false;
  }
  if (!items.length && !progress && !result) return null;
  return <div className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-center gap-2">
      <p role="status" className="text-sm">{t("selected", { count: items.length })}</p>
      <Button variant="outline" disabled={!items.length || !devices.length || !!progress} onClick={() => setDialog("deliver")}>{t("deliver")}</Button>
      <Button variant="destructive" disabled={!items.length || !!progress} onClick={() => setDialog("delete")}>{t("delete")}</Button>
    </div>
    {progress ? <p role="status">{t("progress", progress)}</p> : null}
    {result ? <div role="status" className="rounded-lg border p-3 text-sm space-y-2">
      <p>{t(result.action === "deliver" ? "deliveryResult" : "deleteResult", { success: result.success, failed: result.failures.length })}</p>
      {result.failures.length ? <ul className="list-inside list-disc break-words">{result.failures.map((title, index) => <li key={index}>{title}</li>)}</ul> : null}
    </div> : null}
    <DeliverDialog item={dialog === "deliver" ? items[0] ?? null : null} devices={devices}
      batchCount={items.length} onBatchDeliver={choice => { void execute("deliver", choice); }} onOpenChange={open => !open && setDialog(null)} />
    <Dialog open={dialog === "delete"} onOpenChange={open => !open && setDialog(null)}>
      <DialogContent><DialogHeader><DialogTitle>{t("deleteTitle", { count: items.length })}</DialogTitle><DialogDescription>{t("deleteDescription", { count: items.length })}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="ghost" autoFocus onClick={() => setDialog(null)}>{common("cancel")}</Button><Button variant="destructive" disabled={!items.length} onClick={() => void execute("delete")}>{t("delete")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
