"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { SourcesManager } from "@/components/app/sources/sources-manager";
import { useApiClient } from "@/lib/api-client";
import type { Source } from "@/lib/types";

const FORMATS = ["epub", "mobi", "azw3", "pdf"];

export function SettingsForm({
  initialEmail,
  initialKindleEmail,
  initialDefaultFormat,
  settingsUnavailable,
  initialSources,
  sourcesUnavailable,
}: {
  initialEmail: string;
  initialKindleEmail: string;
  initialDefaultFormat: string;
  settingsUnavailable: boolean;
  initialSources: Source[];
  sourcesUnavailable: boolean;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
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
      toast.success(t("toastSaved"));
    } catch {
      toast.error(t("toastFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {settingsUnavailable && (
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
      )}

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-medium">
            {t("accountTitle")}
          </CardTitle>
          <CardDescription>{t("accountDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("email")}</Label>
            <Input value={initialEmail} readOnly disabled />
            <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("kindleEmail")}</Label>
            <Input
              type="email"
              value={kindleEmail}
              onChange={(event) => setKindleEmail(event.target.value)}
              placeholder={t("kindleEmailPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("kindleEmailHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("defaultFormat")}</Label>
            <Select
              value={defaultFormat}
              onValueChange={(value) => setDefaultFormat(value ?? "epub")}
            >
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
            <p className="text-xs text-muted-foreground">{t("defaultFormatHint")}</p>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {tCommon("save")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-medium">
            {t("sourcesTitle")}
          </CardTitle>
          <CardDescription>{t("sourcesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SourcesManager initialSources={initialSources} sourcesUnavailable={sourcesUnavailable} />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-medium">
            {t("devicesTitle")}
          </CardTitle>
          <CardDescription>{t("devicesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            render={
              <Link href="/app/appareils">
                {t("devicesCta")}
                <ArrowRight />
              </Link>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
