"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

export function ByoInstallGuide() {
  const t = useTranslations("docs");

  const steps = [
    {
      number: "01",
      title: t("step1Title"),
      body: (
        <>
          {t("step1BodyBefore")}{" "}
          <Link
            href="/app/gateways"
            className="text-foreground underline-offset-4 hover:underline"
          >
            {t("step1BodyLink")}
          </Link>
          {t("step1BodyAfter")}{" "}
          <strong className="font-medium text-foreground">{t("step1Token")}</strong>{" "}
          {t("step1BodyEnd")}
        </>
      ),
    },
    {
      number: "02",
      title: t("step2Title"),
      body: <>{t("step2Body")}</>,
      cta: (
        <Button
          render={
            <a href="https://ferry-agent.aperture-agency.org/bundle/ferry-agent-bundle.tar.gz">
              {t("step2Cta")}
            </a>
          }
        />
      ),
    },
    {
      number: "03",
      title: t("step3Title"),
      body: (
        <>
          {t("step3BodyBefore")}{" "}
          <strong className="font-medium text-foreground">{t("step3Mac")}</strong>
          {t("step3BodyMid")}{" "}
          <strong className="font-medium text-foreground">{t("step3Win")}</strong>
          {t("step3BodyEnd")}
        </>
      ),
      code: "./install.sh",
    },
    {
      number: "04",
      title: t("step4Title"),
      body: (
        <>
          {t("step4BodyBefore")} <Code>http://localhost:9696</Code>
          {t("step4BodyAfter")}
        </>
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
        <div className="pt-2">
          <Button render={<Link href="/app/gateways">{t("openAccess")}</Link>} />
        </div>
      </header>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle>{t("prereqTitle")}</CardTitle>
          <CardDescription>{t("prereqDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading font-medium">{t("orbstackTitle")}</p>
                <Badge variant="secondary">{t("orbstackBadge")}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t("orbstackBody")}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <p className="font-heading font-medium">{t("dockerTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.rich("dockerBody", {
                command: () => <Code>./install.sh</Code>,
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-6">
        <h2 className="font-heading text-2xl font-medium tracking-tight">{t("stepsTitle")}</h2>
        <ol className="space-y-4">
          {steps.map((step) => (
            <li key={step.number}>
              <Card className="border-border/60 bg-card/40">
                <CardContent className="pt-2">
                  <span className="font-heading text-sm text-muted-foreground">
                    {step.number}
                  </span>
                  <h3 className="mt-2 font-heading text-xl font-medium">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground">{step.body}</p>
                  {"cta" in step && step.cta ? (
                    <div className="mt-4">{step.cta}</div>
                  ) : null}
                  {"code" in step && step.code ? (
                    <div className="mt-4">
                      <CodeBlock>{step.code}</CodeBlock>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle>{t("byoTitle")}</CardTitle>
          <CardDescription>{t("byoDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-muted-foreground">
          <p>{t("byoBody1")}</p>
          <Separator className="bg-border/60" />
          <p>{t("byoBody2")}</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button render={<Link href="/app/gateways">{t("createAccess")}</Link>} />
        <Button variant="outline" render={<Link href="/">{t("backHome")}</Link>} />
      </div>
    </div>
  );
}
