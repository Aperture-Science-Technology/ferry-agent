import { Database } from "lucide-react";
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

export default async function SourcesPage() {
  const sources = await safeApiFetch<Source[]>("/api/v1/sources");

  return (
    <div>
      <PageHeader
        title="Sources"
        description="Sources légales et connecteurs configurés pour la recherche."
      />
      {!sources || sources.length === 0 ? (
        <EmptyState
          icon={Database}
          title="Aucune source listée"
          description={
            sources === null
              ? "Le core ne renvoie pas encore de liste de sources (endpoint GET /api/v1/sources manquant). Gutenberg et Standard Ebooks restent utilisables depuis la recherche."
              : "Aucune source configurée pour le moment."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Configuration</TableHead>
                <TableHead>Ajoutée</TableHead>
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
