"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-4 font-mono text-xs text-foreground">
      <code>{children}</code>
    </pre>
  );
}

const GATEWAY_IMAGE_DOWNLOAD_URL =
  "https://ferry-agent.aperture-agency.org/bundle/ferry-agent-gateway.tar";

const INSTALL_SCRIPT_BUNDLE_URL =
  "https://ferry-agent.aperture-agency.org/bundle/ferry-agent-bundle.tar.gz";

const MCP_URL = "https://ferry-agent.aperture-agency.org/mcp";

const DOCKER_RUN_COMMAND = `docker run -d \\
  --name ferry-gateway \\
  --restart unless-stopped \\
  -e PAIRING_TOKEN=CODE \\
  -e PUID=$(id -u) -e PGID=$(id -g) \\
  -p 127.0.0.1:9696:9696 \\
  -p 51413:51413 -p 51413:51413/udp \\
  -v "$PWD/downloads:/downloads" \\
  -v ferry-gw-config:/config \\
  -v ferry-gw-state:/state \\
  ghcr.io/aperture-science-technology/ferry-agent/gateway:latest`;

export function ByoInstallGuide() {
  const t = useTranslations("docs");

  const checklistItems = [t("checklistItem1"), t("checklistItem2")];

  const glossaryItems = [
    { term: t("glossaryProwlarrTerm"), def: t("glossaryProwlarrDef") },
    { term: t("glossaryIndexerTerm"), def: t("glossaryIndexerDef") },
    { term: t("glossaryMagnetTerm"), def: t("glossaryMagnetDef") },
    { term: t("glossaryGatewayTerm"), def: t("glossaryGatewayDef") },
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
              <a href={GATEWAY_IMAGE_DOWNLOAD_URL}>
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
      code: DOCKER_RUN_COMMAND,
      hint: t("step3Hint"),
      success: t("step3Success"),
    },
    {
      number: "04",
      title: t("step4Title"),
      action: (
        <>
          {t("step4Action")} <Code>http://127.0.0.1:9696</Code>
        </>
      ),
      success: t("step4Success"),
    },
    {
      number: "05",
      title: t("step5Title"),
      action: (
        <>
          {t("step5Action")} <Code>{MCP_URL}</Code>
        </>
      ),
      extra: (
        <Button
          variant="outline"
          render={<Link href="/app/gateways">{t("step5Cta")}</Link>}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-heading text-4xl font-medium tracking-tight text-balance">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </header>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle>{t("checklistTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {checklistItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <section className="space-y-6">
        <h2 className="font-heading text-2xl font-medium tracking-tight">{t("stepsTitle")}</h2>
        <ol className="space-y-4">
          {steps.map((step) => (
            <li key={step.number}>
              <Card className="border-border/60 bg-card/40">
                <CardContent className="space-y-4 pt-2">
                  <div>
                    <span className="font-heading text-sm text-muted-foreground">
                      {step.number}
                    </span>
                    <h3 className="mt-2 font-heading text-xl font-medium">{step.title}</h3>
                    <p className="mt-2 text-muted-foreground">{step.action}</p>
                  </div>
                  {"cta" in step && step.cta ? <div>{step.cta}</div> : null}
                  {"code" in step && step.code ? <CodeBlock>{step.code}</CodeBlock> : null}
                  {"hint" in step && step.hint ? (
                    <p className="text-sm text-muted-foreground">{step.hint}</p>
                  ) : null}
                  {"extra" in step && step.extra ? <div>{step.extra}</div> : null}
                  {"success" in step && step.success ? (
                    <p className="text-sm text-foreground">
                      <span aria-hidden="true">✅</span> {t("stepSuccessLabel")}{" "}
                      <span className="text-muted-foreground">{step.success}</span>
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-center font-heading text-lg font-medium text-balance">
        {t("closingLine")}
      </p>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle>{t("glossaryTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle>{t("advancedTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion>
            <AccordionItem value="install-script">
              <AccordionTrigger>{t("scriptAltTitle")}</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-muted-foreground">{t("scriptAltDescription")}</p>
                <p className="text-muted-foreground">{t("scriptAltBody")}</p>
                <Button
                  variant="outline"
                  render={
                    <a href={INSTALL_SCRIPT_BUNDLE_URL}>
                      {t("scriptAltCta")}
                    </a>
                  }
                />
                <CodeBlock>./install.sh</CodeBlock>
                <p className="text-sm text-muted-foreground">{t("scriptAltHint")}</p>
              </AccordionContent>
            </AccordionItem>

            <div id="depannage">
              <AccordionItem value="byo">
                <AccordionTrigger>{t("byoTitle")}</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p className="text-muted-foreground">{t("byoDescription")}</p>
                  <p className="text-muted-foreground">{t("byoBody1")}</p>
                  <p className="text-muted-foreground">{t("byoBody2")}</p>
                </AccordionContent>
              </AccordionItem>
            </div>
          </Accordion>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button render={<Link href="/app/gateways">{t("createAccess")}</Link>} />
        <Button variant="outline" render={<Link href="/">{t("backHome")}</Link>} />
      </div>
    </div>
  );
}
