import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "@/components/motion/reveal";

const FAQS = [
  {
    q: "Is it self-hosted?",
    a: "Yes. The core and your library run on your own infrastructure. Nothing is stored on servers we control.",
  },
  {
    q: "Do I need a gateway for the legal sources?",
    a: "No. Gutenberg, Standard Ebooks and uploads work out of the box. A gateway is only needed for sources that live on your own private network.",
  },
  {
    q: "Which readers are supported?",
    a: "Kindle (Send-to-Kindle email), Kobo and cloud-linked devices, Tolino and other browsers via a short-lived code, and any USB-connected reader.",
  },
  {
    q: "Is the data mine?",
    a: "Yes. Your library, your devices, your delivery history — all stored on your own instance.",
  },
  {
    q: "Can an agent use it?",
    a: "Yes. The core exposes a JSON API behind the same auth as the dashboard, so an automated agent can search and deliver on your behalf.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <Reveal>
        <h2 className="font-heading text-3xl font-medium tracking-tight">
          Questions. Answered.
        </h2>
      </Reveal>
      <Reveal delay={0.1} className="mt-8">
        <Accordion>
          {FAQS.map((item, index) => (
            <AccordionItem key={item.q} value={`item-${index}`}>
              <AccordionTrigger className="font-heading text-left text-lg font-medium">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}
