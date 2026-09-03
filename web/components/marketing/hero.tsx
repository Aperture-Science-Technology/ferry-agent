"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Show, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/status-dot";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center">
        <div className="h-96 w-[36rem] rounded-full bg-gradient-to-r from-teal-500/20 via-sky-500/10 to-transparent blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground"
        >
          <StatusDot />
          Gateway ready to pair
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="font-heading text-5xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl"
        >
          The bridge between your books and{" "}
          <span className="bg-gradient-to-r from-teal-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
            every reader.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="mt-6 max-w-xl text-lg text-muted-foreground"
        >
          Self-hosted. Legal sources at the tap of a key. Your gateway stays
          yours.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Show when="signed-out">
            <SignInButton>
              <Button
                size="lg"
                className="transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                Open Dashboard
              </Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Button
              size="lg"
              className="transition hover:-translate-y-0.5 hover:shadow-lg"
              render={<Link href="/app/bibliotheque">Open Dashboard</Link>}
            />
          </Show>
          <Button variant="outline" size="lg" render={<Link href="#how-it-works">How it works</Link>} />
        </motion.div>
      </div>
    </section>
  );
}
