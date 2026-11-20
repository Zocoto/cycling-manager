// Real React previews in isolated Chromium. Every request is blocked, and no
// player session or live application is used.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const [modulePath, executablePath, screenshotDirectory] = process.argv.slice(2);
assert(modulePath && executablePath, "Supply playwright-core and Chromium paths");
const { chromium } = await import(pathToFileURL(modulePath).href);
const styles = await postcss([tailwindcss()]).process(`
  @import "tailwindcss" source(none);
  @source "../components/game/rider-preview-link.tsx";
  @source "../components/game/federation-rider-preview-link.tsx";
  body { font-family: Arial, sans-serif; padding: 20px; }
`, { from: join(process.cwd(), "app/preview-harness.css") });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "tsx",
    contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {FederationRiderPreviewLink} from '@/components/game/federation-rider-preview-link';
      const root = createRoot(document.getElementById('root'));
      const base = {
        id: '00000000-0000-4000-8000-000000000101', teamId: 'club',
        name: 'Camille Martin', category: 'professional', juniorAffiliation: null,
        teamName: 'Club de France', age: 24, profile: 'Montagne', overall: 75,
        ratings: {mountain: 83, hills: 72, flat: 65, timeTrial: 64, cobbles: 61,
          sprint: 60, acceleration: 74, downhill: 75, endurance: 81,
          resistance: 78, recovery: 77, breakaway: 69, prologue: 63},
      };
      function Harness({kind = 'professional', automatic = false, mountain = 83}) {
        const [selected, setSelected] = useState(false);
        const rider = {...base, category: kind === 'professional' ? 'professional' : 'junior',
          juniorAffiliation: kind === 'school' ? 'cycling_school' : kind === 'development' ? 'development_team' : null,
          age: kind === 'professional' ? 24 : 17, ratings: {...base.ratings, mountain}};
        return <>
          <fieldset disabled={automatic}>
            <input type='checkbox' aria-label='Sélectionner le coureur' checked={selected} onChange={event => setSelected(event.target.checked)}/>
            <FederationRiderPreviewLink rider={rider} countryCode='FR' countryName='France'/>
          </fieldset>
          <button type='button' id='outside'>Hors de l’aperçu</button>
        </>;
      }
      window.mountPreview = props => root.render(<Harness {...props}/>);
      window.unmountPreview = () => root.unmount();
    `,
  },
  plugins: [{
    name: "offline-preview",
    setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "qa" }));
      builder.onResolve({ filter: /^@\/lib\/game\/rider-preview-client$/ }, () => ({ path: "preview", namespace: "qa" }));
      builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => ({
        loader: "tsx",
        resolveDir: process.cwd(),
        contents: path === "link" ? `
          import React, {forwardRef} from 'react';
          export default forwardRef(function Link({href, prefetch, children, ...props}, ref) {
            return <a {...props} href={typeof href === 'string' ? href : href.pathname} ref={ref}>{children}</a>;
          });
        ` : `
          export async function getRiderPreview() {
            window.qaPreviewRequests++;
            throw new Error('A supplied federation preview must not fetch');
          }
        `,
      }));
    },
  }],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    let networkCalls = 0;
    await context.route("**/*", (route) => { networkCalls++; return route.abort(); });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent("<meta name='viewport' content='width=device-width, initial-scale=1'><div id='root'></div>");
    await page.addStyleTag({ content: styles.css });
    await page.evaluate(() => {
      window.qaPreviewRequests = 0;
      window.qaPreviewClicks = [];
      // Observe the actual component's navigation decision, then keep this
      // test isolated even when a second click deliberately follows a profile.
      document.addEventListener("click", (event) => {
        const link = event.target.closest("[data-rider-preview-trigger]");
        if (!link) return;
        window.qaPreviewClicks.push({ prevented: event.defaultPrevented, href: link.getAttribute("href") });
        event.preventDefault();
      });
    });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const trigger = page.locator("[data-rider-preview-trigger]");
    const dialog = page.getByRole("dialog", { name: "Aperçu rapide du coureur" });
    const checkbox = page.getByRole("checkbox", { name: "Sélectionner le coureur" });
    const mount = async (props = {}) => {
      await page.evaluate((value) => window.mountPreview(value), props);
      await page.waitForTimeout(50);
    };
    const open = async () => {
      if (mobile) await trigger.tap();
      else {
        await page.mouse.move(1000, 700);
        await trigger.hover();
      }
      await dialog.waitFor({ state: "visible" });
    };

    await mount();
    assert.equal(await dialog.count(), 0);
    await checkbox.check();
    await open();
    assert.equal(await dialog.locator("[data-rating-importance]").count(), 13);
    assert.match(await dialog.textContent(), /Camille Martin/);
    assert.match(await dialog.textContent(), /83/);
    assert.equal(await dialog.getByRole("link", { name: "Voir la fiche" }).getAttribute("href"),
      "/jeu/coureurs/00000000-0000-4000-8000-000000000101");
    assert.equal(await checkbox.isChecked(), true, "opening the preview preserves the selection");
    if (mobile) {
      const clicks = await page.evaluate(() => window.qaPreviewClicks);
      assert(clicks.every((click) => click.prevented), "the first touch opens the preview without navigating");
      assert.equal(page.url(), "about:blank");
      const bounds = await dialog.boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
      if (screenshotDirectory) {
        mkdirSync(screenshotDirectory, { recursive: true });
        await page.screenshot({ path: join(screenshotDirectory, "professional-mobile.png") });
      }
    }

    await mount({ mountain: 86 });
    assert.match(await dialog.textContent(), /86/, "updated federation notes appear in the open preview");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });

    await mount({ kind: "development", automatic: true });
    assert.equal(await checkbox.isDisabled(), true);
    await open();
    assert.equal(await dialog.locator("[data-rating-importance]").count(), 13);
    assert.equal(await dialog.getByRole("link", { name: "Voir la fiche" }).getAttribute("href"),
      "/jeu/centre-de-formation/development/00000000-0000-4000-8000-000000000101");
    await dialog.getByRole("button", { name: "Fermer l’aperçu", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });

    await mount({ kind: "school", automatic: true });
    await trigger.click();
    await dialog.waitFor({ state: "visible" });
    assert.equal(await dialog.locator("[data-rating-importance]").count(), 13);
    assert.equal(await dialog.getByRole("link", { name: "Voir la fiche" }).count(), 0,
      "a school-only junior has no invalid DevTeam profile shortcut");
    await page.locator("#outside").dispatchEvent("pointerdown", { pointerType: mobile ? "touch" : "mouse" });
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => window.qaPreviewRequests), 0);
    assert.equal(networkCalls, 0);
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.unmountPreview());
    await context.close();
  }
  console.log(JSON.stringify({ federationPreviews: "passed", desktopAndTouch: true, allNotes: 13,
    preservedSelection: true, automaticMode: true, correctJuniorProfile: true, noRequests: true }));
} finally {
  await browser.close();
}
