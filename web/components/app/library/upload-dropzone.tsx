"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LibraryItem } from "@/lib/types";

const ACCEPTED_EXTENSIONS = new Set([".epub", ".pdf", ".mobi", ".azw3"]);
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

type UploadRow = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

function parseDetail(raw: string): string {
  try {
    const body = JSON.parse(raw) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // plain text
  }
  return raw.trim();
}

function mapUploadError(
  status: number,
  detail: string,
  t: ReturnType<typeof useTranslations<"library">>
): string {
  if (status === 413 || /trop volumineux|too large/i.test(detail)) {
    return t("uploadErrorTooLarge");
  }
  if (status === 507 || /espace est plein|storage is full/i.test(detail)) {
    return t("uploadErrorQuota");
  }
  if (
    status === 422 ||
    /livre reconnu|Formats acceptés|not a recognized/i.test(detail)
  ) {
    return t("uploadErrorBadFormat");
  }
  return t("uploadErrorGeneric");
}

function uploadWithProgress(
  file: File,
  token: string | null,
  onProgress: (percent: number) => void
): Promise<LibraryItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/books/upload");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as LibraryItem);
        } catch (error) {
          reject(error);
        }
        return;
      }
      reject({ status: xhr.status, detail: parseDetail(xhr.responseText || "") });
    };
    xhr.onerror = () => reject({ status: 0, detail: "" });
    xhr.onabort = () => reject({ status: 0, detail: "" });
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export function UploadDropzone({
  onUploaded,
}: {
  onUploaded: (item: LibraryItem) => void;
}) {
  const t = useTranslations("library");
  const { getToken } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [rows, setRows] = useState<UploadRow[]>([]);

  const updateRow = useCallback((id: string, patch: Partial<UploadRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const token = await getToken();

      for (const file of files) {
        const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`;
        const ext = `.${(file.name.split(".").pop() || "").toLowerCase()}`;

        if (!ACCEPTED_EXTENSIONS.has(ext)) {
          setRows((prev) => [
            ...prev,
            {
              id,
              name: file.name,
              progress: 0,
              status: "error",
              error: t("uploadErrorBadFormat"),
            },
          ]);
          toast.error(t("uploadErrorBadFormat"));
          continue;
        }

        if (file.size > MAX_UPLOAD_BYTES) {
          setRows((prev) => [
            ...prev,
            {
              id,
              name: file.name,
              progress: 0,
              status: "error",
              error: t("uploadErrorTooLarge"),
            },
          ]);
          toast.error(t("uploadErrorTooLarge"));
          continue;
        }

        setRows((prev) => [
          ...prev,
          { id, name: file.name, progress: 0, status: "uploading" },
        ]);

        try {
          const item = await uploadWithProgress(file, token, (progress) => {
            updateRow(id, { progress });
          });
          updateRow(id, { progress: 100, status: "done" });
          onUploaded(item);
          toast.success(t("toastUploaded", { title: item.title }));
        } catch (error) {
          const status =
            error && typeof error === "object" && "status" in error
              ? Number((error as { status: number }).status)
              : 0;
          const detail =
            error && typeof error === "object" && "detail" in error
              ? String((error as { detail: string }).detail)
              : "";
          const message = mapUploadError(status, detail, t);
          updateRow(id, { status: "error", error: message });
          toast.error(message);
        }
      }

      if (inputRef.current) inputRef.current.value = "";
    },
    [getToken, onUploaded, t, updateRow]
  );

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void processFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/20 px-4 py-10 text-center transition-colors",
          dragOver && "border-primary/50 bg-muted/40"
        )}
      >
        <Upload className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">{t("uploadDropHint")}</p>
        <p className="text-xs text-muted-foreground">{t("uploadFormatsHint")}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".epub,.pdf,.mobi,.azw3"
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) void processFiles(event.target.files);
          }}
        />
      </div>

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-md border border-border/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{row.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {row.status === "uploading" && `${row.progress}%`}
                  {row.status === "done" && t("uploadDone")}
                  {row.status === "error" && t("uploadFailed")}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-150",
                    row.status === "error" ? "bg-destructive" : "bg-primary"
                  )}
                  style={{
                    width: `${row.status === "error" ? 100 : row.progress}%`,
                  }}
                />
              </div>
              {row.error && (
                <p className="mt-1 text-xs text-destructive">{row.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
