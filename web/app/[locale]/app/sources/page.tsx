import { Database } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { safeApiFetch } from "@/lib/api";
import type { Source } from "@/lib/types";

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.sources");
  const tSources = await getTranslations("sources");
  const sources = await safeApiFetch<Source[]>("/api/v1/sources");

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      {!sources || sources.length === 0 ? (
        <EmptyState
          icon={Database}
          title={tSources("emptyTitle")}
          description={
            sources === null ? tSources("emptyUnavailable") : tSources("emptyNone")
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tSources("colType")}</TableHead>
                <TableHead>{tSources("colConfig")}</TableHead>
                <TableHead>{tSources("colAdded")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <Badge variant="secondary">{source.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {JSON.stringify(source.config)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(source.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
