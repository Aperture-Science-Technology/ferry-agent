"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConversionPreset } from "@/lib/types";

const PROFILE_AUTO = "auto";
const PRESETS: ConversionPreset[] = ["reader_6in", "reader_7in_plus", "tablet"];

export function conversionProfileLabel(
  profile: ConversionPreset | null,
  t: (key: string) => string,
): string {
  if (!profile) return t("conversionProfileAuto");
  return t(`conversionProfiles.${profile}`);
}

export function ConversionProfileField({
  value,
  onChange,
}: {
  value: ConversionPreset | null;
  onChange: (value: ConversionPreset | null) => void;
}) {
  const t = useTranslations("editDevice");
  const selectValue = value ?? PROFILE_AUTO;

  return (
    <div className="space-y-2">
      <Label>{t("conversionProfile")}</Label>
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (!next) return;
          onChange(next === PROFILE_AUTO ? null : (next as ConversionPreset));
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PROFILE_AUTO}>{t("conversionProfileAuto")}</SelectItem>
          {PRESETS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {t(`conversionProfiles.${preset}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectValue === PROFILE_AUTO ? (
        <p className="text-muted-foreground text-xs">{t("conversionProfileAutoHint")}</p>
      ) : null}
    </div>
  );
}
