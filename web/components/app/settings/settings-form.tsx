"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiClient } from "@/lib/api-client";

const FORMATS = ["epub", "mobi", "azw3", "pdf"];

export function SettingsForm({
  initialKindleEmail,
  initialDefaultFormat,
  settingsUnavailable,
}: {
  initialKindleEmail: string;
  initialDefaultFormat: string;
  settingsUnavailable: boolean;
}) {
  const { call } = useApiClient();
  const [kindleEmail, setKindleEmail] = useState(initialKindleEmail);
  const [defaultFormat, setDefaultFormat] = useState(initialDefaultFormat);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await call("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          kindle_email: kindleEmail || null,
          default_format: defaultFormat,
        }),
      });
      toast.success("Réglages enregistrés.");
    } catch {
      toast.error(
        "Impossible d'enregistrer (PATCH /api/v1/users/me n'est pas encore disponible côté core)."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {settingsUnavailable && (
        <p className="text-sm text-muted-foreground">
          Le core ne renvoie pas encore ces réglages (endpoint GET/PATCH
          /api/v1/users/me manquant) — les valeurs par défaut sont affichées.
        </p>
      )}

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-medium">Livraison</CardTitle>
          <CardDescription>
            Utilisées comme destination et format par défaut lors d&apos;une livraison.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Adresse Kindle (Send-to-Kindle)</Label>
            <Input
              type="email"
              value={kindleEmail}
              onChange={(event) => setKindleEmail(event.target.value)}
              placeholder="votre-nom@kindle.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Format par défaut</Label>
            <Select value={defaultFormat} onValueChange={(value) => setDefaultFormat(value ?? "epub")}>
              <SelectTrigger className="w-full uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((format) => (
                  <SelectItem key={format} value={format} className="uppercase">
                    {format}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-medium">SMTP (tier A)</CardTitle>
          <CardDescription>Envoi Send-to-Kindle par email.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="size-4" />
            Configuré par l&apos;administrateur via les variables
            <Badge variant="secondary" className="font-mono text-xs">
              SMTP_*
            </Badge>
            du core.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
