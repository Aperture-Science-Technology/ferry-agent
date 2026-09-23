"use client";

import { useId } from "react";
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
  disabled = false,
}: {
  value: ConversionPreset | null;
  onChange: (value: ConversionPreset | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("editDevice");
  const selectId = useId();
  const hintId = useId();
  const selectValue = value ?? PROFILE_AUTO;

  return (
    <div className="space-y-2">
      <Label htmlFor={selectId}>{t("conversionProfile")}</Label>
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (!next) return;
          onChange(next === PROFILE_AUTO ? null : (next as ConversionPreset));
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={selectId}
          className="w-full"
          aria-describedby={selectValue === PROFILE_AUTO ? hintId : undefined}
        >
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
        <p
          id={hintId}
          className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground"
        >
          {t("conversionProfileAutoHint")}
        </p>
      ) : null}
    </div>
  );
}
