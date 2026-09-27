"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const AGENT_KEYS = ["claude", "chatgpt", "mistral"] as const;
type AgentKey = (typeof AGENT_KEYS)[number];

/**
 * Pen AI Agents block — accordion (single open) + routing diagram SVG.
 * Lives as the second child inside the Why & AI envelope (`ValueProps`).
 */
export function McpSpotlight() {
  const t = useTranslations("mcpSpotlight");
  const tStatus = useTranslations("deliveries.statuses");
  const tDevices = useTranslations("landing.devices.cards");
  const baseId = useId();
  const [open, setOpen] = useState<AgentKey>("claude");

  const statusLabel = `${tStatus("queued")} · ${tDevices("kindle.title")}`;

  return (
    <div
      id="mcp"
      data-testid="landing-mcp"
      className="flex w-full flex-col items-center gap-7 rounded-2xl border border-white/15 bg-muted px-5 py-6 md:flex-row md:items-stretch md:gap-10 md:p-10"
      aria-labelledby={`${baseId}-title`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-7">
        <p className="text-xs font-semibold tracking-[1.4px] text-muted-foreground uppercase">
          {t("eyebrow")}
        </p>
        <h2
          id={`${baseId}-title`}
          className="text-[36px] leading-[1.15] font-semibold tracking-[-0.8px] text-foreground text-balance"
        >
          {t("title")}
        </h2>
        <p className="text-[15px] leading-[1.6] text-muted-foreground text-pretty">
          {t("body")}
        </p>

        <div className="flex w-full flex-col pt-2">
          {AGENT_KEYS.map((key) => {
            const panelId = `${baseId}-panel-${key}`;
            const isOpen = open === key;
            return (
              <div
                key={key}
                className={cn(
                  "border-b border-white/10",
                  isOpen ? "flex flex-col gap-3 py-5" : "py-5"
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(key)}
                >
                  <span className="text-[18px] font-medium text-foreground">
                    {t(`agents.${key}.name`)}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-[18px] shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                {isOpen ? (
                  <p
                    id={panelId}
                    className="text-[15px] leading-[1.55] text-muted-foreground text-pretty"
                  >
                    {t(`agents.${key}.body`)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <RoutingDiagram active={open} statusLabel={statusLabel} />
    </div>
  );
}

function RoutingDiagram({
  active,
  statusLabel,
}: {
  active: AgentKey;
  statusLabel: string;
}) {
  return (
    <div className="shrink-0 overflow-hidden rounded-3xl bg-background">
      <svg
        aria-hidden="true"
        viewBox="0 0 480 520"
        preserveAspectRatio="none"
        className="h-[336px] w-[280px] md:h-[520px] md:w-[480px]"
      >
        <defs>
          <radialGradient id="ai-ambient-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.333" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ai-agent-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse
          cx="240"
          cy="268"
          rx="120"
          ry="120"
          fill="url(#ai-ambient-glow)"
          opacity="0.28"
        />

        <ellipse
          cx={active === "claude" ? 96 : active === "chatgpt" ? 240 : 384}
          cy="80"
          rx="58"
          ry="58"
          fill="url(#ai-agent-glow)"
        />

        <AgentCurve agent="claude" active={active} />
        <AgentCurve agent="chatgpt" active={active} />
        <AgentCurve agent="mistral" active={active} />

        <AgentNode agent="claude" active={active} />
        <AgentNode agent="chatgpt" active={active} />
        <AgentNode agent="mistral" active={active} />

        {/* Hub */}
        <circle
          cx="240"
          cy="268"
          r="34"
          className="fill-[#141414] stroke-white/20"
          strokeWidth="1"
        />
        <g transform="translate(229 257)">
          <rect
            width="8"
            height="22"
            rx="2"
            className="fill-foreground"
          />
          <rect
            x="12"
            width="8"
            height="22"
            rx="2"
            className="fill-foreground"
          />
        </g>

        {/* Line to device */}
        <line
          x1="240"
          y1="302"
          x2="240"
          y2="424"
          className="stroke-blue-500"
          strokeWidth="1.5"
        />

        {/* Status pill */}
        <rect
          x="161"
          y="424"
          width="158"
          height="33"
          rx="16.5"
          className="fill-[#141414] stroke-white/20"
          strokeWidth="1"
        />
        <circle cx="184" cy="440.5" r="3.5" className="fill-blue-400" />
        <text
          x="198"
          y="445"
          className="fill-foreground"
          fontSize="13"
          fontWeight="500"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {statusLabel}
        </text>
      </svg>
    </div>
  );
}

function AgentCurve({
  agent,
  active,
}: {
  agent: AgentKey;
  active: AgentKey;
}) {
  const isActive = agent === active;
  const stroke = isActive ? "stroke-blue-400" : "stroke-white/20";

  if (agent === "chatgpt") {
    return (
      <line
        x1="240"
        y1="116"
        x2="240"
        y2="234"
        className={cn(stroke, !isActive && "opacity-85")}
        strokeWidth="1.5"
      />
    );
  }

  if (agent === "claude") {
    return (
      <path
        d="M96 116c0 65 144 30 144 118"
        fill="none"
        className={cn(stroke, !isActive && "opacity-85")}
        strokeWidth="1.5"
      />
    );
  }

  return (
    <path
      d="M384 116c0 65-144 30-144 118"
      fill="none"
      className={cn(stroke, !isActive && "opacity-85")}
      strokeWidth="1.5"
    />
  );
}

function AgentNode({
  agent,
  active,
}: {
  agent: AgentKey;
  active: AgentKey;
}) {
  const isActive = agent === active;
  const x = agent === "claude" ? 60 : agent === "chatgpt" ? 204 : 348;

  return (
    <g className={cn(!isActive && "opacity-85")}>
      <circle
        cx={x + 36}
        cy={80}
        r="36"
        className={cn(
          "fill-[#141414]",
          isActive ? "stroke-blue-400" : "stroke-white/20"
        )}
        strokeWidth={isActive ? 1.5 : 1}
      />
      <svg x={x + 19} y={63} width="34" height="34" viewBox="0 0 24 24">
        <AgentMark agent={agent} />
      </svg>
    </g>
  );
}

/** Vector marks extracted from ferry-landing.pen (Claude Mark, OpenAI Mark, M1–M5). */
function AgentMark({ agent }: { agent: AgentKey }) {
  if (agent === "claude") {
    return (
      <path
        fill="#D4A27F"
        d="M17.3041 3.541h-3.6718l6.696 16.918h3.6717z m-10.6082 0l-6.6959 16.918h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442l-6.6959-16.9182z m-0.3712 10.2232l2.2914-5.9456 2.2914 5.9456z"
      />
    );
  }

  if (agent === "chatgpt") {
    return (
      <path
        fill="#FAFAFA"
        d="M22.2819 9.8211a5.9847 5.9847 0 0 0-0.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9 6.0651 6.0651 0 0 0-10.2757 2.1715 5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 0.7427 7.0966 5.98 5.98 0 0 0 0.511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001 5.9847 5.9847 0 0 0 4.5086 2.0108 6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-0.7475-7.0729z m-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l0.1419-0.0804 4.7783-2.7582a0.7948 0.7948 0 0 0 0.3927-0.6813v-6.7369l2.02 1.1686a0.071 0.071 0 0 1 0.038 0.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944z m-9.6607-4.1254a4.4708 4.4708 0 0 1-0.5346-3.0137l0.142 0.0852 4.783 2.7582a0.7712 0.7712 0 0 0 0.7806 0l5.8428-3.3685v2.3324a0.0804 0.0804 0 0 1-0.0332 0.0615l-4.8398 2.7913a4.4992 4.4992 0 0 1-6.1408-1.6464z m-1.2584-10.4082a4.485 4.485 0 0 1 2.3655-1.9728v5.6772a0.7664 0.7664 0 0 0 0.3879 0.6765l5.8144 3.3543-2.0201 1.1685a0.0757 0.0757 0 0 1-0.071 0l-4.8303-2.7865a4.504 4.504 0 0 1-1.6464-6.1408z m16.5963 3.8558l-5.8333-3.3874 2.0154-1.164a0.0757 0.0757 0 0 1 0.071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-0.6765 8.1042v-5.6772a0.79 0.79 0 0 0-0.407-0.667z m2.0107-3.0231l-0.142-0.0852-4.7735-2.7818a0.7759 0.7759 0 0 0-0.7854 0l-5.8379 3.3684v-2.3323a0.0662 0.0662 0 0 1 0.0284-0.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66z m-12.6413 4.1347l-2.02-1.1638a0.0804 0.0804 0 0 1-0.038-0.0567v-5.5683a4.4992 4.4992 0 0 1 7.3757-3.4537l-0.142 0.0805-4.7782 2.758a0.7948 0.7948 0 0 0-0.3927 0.6813z m1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997z"
      />
    );
  }

  return (
    <>
      <path
        fill="#FFD700"
        d="M3.428 3.4h3.429v3.428h-3.429v-3.428z m13.714 0h3.43v3.428h-3.43v-3.428z"
      />
      <path
        fill="#FFAF00"
        d="M3.428 6.828h6.857v3.429h-6.856v-3.429z m10.286 0h6.857v3.429h-6.857v-3.429z"
      />
      <path fill="#FF8205" d="M3.428 10.258h17.144v3.428h-17.144v-3.428z" />
      <path
        fill="#FA500F"
        d="M3.428 13.686h3.429v3.428h-3.429v-3.428z m6.858 0h3.429v3.428h-3.429v-3.428z m6.856 0h3.43v3.428h-3.43v-3.428z"
      />
      <path
        fill="#E10500"
        d="M0 17.114h10.286v3.429h-10.286v-3.429z m13.714 0h10.286v3.429h-10.286v-3.429z"
      />
    </>
  );
}
