// Render the real profile panels in isolated Chromium. No game credentials,
// live database, player session, or external network requests are used.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const [modulePath, executablePath, screenshotDirectory] = process.argv.slice(2);
assert(modulePath && executablePath, "Supply existing playwright-core and Chromium paths");
const { chromium } = await import(pathToFileURL(modulePath).href);
const mobileStyles = readFileSync(join(process.cwd(), "app/jeu/mobile.css"), "utf8");
const css = await postcss([tailwindcss()]).process(`
  @import "tailwindcss" source(none);
  @source "../scripts/test-rider-profile-layout-ui.mjs";
  @source "../components/game/rider-profile-sporting-card.tsx";
  @source "../components/game/rider-stats-radar.tsx";
  @source "../components/game/rider-condition-gauges.tsx";
  @source "../components/game/rider-mental-profile.tsx";
  @source "../components/game/rider-personality.tsx";
  @source "../components/game/rider-climate-profile-card.tsx";
  @source "../components/game/rider-favorite-races-card.tsx";
  @source "../components/game/rider-special-abilities.tsx";
  @source "../components/game/special-ability-medallion.tsx";
  @source "../components/game/equipment-rating-bonus.tsx";
  @source "../components/game/transfer-scouting-report.tsx";
  @source "../lib/game/rider-rating-colors.ts";
  * { box-sizing: border-box; }
  body { margin:0; background:#f3f7f5; color:#183f37; font-family:Arial,sans-serif; }
`, { from: join(process.cwd(), "app/profile-layout-harness.css") });

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx",
    contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {LocaleProvider} from '@/components/i18n/locale-provider';
      import {RiderProfileSportingCard} from '@/components/game/rider-profile-sporting-card';
      import {RiderMentalProfile} from '@/components/game/rider-mental-profile';
      import {RiderSpecialAbilities} from '@/components/game/rider-special-abilities';
      import {SPECIAL_ABILITY_CATALOG} from '@/lib/game/special-abilities';
      const root = createRoot(document.getElementById('root'));
      window.profileCatalogSize = SPECIAL_ABILITY_CATALOG.length;
      const ratings = {mountain:72,hills:81,flat:76,timeTrial:68,cobbles:66,sprint:71,
        acceleration:79,downhill:77,endurance:82,resistance:75,recovery:78,breakaway:70,prologue:65};
      const condition = {form:98.2,morale:65,dayNumber:15,
        events:[{label:'Course',delta:-6,occurredAt:'2026-11-20T06:00:00.000Z'}],
        moraleEvents:[{label:'Victoire',delta:3,occurredAt:'2026-11-20T06:00:00.000Z'}]};
      const races = [
        {raceId:'race-1',name:'Chrono du Gap',slug:'chrono-du-gap',countryName:'France',countryCode:'FR',categoryCode:'continental',dominantProfile:'time_trial'},
        {raceId:'race-2',name:'Les Gorges de l’Enfer',slug:'gorges-enfer',countryName:'Belgique',countryCode:'BE',categoryCode:'national',dominantProfile:'hilly'},
        {raceId:'race-3',name:'Cape Wild Classics',slug:'cape-wild-classics',countryName:'Afrique du Sud',countryCode:'ZA',categoryCode:'world',dominantProfile:'cobbles'},
      ];
      function Harness({locale='fr',empty=false,injured=false}) {
        const medical = injured ? <section className='rounded-2xl border border-red-200 bg-red-50 p-4' data-qa='medical'>
          <strong>Blessure en cours</strong><p className='mt-2 text-sm'>Le coureur récupère avant son retour à la compétition.</p>
        </section> : null;
        return <LocaleProvider initialLocale={locale} key={locale}>
          <main className='min-h-screen bg-[#EAF5F3] text-[#082A2A]'>
            <section className='mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12'>
            <header className='mb-5 rounded-[2rem] bg-[#123c30] p-6 text-white'>
              <p className='text-[10px] font-black uppercase tracking-[0.16em] text-[#9edccb]'>Coureur cycliste</p>
              <h1 className='mt-2 text-3xl font-black'>Omphile Afonso</h1>
              <p className='mt-2 text-sm'>Abbaye du Lion – Pulse</p>
            </header>
            <div className='space-y-5'>
              <div data-qa='sporting'><RiderProfileSportingCard ratings={ratings}
                equipmentBonuses={{hills:3,mountain:2}} scoutingReport={null}
                condition={condition} medical={medical}/></div>
              <div data-qa='mental'><RiderMentalProfile personality={empty ? null : 'fidele'}
                climateProfile={{strength:'heat',weakness:'cold'}} favoriteRaces={empty ? [] : races}/></div>
              <div data-qa='abilities'><RiderSpecialAbilities abilities={empty ? [] : ['homegrown','etapovore']}/></div>
              <section data-qa='management' className='grid gap-4 sm:grid-cols-3'>
                {['Votre coureur','Marché des transferts','Rupture du contrat'].map((label,index)=><div key={label}
                  className={'rounded-2xl border p-5 '+(index===0?'border-amber-200 bg-amber-50':index===1?'border-blue-200 bg-blue-50':'border-red-200 bg-red-50')}>
                  <h2 className='text-sm font-black'>{label}</h2><p className='mt-3 text-sm'>Gestion du coureur</p>
                </div>)}
              </section>
            </div>
            </section>
          </main>
        </LocaleProvider>;
      }
      window.mountProfile = props => root.render(<Harness {...props}/>);
    `,
  },
  plugins: [{
    name: "isolated-framework-bridges",
    setup(builder) {
      // Route navigation is outside this layout test; preserve href/children.
      builder.onResolve({ filter: /^@\/components\/ui\/app-link$/ }, () => ({ path: "link", namespace: "qa" }));
      // Load the real document translator synchronously in this single-file
      // harness, rather than asking the Next runtime for a dynamic chunk.
      builder.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: "dynamic", namespace: "qa" }));
      builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => ({
        loader: "tsx", resolveDir: process.cwd(),
        contents: path === "link" ? `
          import React,{forwardRef} from 'react';
          export default forwardRef(function Link({href,children,...props},ref) {
            return <a {...props} ref={ref} href={typeof href==='string'?href:href.pathname}>{children}</a>;
          });
        ` : `
          import {DocumentLocaleBridge} from '@/components/i18n/document-locale-bridge';
          export default function dynamic() { return DocumentLocaleBridge; }
        `,
      }));
    },
  }],
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

const browser = await chromium.launch({ executablePath, headless: true });
const measurements = [];
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
try {
  for (const width of [360, 390, 768, 1024, 1280, 1440, 1536]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 768 ? 844 : 1000 },
      isMobile: width < 768, hasTouch: width < 768,
    });
    let networkCalls = 0;
    await context.route("**/*", (route) => { networkCalls++; return route.abort(); });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent("<meta name='viewport' content='width=device-width, initial-scale=1'><body class='game-shell'><div id='root'></div></body>");
    await page.addStyleTag({ content: css.css + '\n' + mobileStyles });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const mount = async (props) => {
      await page.evaluate((value) => { document.documentElement.lang = value.locale ?? 'fr'; window.mountProfile(value); }, props);
      await page.locator("[data-qa='sporting'] [data-rating-importance]").first().waitFor();
      await page.waitForTimeout(100);
    };
    const checkLayout = async (variant) => {
      const bounds = await page.evaluate(() => {
        const positions = [...document.querySelectorAll("[data-qa]")]
          .filter((element) => ['sporting','mental','abilities','management'].includes(element.dataset.qa))
          .map((element) => { const rect = element.getBoundingClientRect(); return { name:element.dataset.qa,x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom }; });
        return { positions, scrollWidth:document.documentElement.scrollWidth, width:innerWidth };
      });
      if (bounds.scrollWidth > bounds.width) {
        console.error(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].map(element=>({
          tag:element.tagName,id:element.id,classes:element.className?.baseVal??element.className,
          x:element.getBoundingClientRect().x,right:element.getBoundingClientRect().right,
          visibility:getComputedStyle(element).visibility,
        })).filter(entry=>entry.right>innerWidth||entry.x<0).slice(-24)),null,2));
      }
      check(bounds.scrollWidth <= bounds.width, `${width}/${variant}: page has horizontal overflow ${bounds.scrollWidth}`);
      check(bounds.positions.map((entry) => entry.name).join(',') === 'sporting,mental,abilities,management', 'panel order');
      for (let index = 1; index < bounds.positions.length; index++) {
        const gap = bounds.positions[index].y - bounds.positions[index-1].bottom;
        check(gap >= 0 && gap <= 24, `${width}/${variant}: empty inter-panel gap ${gap}`);
      }
      check(await page.locator("[data-rating-importance]").count() === 13, 'all sporting ratings remain present');
      check(await page.locator("[data-radar-layer='equipment']").count() === 1, 'equipment radar remains present');
      check(await page.locator("[data-equipment-bonus='3']").count() > 0, 'equipment bonus remains present');
      check(await page.locator("[data-qa='abilities'] button[aria-controls^='ability-']").count() === await page.evaluate(() => window.profileCatalogSize), 'entire ability catalog remains present');
      measurements.push({ width, variant, ...bounds });
    };

    await mount({ locale: 'fr' });
    await checkLayout('fr');
    check(await page.locator("[data-qa='mental'] a[href^='/jeu/courses/']").count() === 3, 'favorite race links preserved');
    check(await page.locator("[data-qa='mental'] a").first().getAttribute('href') === '/jeu/courses/chrono-du-gap', 'favorite race URL preserved');
    check(await page.locator("[data-qa='mental'] [title]").filter({ hasText: 'Fidèle' }).count() === 1, 'personality hover description preserved');

    const ability = page.locator("button[aria-controls='ability-etapovore']");
    if (width < 768) await ability.tap();
    else await ability.click();
    check(await ability.getAttribute('aria-expanded') === 'true', 'ability opens on click/touch');
    check(await page.locator('#ability-etapovore').isVisible(), 'ability effect remains visible');
    const tooltip = await page.locator('#ability-etapovore').boundingBox();
    check(tooltip && tooltip.x >= 0 && tooltip.x + tooltip.width <= width, `${width}: ability tooltip stays within viewport`);
    if (width < 640) check(tooltip.y + tooltip.height <= 844-60, 'ability tooltip clears the mobile navigation dock');
    await ability.press('Escape');
    check(await ability.getAttribute('aria-expanded') === 'false', 'Escape dismisses ability');

    const rowEdges = await page.locator("[data-qa='abilities'] button[aria-controls^='ability-']").evaluateAll((buttons) => {
      const rows = new Map();
      for (const button of buttons) {
        const y = Math.round(button.getBoundingClientRect().y);
        const row = rows.get(y) ?? [];
        row.push(button.getAttribute('aria-controls'));
        rows.set(y,row);
      }
      return [...new Set([...rows.values()].flatMap(row => [row[0],row[row.length-1]]))];
    });
    for (const id of rowEdges) {
      const button = page.locator(`button[aria-controls='${id}']`);
      if (width < 768) await button.tap();
      else await button.click();
      const edgeBounds = await page.locator(`#${id}`).boundingBox();
      check(edgeBounds && edgeBounds.x >=0 && edgeBounds.x+edgeBounds.width<=width,
        `${width}: ability row edge ${id} fits viewport: ${JSON.stringify(edgeBounds)}`);
      await button.press('Escape');
    }

    const histories = page.locator("[data-form-history-tooltip='touchable']");
    for (let index=0; index<await histories.count(); index++) {
      const history = histories.nth(index);
      if (width < 768) await history.locator('summary').tap();
      else await history.locator('summary').click();
      check(await history.getAttribute('open') !== null, 'form/morale history remains touchable');
      const historyBounds=await history.getByRole('tooltip').boundingBox();
      check(historyBounds && historyBounds.x >=0 && historyBounds.x+historyBounds.width<=width,
        `${width}: history ${index} fits viewport: ${JSON.stringify(historyBounds)}`);
      if (width < 640) check(historyBounds.y+historyBounds.height <= 844-60, 'history tooltip clears the mobile navigation dock');
      if (width < 768) await history.locator('summary').tap();
      else await history.locator('summary').click();
    }

    if (screenshotDirectory) {
      mkdirSync(screenshotDirectory, { recursive: true });
      await page.mouse.move(0,0);
      await page.screenshot({ path: join(screenshotDirectory, `profile-${width}-fr.png`), fullPage: true });
    }
    await mount({ locale:'fr', empty:true, injured:true });
    await checkLayout('empty-injured');
    check(await page.locator("[data-qa='medical']").count() === 1, 'medical information remains displayed');
    check(await page.locator("[data-qa='mental'] a[href^='/jeu/courses/']").count() === 0, 'empty favorite list stays empty');

    await mount({ locale:'en' });
    await checkLayout('en');
    const text = await page.locator("[data-qa='sporting']").textContent();
    check(!text.includes('Caractéristiques de la saison'), 'sporting heading is translated in English');
    check(!(await page.locator("[data-qa='mental']").textContent()).includes('Mental et affinités'), 'mental heading is translated in English');
    check(await page.locator("[data-qa='abilities'] h2").textContent() === 'Special abilities', 'ability heading is translated in English');
    const mentalText = await page.locator("[data-qa='mental']").textContent();
    check(!mentalText.includes('Forte chaleur') && !mentalText.includes('Froid'), 'weather preferences are translated in English');
    check(mentalText.includes('Extreme heat') && mentalText.includes('Cold'), 'English weather names remain present');
    check(text.includes('Rider condition'), 'rider condition is translated in English');
    check(await page.locator("[data-qa='sporting'] svg").first().getAttribute('aria-label') === 'Rider attributes radar chart, with equipment bonuses in blue', 'radar locale follows English');
    if (screenshotDirectory && (width === 390 || width === 1440)) {
      await page.screenshot({ path: join(screenshotDirectory, `profile-${width}-en.png`), fullPage:true });
    }
    check(errors.length === 0, `${width}: browser errors: ${errors.join('; ')}`);
    check(networkCalls === 0, 'panels make no network requests');
    await context.close();
  }
} finally {
  await browser.close();
}
if (screenshotDirectory) writeFileSync(join(screenshotDirectory, 'measurements.json'), JSON.stringify(measurements, null, 2));
console.log(`PASS ${checks} isolated profile layout checks across 360/390/768/1024/1280/1440/1536px, FR/EN, empty/injured variants.`);
