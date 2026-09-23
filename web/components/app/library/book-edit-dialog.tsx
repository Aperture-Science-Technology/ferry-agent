"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PassageRule } from "@/components/passage-rule";
import { useApiClient } from "@/lib/api-client";
import type { LibraryItem } from "@/lib/types";

interface EditForm {
  title: string;
  author: string;
  language: string;
  publisher: string;
  page_count: string;
  published_year: string;
  description: string;
}

function toForm(item: LibraryItem): EditForm {
  return {
    title: item.title,
    author: item.author,
    language: item.language ?? "",
    publisher: item.publisher ?? "",
    page_count: item.page_count !== null ? String(item.page_count) : "",
    published_year: item.published_year !== null ? String(item.published_year) : "",
    description: item.description ?? "",
  };
}

export function BookEditDialog({
  item,
  onOpenChange,
  onSaved,
}: {
  item: LibraryItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: LibraryItem) => void;
}) {
  const t = useTranslations("bookEdit");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [form, setForm] = useState<EditForm | null>(() => (item ? toForm(item) : null));
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function submit() {
    if (!item || !form) return;
    const original = toForm(item);
    const patch: Record<string, string | number | null> = {};
    if (form.title !== original.title) patch.title = form.title;
    if (form.author !== original.author) patch.author = form.author;
    if (form.language !== original.language) patch.language = form.language || null;
    if (form.publisher !== original.publisher) patch.publisher = form.publisher || null;
    if (form.description !== original.description) patch.description = form.description || null;
    if (form.page_count !== original.page_count) {
      patch.page_count = form.page_count ? Number(form.page_count) : null;
    }
    if (form.published_year !== original.published_year) {
      patch.published_year = form.published_year ? Number(form.published_year) : null;
    }

    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      const updated = await call<LibraryItem>(`/api/v1/books/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      toast.success(t("toastSaved"));
      onSaved(updated);
    } catch {
      toast.error(t("toastSaveFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="min-w-0">
          <PassageRule className="mb-1" />
          <DialogTitle className="font-heading tracking-tight break-words whitespace-normal">
            {t("title", { title: item?.title ?? "" })}
          </DialogTitle>
          <DialogDescription className="whitespace-normal">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("fieldTitle")}</Label>
              <Input value={form.title} onChange={(event) => update("title", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("fieldAuthor")}</Label>
              <Input value={form.author} onChange={(event) => update("author", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("fieldLanguage")}</Label>
              <Input
                value={form.language}
                onChange={(event) => update("language", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("fieldPublisher")}</Label>
              <Input
                value={form.publisher}
                onChange={(event) => update("publisher", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("fieldPublishedYear")}</Label>
              <Input
                type="number"
                value={form.published_year}
                onChange={(event) => update("published_year", event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("fieldPageCount")}</Label>
              <Input
                type="number"
                min={0}
                value={form.page_count}
                onChange={(event) => update("page_count", event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("fieldDescription")}</Label>
              <Textarea
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
