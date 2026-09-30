import Image from "next/image";

type AuthVisualPanelProps = {
  imageSrc: string;
  imageAlt: string;
  quote: string;
  caption?: string;
};

/**
 * Right-hand auth panel (responsive desktop): cover art with bottom quote.
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
