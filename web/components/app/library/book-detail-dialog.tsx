"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeliverDialog } from "@/components/app/library/deliver-dialog";
import { BookEditDialog } from "@/components/app/library/book-edit-dialog";
import { LibraryCoverImage } from "@/components/app/library/cover-image";
import { useApiClient } from "@/lib/api-client";
import type { Device, DeliveryJob, DeliveryStatus, LibraryItem } from "@/lib/types";

const STATUS_VARIANT: Record<DeliveryStatus, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "secondary",
  sent: "outline",
  delivered: "default",
  failed: "destructive",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex++;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function BookDetailDialog({
  item,
  devices,
  onOpenChange,
  onUpdated,
  onDeleted,
}: {
  item: LibraryItem | null;
  devices: Device[];
  onOpenChange: (open: boolean) => void;
  onUpdated: (item: LibraryItem) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("bookDetail");
  const tCommon = useTranslations("common");
  const tDeliveries = useTranslations("deliveries");
  const { call } = useApiClient();

  const [deliverOpen, setDeliverOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deliveriesState, setDeliveriesState] = useState<{
    id: string;
    jobs: DeliveryJob[];
  } | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  const itemId = item?.id ?? null;

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    call<DeliveryJob[]>(`/api/v1/books/${itemId}/deliveries`)
      .then((jobs) => {
        if (cancelled) return;
        setDeliveriesState({ id: itemId, jobs });
      })
      .catch(() => {
        if (cancelled) return;
        setFailedId(itemId);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, call]);

  const deliveries = deliveriesState?.id === itemId ? deliveriesState.jobs : null;
  const loadingDeliveries = itemId !== null && deliveries === null && failedId !== itemId;

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    try {
      await call(`/api/v1/books/${item.id}`, { method: "DELETE" });
      onDeleted(item.id);
      toast.success(t("toastDeleted"));
      setConfirmOpen(false);
      onOpenChange(false);
    } catch {
      toast.error(t("toastDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={item !== null} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="mb-1 h-px w-14 bg-gradient-to-r from-chart-1 via-chart-2 to-transparent" />
            <DialogTitle className="font-heading text-xl tracking-tight">
              {item?.title ?? ""}
            </DialogTitle>
            <DialogDescription>{item?.author ?? ""}</DialogDescription>
          </DialogHeader>

          {item && (
            <div className="grid gap-5 sm:grid-cols-[168px_1fr]">
              <div className="relative mx-auto aspect-3/4 w-full max-w-42 overflow-hidden rounded-xl bg-muted ring-1 ring-border/50 sm:mx-0">
                <LibraryCoverImage
                  itemId={item.id}
                  hasCover={Boolean(item.cover_url)}
                  alt={item.title}
                />
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{item.original_format.toUpperCase()}</Badge>
                  {item.language && <Badge variant="outline">{item.language}</Badge>}
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {item.page_count != null && (
                    <>
                      <dt className="text-muted-foreground">{t("pages")}</dt>
                      <dd>{t("pagesValue", { count: item.page_count })}</dd>
                    </>
                  )}
                  {item.size_bytes != null && (
                    <>
                      <dt className="text-muted-foreground">{t("size")}</dt>
                      <dd>{formatBytes(item.size_bytes)}</dd>
                    </>
                  )}
                  {item.publisher && (
                    <>
                      <dt className="text-muted-foreground">{t("publisher")}</dt>
                      <dd>{item.publisher}</dd>
                    </>
                  )}
                  {item.published_year != null && (
                    <>
                      <dt className="text-muted-foreground">{t("year")}</dt>
                      <dd>{item.published_year}</dd>
                    </>
                  )}
                  {item.isbn && (
                    <>
                      <dt className="text-muted-foreground">{t("isbn")}</dt>
                      <dd>{item.isbn}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">{t("added")}</dt>
                  <dd>{new Date(item.added_at).toLocaleDateString()}</dd>
                </dl>

                {item.description && (
                  <p className="leading-relaxed text-muted-foreground">{item.description}</p>
                )}

                <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
                  <Button size="sm" onClick={() => setDeliverOpen(true)}>
                    <Send />
                    {t("send")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil />
                    {t("edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2 />
                    {t("delete")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 border-t border-border/50 pt-4">
            <h3 className="font-heading text-sm font-medium tracking-tight">
              {t("deliveryHistory")}
            </h3>
            {loadingDeliveries ? (
              <div className="space-y-1.5">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : deliveries && deliveries.length > 0 ? (
              <ul className="space-y-2">
                {deliveries.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {job.device_label ?? tCommon("dash")}
                        <span className="text-muted-foreground"> · {job.method}</span>
                      </span>
                      <Badge variant={STATUS_VARIANT[job.status]}>
                        {tDeliveries(`statuses.${job.status}`)}
                      </Badge>
                      <span className="shrink-0 text-muted-foreground">
                        {new Date(job.delivered_at ?? job.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {job.error ? (
                      <p className="truncate text-destructive text-xs">{job.error}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t("noDeliveries")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DeliverDialog
        item={deliverOpen ? item : null}
        devices={devices}
        onOpenChange={(open) => !open && setDeliverOpen(false)}
        onDelivered={(job) => {
          if (!itemId) return;
          setFailedId((prev) => (prev === itemId ? null : prev));
          setDeliveriesState((prev) => {
            const jobs = prev?.id === itemId ? prev.jobs : [];
            return { id: itemId, jobs: [job, ...jobs] };
          });
        }}
      />

      <BookEditDialog
        key={editOpen ? item?.id : "edit-closed"}
        item={editOpen ? item : null}
        onOpenChange={(open) => !open && setEditOpen(false)}
        onSaved={(updated) => {
          onUpdated(updated);
          setEditOpen(false);
        }}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>{t("confirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="animate-spin" />}
              {t("confirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
