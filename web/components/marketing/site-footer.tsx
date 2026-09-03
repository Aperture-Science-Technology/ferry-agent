import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-6 py-10">
      <Separator className="mb-8 bg-border/60" />
      <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <p>Built by Aperture Science Technology</p>
        <div className="flex items-center gap-6">
          <span>open-source</span>
          <Link href="/docs" className="transition hover:text-foreground">
            docs
          </Link>
          <Link href="/app/bibliotheque" className="transition hover:text-foreground">
            dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
