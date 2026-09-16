"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CloudGatewayIllustration } from "@/components/illustrations";
import { PassageRule } from "@/components/passage-rule";
import { GATEWAY_IMAGE_DOWNLOAD_URL } from "@/lib/gateway-image";

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

/** Existing public MCP endpoint — not an install archive URL. */
const MCP_URL = "https://ferry-agent.aperture-agency.org/mcp";

export function ByoInstallGuide() {
  const t = useTranslations("docs");

  const checklistItems = [
    t("checklistItem1"),
    t("checklistItem2"),
    t("checklistItem3"),
  ];

  const glossaryItems = [
    { term: t("glossaryAccessTerm"), def: t("glossaryAccessDef") },
    { term: t("glossaryCodesTerm"), def: t("glossaryCodesDef") },
    { term: t("glossaryIndexerTerm"), def: t("glossaryIndexerDef") },
    { term: t("glossaryProwlarrTerm"), def: t("glossaryProwlarrDef") },
  ];

  const steps = [
    {
      number: "01",
      title: t("step1Title"),
      action: t("step1Action"),
      success: t("step1Success"),
      cta: (
        <Button render={<Link href="/app/gateways">{t("step1Cta")}</Link>} />
      ),
    },
    {
      number: "02",
      title: t("step2Title"),
      action: t("step2Action"),
      extra: (
        <div className="space-y-3">
          <Button
            render={
              <a href={GATEWAY_IMAGE_DOWNLOAD_URL} rel="noopener noreferrer">
                {t("step2Cta")}
              </a>
            }
          />
          <p className="text-muted-foreground">{t("step2UseFile")}</p>
        </div>
      ),
      success: t("step2Success"),
    },
    {
      number: "03",
      title: t("step3Title"),
      action: t("step3Action"),
      success: t("step3Success"),
    },
    {
      number: "04",
      title: t("step4Title"),
      action: t("step4Action"),
      hint: t("step4Hint"),
      success: t("step4Success"),
    },
    {
      number: "05",
      title: t("step5Title"),
      action: t("step5Action"),
      success: t("step5Success"),
      extra: (
        <Button
          variant="outline"
          render={<Link href="/app/gateways">{t("step5Cta")}</Link>}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-6 py-16">
      <header className="space-y-4">
        <PassageRule />
        <p className="text-sm font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {t("intro")}
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t("pathChoice")}
        </p>
      </header>

      <section className="grid gap-8 border-y border-border py-8 sm:grid-cols-2">
        <div className="space-y-3 sm:col-span-2">
          <CloudGatewayIllustration className="mx-0 w-[180px]" />
        </div>
        <div className="space-y-2">
          <h2 className="font-heading text-xl font-medium tracking-tight">
            {t("pathOnlineTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("pathOnlineBody")}
          </p>
          <Button
            variant="outline"
            render={<Link href="/app/bibliotheque">{t("pathOnlineCta")}</Link>}
          />
        </div>
        <div className="space-y-2">
          <h2 className="font-heading text-xl font-medium tracking-tight">
            {t("pathGatewayTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("pathGatewayBody")}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-medium tracking-tight">
          {t("checklistTitle")}
        </h2>
        <ul className="space-y-2">
          {checklistItems.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <PassageRule tone="ink" />
          <h2 className="font-heading text-2xl font-medium tracking-tight">
            {t("stepsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("pathChoice")}</p>
        </div>
        <ol className="space-y-10">
          {steps.map((step) => (
            <li
              key={step.number}
              className="border-t border-border pt-8 first:border-t-0 first:pt-0"
            >
              <div className="space-y-4">
                <div>
                  <span className="font-heading text-sm tracking-[0.12em] text-primary uppercase">
                    {step.number}
                  </span>
                  <h3 className="mt-2 font-heading text-xl font-medium">
                    {step.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {step.action}
                  </p>
                </div>
                {"cta" in step && step.cta ? <div>{step.cta}</div> : null}
                {"hint" in step && step.hint ? (
                  <p className="text-sm text-muted-foreground">{step.hint}</p>
                ) : null}
                {"extra" in step && step.extra ? <div>{step.extra}</div> : null}
                {"success" in step && step.success ? (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">
                      {t("stepSuccessLabel")}{" "}
                    </span>
                    {step.success}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="font-heading text-2xl font-medium tracking-tight">
          {t("afterTitle")}
        </h2>
        <p className="leading-relaxed text-muted-foreground">{t("afterBody")}</p>
        <p className="leading-relaxed text-muted-foreground">
          {t("afterMcp")} <Code>{MCP_URL}</Code>
        </p>
        <p className="font-heading text-lg font-medium text-balance">
          {t("closingLine")}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-medium tracking-tight">
          {t("glossaryTitle")}
        </h2>
        <Accordion>
          {glossaryItems.map((item) => (
            <AccordionItem key={item.term} value={item.term}>
              <AccordionTrigger>{item.term}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{item.def}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-medium tracking-tight">
          {t("advancedTitle")}
        </h2>
        <Accordion>
          <AccordionItem id="depannage" value="troubleshooting">
            <AccordionTrigger>{t("troubleshootTitle")}</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-muted-foreground">{t("troubleshootIntro")}</p>
              <p className="text-muted-foreground">{t("troubleshootWaiting")}</p>
              <p className="text-muted-foreground">{t("troubleshootExpired")}</p>
              <p className="text-muted-foreground">{t("troubleshootOffline")}</p>
              <p className="text-muted-foreground">{t("troubleshootBothCodes")}</p>
              <p className="text-muted-foreground">{t("troubleshootProwlarr")}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="advanced-terminal">
            <AccordionTrigger>{t("terminalAltTitle")}</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-muted-foreground">{t("terminalAltBody")}</p>
              <p className="text-muted-foreground">{t("terminalAltHint")}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="byo">
            <AccordionTrigger>{t("byoTitle")}</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-muted-foreground">{t("byoDescription")}</p>
              <p className="text-muted-foreground">{t("byoBody1")}</p>
              <p className="text-muted-foreground">{t("byoBody2")}</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button render={<Link href="/app/gateways">{t("createAccess")}</Link>} />
        <Button variant="outline" render={<Link href="/">{t("backHome")}</Link>} />
      </div>
    </div>
  );
}
