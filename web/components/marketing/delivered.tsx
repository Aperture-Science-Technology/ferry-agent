import { Separator } from "@/components/ui/separator";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";

const DELIVERIES = [
  { name: "Kindle", body: "Arrives on its own. No gesture." },
  { name: "Kobo", body: "One sync away." },
  { name: "Tolino", body: "A code, in your browser." },
  { name: "USB", body: "The net. Always." },
];

export function Delivered() {
  return (
    <section id="delivered" className="mx-auto max-w-4xl px-6 py-24">
      <Reveal>
        <h2 className="font-heading text-3xl font-medium tracking-tight">
          Delivered.
        </h2>
      </Reveal>
      <RevealGroup className="mt-10" stagger={0.1}>
        {DELIVERIES.map((item, index) => (
          <RevealItem key={item.name}>
            {index > 0 && <Separator className="bg-border/60" />}
            <div className="flex items-center justify-between gap-6 py-6 transition hover:translate-x-1">
              <span className="font-heading text-xl font-medium sm:text-2xl">
                {item.name}
              </span>
              <span className="text-right text-muted-foreground">{item.body}</span>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
