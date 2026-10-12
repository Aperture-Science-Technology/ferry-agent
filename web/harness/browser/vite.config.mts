import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const local = (file: string) => fileURLToPath(new URL(file, import.meta.url));
export default defineConfig({
  root: local("."),
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: [
    { find: "@/lib/api-client", replacement: local("api.ts") },
    { find: "@/i18n/navigation", replacement: local("navigation.tsx") },
    { find: "next/navigation", replacement: local("navigation.tsx") },
    { find: "@clerk/nextjs", replacement: local("auth.ts") },
    { find: "next/image", replacement: local("image.tsx") },
    { find: "@", replacement: local("../..") },
  ] },
  css: { postcss: local("../../postcss.config.mjs") },
  server: { host: "127.0.0.1", port: 4178, strictPort: true, fs: { allow: [local("../..")] } },
});
