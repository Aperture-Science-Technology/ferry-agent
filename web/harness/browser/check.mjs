// Uses an already-installed Playwright package; never installs dependencies.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = fileURLToPath(new URL("captures/", import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", error => errors.push(String(error)));
const results = [];
async function noOverflow(label) {
  const measurement = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  results.push({ label, ...measurement });
  assert.ok(measurement.document <= measurement.viewport, `${label}: ${JSON.stringify(measurement)}`);
}
try {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [["library", "/app/bibliotheque"], ["devices", "/app/appareils"], ["deliveries", "/app/livraisons"], ["onboarding", "/onboarding"], ["empty-library", "/app/bibliotheque?empty"], ["empty-devices", "/app/appareils?empty"], ["empty-deliveries", "/app/livraisons?empty"]]) {
      await page.goto(`http://127.0.0.1:4178${path}`);
      await page.getByRole("button", { name: "Rechercher et naviguer" }).waitFor();
      await page.screenshot({ path: `${output}${name}-${width}.png`, fullPage: false });
      await noOverflow(`${name}-${width}`);
      if (name === "devices") {
        const bounds = await page.evaluate(() => ({
          actionsBottom: document.querySelector('[data-testid="page-header-actions"]').getBoundingClientRect().bottom,
          followingPanelTop: document.querySelector('[data-testid="devices-default-dest"]').getBoundingClientRect().top,
        }));
        assert.ok(bounds.actionsBottom <= bounds.followingPanelTop, `Header actions overlap the following panel at ${width}px: ${JSON.stringify(bounds)}`);
      }
      if (name === "library") {
        await page.getByRole("checkbox", { name: "Tout sélectionner sur cette page" }).click();
        await noOverflow(`selection-${width}`);
        await page.getByRole("button", { name: "Livrer la sélection" }).click();
        await page.getByRole("dialog").waitFor();
        await noOverflow(`batch-delivery-${width}`);
        await page.screenshot({ path: `${output}batch-delivery-${width}.png` });
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        await page.getByRole("button", { name: "Supprimer la sélection" }).click();
        await page.getByRole("dialog").waitFor();
        await noOverflow(`batch-delete-${width}`);
        await page.screenshot({ path: `${output}batch-delete-${width}.png` });
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        await page.getByRole("button", { name: "Liste", exact: true }).click();
        await noOverflow(`library-list-${width}`);
        await page.screenshot({ path: `${output}library-list-${width}.png` });
      }
      if (name === "devices" && width < 768) {
        await page.getByRole("button", { name: "Filtres et tri" }).click();
        await page.getByRole("dialog").waitFor();
        await noOverflow(`sheet-${width}`);
        await page.screenshot({ path: `${output}filters-${width}.png`, fullPage: false });
        await page.keyboard.press("Escape");
      }
    }
    await page.goto("http://127.0.0.1:4178/app/bibliotheque");
    const origin = page.getByRole("button", { name: "Origine", exact: true });
    await origin.focus();
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.equal(await dialog.getAttribute("aria-modal"), "true");
    assert.equal(await page.getByRole("combobox").evaluate(node => node === document.activeElement), true);
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press(index % 2 ? "Shift+Tab" : "Tab");
      await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement), null, { timeout: 1500 }).catch(async error => {
        console.log("FOCUS", await page.evaluate(() => document.activeElement?.outerHTML)); throw error;
      });
    }
    await page.getByRole("combobox").fill("Livre 2");
    await page.getByRole("option").first().waitFor();
    await noOverflow(`palette-${width}`);
    await page.screenshot({ path: `${output}palette-${width}.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await origin.evaluate(node => node === document.activeElement), true, "Focus did not return to shortcut origin");
    // Check English labels and the no-result state at the same widths.
    await page.goto("http://127.0.0.1:4178/app/bibliotheque?locale=en");
    await page.getByRole("button", { name: "Search and navigate" }).click();
    await page.getByRole("combobox").fill("zzzzzz");
    await page.getByText("No results. Try another title or page name.").waitFor();
    await noOverflow(`palette-empty-en-${width}`);
    await page.screenshot({ path: `${output}palette-empty-en-${width}.png`, fullPage: false });
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}checks.json`, JSON.stringify(results, null, 2) + "\n");
  console.log(`${results.length} width checks passed; keyboard focus trap and restoration passed at 320, 390 and 1280 px. Screenshots: ${output}`);
} finally { await browser.close(); }
