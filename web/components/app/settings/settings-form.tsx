"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
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
            {t("deliveryTitle")}
          </CardTitle>
          <CardDescription>{t("deliveryDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("kindleEmail")}</Label>
            <Input
              type="email"
              value={kindleEmail}
              onChange={(event) => setKindleEmail(event.target.value)}
              placeholder={t("kindleEmailPlaceholder")}
            />
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
          </div>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {tCommon("save")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-medium">{t("smtpTitle")}</CardTitle>
          <CardDescription>{t("smtpDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="size-4" />
            {t("smtpHint")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
