import { Card, CardContent } from "@/components/ui/card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";

const STEPS = [
  {
    number: "01",
    title: "Pair your gateway",
    body: "Create a gateway, run the bundle on your own box, done.",
  },
  {
    number: "02",
    title: "Search",
    body: "Legal sources and your paired gateways, in one query.",
  },
  {
    number: "03",
    title: "Deliver",
    body: "Pick a device. Ferry Agent handles the format and the route.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <h2 className="font-heading text-3xl font-medium tracking-tight">
          How it works.
        </h2>
      </Reveal>
      <RevealGroup className="mt-10 grid gap-6 md:grid-cols-3" stagger={0.12}>
        {STEPS.map((step) => (
          <RevealItem key={step.number}>
            <Card className="h-full border-border/60 bg-card/40 transition hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent className="pt-2">
                <span className="font-heading text-sm text-muted-foreground">
                  {step.number}
                </span>
                <h3 className="mt-2 font-heading text-xl font-medium">
                  {step.title}
                </h3>
                <p className="mt-2 text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
