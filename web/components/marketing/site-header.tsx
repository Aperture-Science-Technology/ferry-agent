import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          Ferry Agent
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="#how-it-works" className="transition hover:text-foreground">
            How it works
          </Link>
          <Link href="#delivered" className="transition hover:text-foreground">
            Delivered
          </Link>
          <Link href="#faq" className="transition hover:text-foreground">
            FAQ
          </Link>
          <Link href="/docs" className="transition hover:text-foreground">
            Docs
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton>
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </SignInButton>
            <SignInButton>
              <Button size="sm">Open Dashboard</Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Button size="sm" render={<Link href="/app/bibliotheque">Dashboard</Link>} />
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
