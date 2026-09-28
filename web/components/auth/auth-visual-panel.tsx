import Image from "next/image";
import { Library } from "lucide-react";

const RAY_ROTATIONS = [
  "rotate-0",
  "rotate-45",
  "rotate-90",
  "rotate-[135deg]",
  "rotate-180",
  "rotate-[225deg]",
  "rotate-[270deg]",
  "rotate-[315deg]",
] as const;

type AuthVisualPanelProps = {
  imageSrc: string;
  imageAlt: string;
  quote: string;
  caption?: string;
};

/**
 * Right-hand auth panel (720×1024 desktop): muted field, radial motif, cover art.
 * Hidden below the `lg` breakpoint (1024px).
 */
export function AuthVisualPanel({
  imageSrc,
  imageAlt,
  quote,
  caption,
}: AuthVisualPanelProps) {
  return (
    <aside
      data-testid="auth-visual-panel"
      className="relative hidden h-full min-h-screen w-[720px] shrink-0 overflow-hidden bg-muted lg:block"
    >
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        priority
        sizes="720px"
        className="object-cover"
      />

      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        <div className="absolute size-[400px] rounded-full border-2 border-[#FFFFFF12]" />
        <div className="absolute size-[240px] rounded-full border-2 border-[#FFFFFF12]" />
        {RAY_ROTATIONS.map((rotation) => (
          <div
            key={rotation}
            className={`absolute h-[104px] w-0.5 origin-bottom -translate-y-[52px] bg-[#FFFFFF10] ${rotation}`}
          />
        ))}
        <div className="absolute flex size-[120px] items-center justify-center rounded-full border border-[#FFFFFF18] bg-[#171717]">
          <Library className="size-9 text-[#FFFFFF55]" strokeWidth={1.5} />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-10 pb-12">
        <p className="text-base text-[#FFFFFF88]">{quote}</p>
        {caption ? (
          <p className="text-base text-[#FFFFFFAA]">{caption}</p>
        ) : null}
      </div>
    </aside>
  );
}
