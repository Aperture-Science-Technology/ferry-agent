import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Minimal UI render harness (FA-UI-HARNESS-01).
 * Separate from node:test logic suites — JSX + CSS pipeline only.
 */
export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  css: {
    postcss: path.join(rootDir, "postcss.config.mjs"),
  },
  test: {
    environment: "happy-dom",
    setupFiles: [path.join(rootDir, "harness/setup.ts")],
    include: ["harness/**/*.test.tsx"],
    css: true,
  },
});
