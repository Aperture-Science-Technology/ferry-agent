"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X, ArrowUp, ArrowDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export type FilterField = {
  key: string; label: string; value: string; defaultValue: string;
  options?: { value: string; label: string }[];
  kind?: "text" | "toggle" | "buttons";
  placeholder?: string;
};

export function FilterBar({ search, fields, count, onChange, onReset, label, testId }: {
  // Library keeps its validated search input in the page header.
  search?: { label: string; value: string; external?: boolean };
  fields: FilterField[];
  count: number | null;
  onChange: (values: Record<string, string | null>) => void;
  onReset: () => void;
  label?: string;
  testId?: string;
}) {
  const t = useTranslations("enhance.filters");
  const id = useId();
  const mobile = useIsMobile();
  const active = fields.filter(field => field.value !== field.defaultValue);
  const controls = <div className="flex min-w-0 flex-wrap items-end gap-3">
    {fields.map(field => {
      const fieldId = `${id}-${field.key}`;
      return <div key={field.key} className="flex min-w-0 max-w-full flex-col gap-2">
        <Label id={`${fieldId}-label`} htmlFor={fieldId}>{field.label}</Label>
        {field.kind === "text" ? <Input id={fieldId} value={field.value} placeholder={field.placeholder} onChange={event => onChange({ [field.key]: event.target.value })} />
          : field.kind === "toggle" ? <Switch id={fieldId} checked={field.value === "1"} onCheckedChange={checked => onChange({ [field.key]: checked ? "1" : null })} />
          : field.kind === "buttons" ? <div className="flex flex-wrap gap-2">{field.options?.map(option => <Button key={option.value} variant={field.value === option.value ? "default" : "ghost"} aria-pressed={field.value === option.value} onClick={() => onChange({ [field.key]: option.value })}>{option.label}</Button>)}</div>
          : <Select value={field.value} items={field.options} onValueChange={value => onChange({ [field.key]: value })}>
            <SelectTrigger id={fieldId} aria-labelledby={`${fieldId}-label`} className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>{field.options?.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>}
      </div>;
    })}
  </div>;
  return <div role="group" aria-label={label ?? t("title")} data-testid={testId} className="flex min-w-0 flex-col gap-3 py-3">
    {search && !search.external ? <Input aria-label={search.label} placeholder={search.label} value={search.value} onChange={event => onChange({ q: event.target.value })} /> : null}
    {mobile ? <Sheet><SheetTrigger render={<Button variant="outline" className="w-full" />}><SlidersHorizontal />{t("title")}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto p-4 motion-reduce:transition-none">
        <SheetHeader><SheetTitle>{t("title")}</SheetTitle><SheetDescription>{t("description")}</SheetDescription></SheetHeader>
        {controls}
      </SheetContent>
    </Sheet> : controls}
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {search?.value ? <Badge variant="secondary" className="max-w-full whitespace-normal break-all">{search.value}<Button size="icon-xs" variant="ghost" aria-label={t("remove", { label: search.label })} onClick={() => onChange({ q: null })}><X /></Button></Badge> : null}
      {active.map(field => <Badge key={field.key} variant="secondary" className="max-w-full whitespace-normal break-words">
        {field.label}{field.kind === "toggle" ? "" : ` : ${field.options?.find(option => option.value === field.value)?.label ?? field.value}`}
        <Button size="icon-xs" variant="ghost" aria-label={t("remove", { label: field.label })} onClick={() => onChange({ [field.key]: field.defaultValue })}><X /></Button>
      </Badge>)}
      {count !== null ? <p role="status" className="text-sm text-muted-foreground">{t("count", { count })}</p> : null}
      <Button variant="ghost" size="sm" onClick={onReset} disabled={!active.length && !search?.value}>{t("reset")}</Button>
    </div>
  </div>;
}

export function SortColumns({ columns, value, descending, onChange }: {
  columns: { value: string; label: string }[]; value: string; descending: boolean;
  onChange: (value: string, descending: boolean) => void;
}) {
  const t = useTranslations("enhance.filters");
  return <div role="group" aria-label={t("sort")} className="flex flex-wrap gap-2 border-b py-2">
    {columns.map(column => <Button key={column.value} size="sm" variant="ghost" className="h-auto min-h-10 max-w-full whitespace-normal" aria-pressed={value === column.value}
      aria-label={t("sortBy", { label: column.label, direction: value === column.value && descending ? t("descending") : t("ascending") })}
      onClick={() => onChange(column.value, value === column.value ? !descending : false)}>
      {column.label}{value === column.value ? descending ? <ArrowDown aria-hidden /> : <ArrowUp aria-hidden /> : null}
    </Button>)}
  </div>;
}
