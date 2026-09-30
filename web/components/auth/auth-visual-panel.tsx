import Image from "next/image";
import { BrandMark } from "@/components/brand-logo";

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
 * Right-hand auth panel (responsive desktop): muted field, radial motif, cover art.
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
      className="relative hidden h-full min-h-screen w-[46%] min-w-[420px] max-w-[720px] shrink-0 overflow-hidden bg-muted lg:block"
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
        <div className="absolute flex size-[120px] items-center justify-center rounded-full border border-white/[0.09] bg-[#171717]">
          <BrandMark className="size-9 text-[#FFFFFF66]" />
        </div>
      </div>

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[280px] bg-gradient-to-t from-black/75 via-black/35 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-10 pb-12">
        <p className="text-base text-[#F2F2F2]">{quote}</p>
        {caption ? (
          <p className="text-base text-[#D4D4D4]">{caption}</p>
        ) : null}
      </div>
    </aside>
  );
}
