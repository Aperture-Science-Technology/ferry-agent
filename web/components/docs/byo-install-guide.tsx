import type { ReactNode } from "react";
import Link from "next/link";
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

const STEPS = [
  {
    number: "01",
    title: "Récupérer le token de pairing",
    body: (
      <>
        Ouvrez la console, allez dans{" "}
        <Link
          href="/app/gateways"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Gateways
        </Link>
        , puis créez un gateway. Copiez immédiatement le{" "}
        <strong className="font-medium text-foreground">pairing token</strong>{" "}
        (et la clé gateway) : ils ne seront plus jamais réaffichés.
      </>
    ),
  },
  {
    number: "02",
    title: "Télécharger le bundle",
    body: (
      <>
        Téléchargez le bundle d&apos;installation BYO depuis la page Gateways
        (ou le lien fourni au moment de la création). Décompressez-le dans un
        dossier facile à retrouver.
      </>
    ),
    cta: (
      <Button
        render={
          <a href="https://ferry-agent.aperture-agency.org/bundle/ferry-agent-bundle.tar.gz">
            Télécharger le bundle (tar.gz)
          </a>
        }
      />
    ),
  },
  {
    number: "03",
    title: "Lancer l'installation",
    body: (
      <>
        Ouvrez un terminal dans le dossier du bundle, puis lancez le script
        d&apos;installation. Sur <strong className="font-medium text-foreground">macOS</strong>,
        utilisez Terminal. Sur{" "}
        <strong className="font-medium text-foreground">Windows</strong>,
        utilisez Git Bash (pas PowerShell ni CMD).
      </>
    ),
    code: "./install.sh",
  },
  {
    number: "04",
    title: "Configurer les indexeurs Prowlarr",
    body: (
      <>
        Une fois le bundle démarré, ouvrez Prowlarr dans votre navigateur sur{" "}
        <Code>http://localhost:9696</Code>. Ajoutez vos indexeurs comme d&apos;habitude.
        Ferry Agent s&apos;appuie sur cette configuration pour chercher depuis
        votre propre réseau.
      </>
    ),
  },
];

export function ByoInstallGuide() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Documentation
        </p>
        <h1 className="font-heading text-4xl font-medium tracking-tight text-balance">
          Installer le gateway BYO
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Tutoriel pas à pas pour installer le connecteur détaché sur votre
          machine. Aucune connaissance Docker avancée n&apos;est requise — suivez
          les étapes dans l&apos;ordre.
        </p>
        <div className="pt-2">
          <Button render={<Link href="/app/gateways">Ouvrir Gateways</Link>} />
        </div>
      </header>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle>Prérequis</CardTitle>
          <CardDescription>
            Installez un runtime Docker avant de lancer le bundle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading font-medium">OrbStack</p>
                <Badge variant="secondary">Recommandé sur macOS</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Plus léger et plus simple que Docker Desktop sur Mac.
                Installez-le, laissez-le démarrer, c&apos;est tout.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <p className="font-heading font-medium">Docker Desktop</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Alternative sur Windows, macOS ou Linux. Vérifiez que Docker est
              bien démarré avant d&apos;exécuter{" "}
              <Code>./install.sh</Code>.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-6">
        <h2 className="font-heading text-2xl font-medium tracking-tight">
          Étapes
        </h2>
        <ol className="space-y-4">
          {STEPS.map((step) => (
            <li key={step.number}>
              <Card className="border-border/60 bg-card/40">
                <CardContent className="pt-2">
                  <span className="font-heading text-sm text-muted-foreground">
                    {step.number}
                  </span>
                  <h3 className="mt-2 font-heading text-xl font-medium">
                    {step.title}
                  </h3>
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
          <CardTitle>À savoir — mode BYO</CardTitle>
          <CardDescription>
            Bring Your Own : le gateway tourne chez vous, pas sur nos serveurs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-muted-foreground">
          <p>
            La machine qui héberge le bundle doit rester allumée et connectée
            à Internet pour que les recherches et téléchargements fonctionnent.
            Si vous éteignez le PC, le gateway devient indisponible.
          </p>
          <Separator className="bg-border/60" />
          <p>
            Pour un fonctionnement 24/7, une seedbox (ou un petit serveur
            toujours allumé) est une bonne alternative : installez-y le même
            bundle et pairez-le avec le même token.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button render={<Link href="/app/gateways">Créer un gateway</Link>} />
        <Button variant="outline" render={<Link href="/">Retour à l&apos;accueil</Link>} />
      </div>
    </div>
  );
}
