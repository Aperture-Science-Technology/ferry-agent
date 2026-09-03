import { Card, CardContent } from "@/components/ui/card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";

const VALUES = [
  {
    title: "Self-hosted. Yours alone.",
    body: "Your library never leaves your infrastructure.",
  },
  {
    title: "Legal sources. Connected.",
    body: "Gutenberg, Standard Ebooks, upload, OPDS — search once, deliver anywhere.",
  },
  {
    title: "Detached by design.",
    body: "The private leg lives on your own box. It is never ours.",
  },
];

export function ValueProps() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="mb-12 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Why Ferry Agent
        </p>
      </Reveal>
      <RevealGroup className="grid gap-6 md:grid-cols-3">
        {VALUES.map((value) => (
          <RevealItem key={value.title}>
            <Card className="h-full border-border/60 bg-card/40 transition hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent className="pt-2">
                <h2 className="font-heading text-2xl font-medium tracking-tight text-balance">
                  {value.title}
                </h2>
                <p className="mt-3 text-muted-foreground">{value.body}</p>
              </CardContent>
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
