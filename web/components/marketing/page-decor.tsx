/**
 * Landing page atmosphere layers from Pen ba89b7b:
 * - Desktop (lg+): Page Top Dark Fade + Footer Blue Gradient (with three halos)
 * - Mobile/tablet (< lg): Page Top / Bottom Vignettes
 *
 * Decorative only — never applied to the header chrome. Anchored to the page
 * shell so the footer gradient stays at the bottom regardless of content height.
 * Halos use % of the 1440×760 design frame so they scale without hard px pins.
 */
const TOP_DARK_FADE =
  "linear-gradient(to bottom, rgba(26, 26, 26, 0.333) 0%, rgba(17, 17, 17, 0.133) 35%, rgba(10, 10, 0, 0) 82%)";

const FOOTER_BLUE_GRADIENT =
  "linear-gradient(to bottom, rgba(10, 10, 0, 0) 0%, rgba(10, 16, 26, 0.04) 40%, rgba(18, 54, 94, 0.196) 100%)";

const TOP_VIGNETTE =
  "linear-gradient(to bottom, rgba(10, 10, 10, 0.91) 0%, rgba(10, 10, 0, 0.094) 72%, rgba(10, 10, 0, 0) 100%)";

const BOTTOM_VIGNETTE =
  "linear-gradient(to bottom, rgba(10, 10, 0, 0) 0%, rgba(10, 10, 0, 0.094) 28%, rgba(10, 10, 10, 0.91) 100%)";

/** Halos laid out in the Pen’s 1440×760 Footer Blue Gradient frame. */
const FOOTER_HALOS = [
  {
    // 788×392 at (−124, 433), ellipse at 25% / 75%
    width: "54.7222%",
    height: "51.5789%",
    left: "-8.6111%",
    top: "56.9737%",
    at: "25% 75%",
  },
  {
    // 670×505 at (869, 380), ellipse at 75% / 70%
    width: "46.5278%",
    height: "66.4474%",
    left: "60.3472%",
    top: "50%",
    at: "75% 70%",
  },
  {
    // 437×296 at (−124, 529), ellipse at 25% / 75%
    width: "30.3472%",
    height: "38.9474%",
    left: "-8.6111%",
    top: "69.6053%",
    at: "25% 75%",
  },
] as const;

function haloBackground(at: string): string {
  return `radial-gradient(ellipse at ${at}, rgba(14, 74, 139, 0.188) 0%, rgba(14, 74, 139, 0) 100%)`;
}

export function PageDecor() {
  return (
    <div
      aria-hidden="true"
      data-testid="landing-page-decor"
      className="pointer-events-none absolute inset-0 z-0 overflow-x-hidden"
    >
      {/* Page Top Dark Fade — desktop only, full width, 420 px tall */}
      <div
        className="absolute inset-x-0 top-0 hidden h-[420px] lg:block"
        style={{ backgroundImage: TOP_DARK_FADE }}
      />

      {/* Footer Blue Gradient — desktop only, anchored to page bottom */}
      <div className="absolute inset-x-0 bottom-0 hidden h-[760px] overflow-hidden lg:block">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: FOOTER_BLUE_GRADIENT }}
        />
        {FOOTER_HALOS.map((halo) => (
          <div
            key={`${halo.left}-${halo.top}-${halo.width}`}
            className="absolute"
            style={{
              width: halo.width,
              height: halo.height,
              left: halo.left,
              top: halo.top,
              backgroundImage: haloBackground(halo.at),
              filter: "blur(84px)",
            }}
          />
        ))}
      </div>

      {/*
        Page Top Vignette — mobile/tablet. Starts just under the header bar
        (Pen ≈ 92 px). Kept at z-0 under main so the 0.91 black stop does not
        wash out the hero title.
      */}
      <div
        className="absolute inset-x-0 top-[92px] h-[180px] lg:hidden"
        style={{ backgroundImage: TOP_VIGNETTE }}
      />

      {/* Page Bottom Vignette — mobile/tablet, pinned to page bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-[180px] lg:hidden"
        style={{ backgroundImage: BOTTOM_VIGNETTE }}
      />
    </div>
  );
}
