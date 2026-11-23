// Render real academy cards and their real bulk editor in isolated Chromium.
// Only framework navigation and server actions are replaced. No account,
// database, player session, or external network request is used.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const [modulePath, executablePath, screenshotDirectory, ...flags] = process.argv.slice(2);
assert(modulePath && executablePath, "Supply existing playwright-core and Chromium paths");
const baselineOnly = flags.includes("--baseline-only");
const locales = flags.includes("--fr-only") ? ['fr'] : ['fr','en'];
const baselineArgument = flags.find((flag) => flag.startsWith("--before="))?.slice(9);
const defaultBaseline = screenshotDirectory && join(screenshotDirectory, "academy-rider-card-before.tsx");
const baselinePath = baselineArgument ? resolve(baselineArgument) : defaultBaseline && existsSync(defaultBaseline) ? resolve(defaultBaseline) : null;
assert(!baselineOnly || baselinePath, "--baseline-only requires --before=<original component.tsx>");
const { chromium } = await import(pathToFileURL(modulePath).href);
const mobileStyles = readFileSync(join(process.cwd(), "app/jeu/mobile.css"), "utf8");
// Keep the real country flags visible without allowing even local URL fetches.
const flagStyles = readFileSync(join(process.cwd(), "node_modules/flag-icons/css/flag-icons.css"), "utf8")
  .replace(/url\(\.\.\/flags\/(4x3|1x1)\/(be|fr)\.svg\)/g, (_, shape, country) =>
    `url(data:image/svg+xml;base64,${readFileSync(join(process.cwd(), `node_modules/flag-icons/flags/${shape}/${country}.svg`)).toString('base64')})`);
if (screenshotDirectory) mkdirSync(screenshotDirectory, { recursive: true });
const css = await postcss([tailwindcss()]).process(`
  @import "tailwindcss" source(none);
  @source "../scripts/test-compact-junior-roster-ui.mjs";
  @source "../components/game";
  @source "../lib/game";
  ${baselinePath ? `@source "${baselinePath.replaceAll("\\", "/")}";` : ""}
  * { box-sizing:border-box; }
  body { margin:0; background:#EAF5F3; color:#082A2A; font-family:Arial,sans-serif; }
`, { from: join(process.cwd(), "app/compact-junior-roster-harness.css") });

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx",
    contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {LocaleProvider} from '@/components/i18n/locale-provider';
      import {AcademyRiderCard} from '@/components/game/academy-rider-card';
      import {AcademyRiderCard as OriginalCard} from 'qa-original-card';
      import {YouthTrainingBulkEditor,YouthTrainingRosterFilter} from '@/components/game/youth-training-bulk-editor';
      import {SPECIAL_ABILITY_CATALOG} from '@/lib/game/special-abilities';
      const root = createRoot(document.getElementById('root'));
      const ratings = {mountain:72.4,hills:81.5,flat:76.2,timeTrial:68.7,cobbles:66.1,sprint:71.9,
        acceleration:79.3,downhill:77.4,endurance:82.2,resistance:75.6,recovery:78.7,breakaway:70.5,prologue:65.8};
      const gains = Object.fromEntries(Object.keys(ratings).map((key,index)=>[key,(index+1)/1000]));
      const naturalization = {level:'youth',eligible:true,reason:'eligible',elapsedDays:28,requiredDays:28,remainingDays:0,
        currentCountry:{id:'be',name:'Belgique',code:'BE'},targetCountry:{id:'fr',name:'France',code:'FR'}};
      const base = {id:'qa-junior-1',firstName:'Alexandre',lastName:'Deschamps',age:17,heightCm:178,weightKg:65.5,
        countryName:'Belgique',countryCode:'BE',profileKey:'climber',avatarSeed:'junior-qa-1',sportingProfile:'Grimpeur / Puncheur',
        potentialSteps:8,nativeSpecialAbility:SPECIAL_ABILITY_CATALOG.find(ability=>ability.code==='homegrown')??SPECIAL_ABILITY_CATALOG[0],
        personalityKey:'fidele',morale:76,moraleEvents:[{label:'Victoire',delta:3,occurredAt:'2026-11-20T06:00:00.000Z'}],ratings,
        trainingPriority:'climber',trainingMode:'manual',trainingModePreference:'manual',pendingTrainingMode:null,
        manualTraining:{currentSlot:'manual_am',currentSlotLabel:'Matin',currentSlotCompleted:false,completedSlotCount:0,gameType:'rhythm'},
        tuitionPerSeason:10000,status:'in_academy',promotionGameYear:null,canRecruit:true,naturalization,
        latestTrainingReport:{dayNumber:15,ratingChanges:gains,trainingMode:'manual',slot:'manual_am',score:720},
        seasonTrainingReport:{ratingChanges:gains,sessionCount:18,automaticSessionCount:10,manualSessionCount:8,fromDayNumber:1,toDayNumber:15}};
      const riders = [base,
        {...base,id:'qa-junior-2',firstName:'Maximilien',lastName:'Van der Meersch',age:18,avatarSeed:'junior-qa-2',sportingProfile:'Rouleur',
          trainingMode:'automatic',trainingModePreference:'manual',pendingTrainingMode:'manual',status:'recruited',promotionGameYear:2027,
          naturalization:{...naturalization,eligible:false,reason:'tenure_incomplete',elapsedDays:16,remainingDays:12}},
        {...base,id:'qa-junior-3',firstName:'Ismaël',lastName:'Ndiaye',age:18,avatarSeed:'junior-qa-3',status:'release_pending',canRecruit:false}];
      function Harness({locale='fr',before=false,variant='normal',revision=0}) {
        const Card = before ? OriginalCard : AcademyRiderCard;
        const visible = variant==='young' ? [{...base,id:'qa-junior-1',age:16,canRecruit:false,manualTraining:{...base.manualTraining,currentSlotCompleted:true,completedSlotCount:1}}]
          : variant==='capacity' ? [base] : riders;
        const cards=visible.map(rider=><Card key={rider.id} rider={rider} gameYear={2026} currency='EUR'
          canSchedulePromotion={variant!=='capacity'} rosterLimit={30}/>);
        return <LocaleProvider initialLocale={locale} key={locale+'-'+before+'-'+variant+'-'+revision}>
          <main className='min-h-screen bg-[#EAF5F3] text-[#082A2A]'>
            <section className='mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12'>
              <div className='space-y-3' data-qa='academy-roster'>
                <YouthTrainingBulkEditor preserveFinalYearFilter initialSettings={visible.filter(rider=>rider.status!=='release_pending').map(rider=>({
                  academyRiderId:rider.id,trainingPriority:rider.trainingPriority,trainingMode:rider.trainingModePreference}))}>
                  {before ? <div className='space-y-3'>{cards}</div> :
                    <YouthTrainingRosterFilter riders={visible.map(rider=>({id:rider.id,
                      trainingMode:rider.status==='release_pending'?null:rider.trainingMode}))}>
                      {cards}
                    </YouthTrainingRosterFilter>}
                </YouthTrainingBulkEditor>
              </div>
            </section>
          </main>
        </LocaleProvider>;
      }
      window.qaActionCalls=[];
      window.qaSubmitEvents=[];
      document.addEventListener('submit',event=>{window.qaSubmitEvents.push(event.target.outerHTML);event.preventDefault();},true);
      window.mountAcademy = props => root.render(<Harness {...props}/>);
    `,
  },
  plugins: [{
    name: "offline-academy-boundaries",
    setup(builder) {
      builder.onResolve({ filter: /^qa-original-card$/ }, () => ({ path: "before", namespace: "qa" }));
      builder.onResolve({ filter: /^@\/app\/jeu\/centre-de-formation\/actions$/ }, () => ({ path: "actions", namespace: "qa" }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "qa" }));
      builder.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: "dynamic", namespace: "qa" }));
      builder.onResolve({ filter: /^@\/components\/ui\/app-link$/ }, () => ({ path: "link", namespace: "qa" }));
      builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => {
        const contents = path === "before" ? baselinePath ? readFileSync(baselinePath, "utf8") : `export {AcademyRiderCard} from '@/components/game/academy-rider-card';`
          : path === "navigation" ? `export function useRouter(){return {refresh(){},push(){},replace(){},prefetch(){}};}`
          : path === "dynamic" ? `import {DocumentLocaleBridge} from '@/components/i18n/document-locale-bridge';export default function dynamic(){return DocumentLocaleBridge;}`
          : path === "link" ? `import React,{forwardRef} from 'react';export default forwardRef(function Link({href,children,...props},ref){return <a {...props} ref={ref} href={typeof href==='string'?href:href.pathname}>{children}</a>;});`
          : `const action=async(...args)=>{window.qaActionCalls.push(args);throw Error('Server actions are disabled in offline QA');};
            export const naturalizeYouthRiderAction=action,recruitYouthRiderInlineAction=action,startYouthManualTrainingAction=action,
              completeYouthManualTrainingAction=action,dismissYouthRidersBulkAction=action,saveYouthTrainingSettingsBulkAction=action;`;
        return { contents, loader: "tsx", resolveDir: process.cwd() };
      });
    },
  }],
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

const browser = await chromium.launch({ executablePath, headless: true });
const measurements = [];
const widths = flags.find(flag=>flag.startsWith('--widths='))?.slice(9).split(',').map(Number) ?? [320, 360, 390, 768, 1280, 1440];
let checks = 0;
let modeFilterChecks = 0;
let revision = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
const checkFilter = (condition, message) => { check(condition, message); modeFilterChecks++; };
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 }, isMobile: width < 768, hasTouch: width < 768 });
    let networkCalls = 0;
    await context.route("**/*", (route) => { networkCalls++; return route.abort(); });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent("<meta name='viewport' content='width=device-width, initial-scale=1'><body class='game-shell'><div id='root'></div></body>");
    await page.addStyleTag({ content: css.css + "\n" + mobileStyles + "\n" + flagStyles });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const card = (id = 1) => page.locator(`#junior-qa-junior-${id}`);
    const mount = async (props) => {
      await page.evaluate((value) => { document.documentElement.lang = value.locale ?? 'fr'; window.mountAcademy(value); }, { ...props, revision: ++revision });
      await card().waitFor({timeout:10000}).catch(async(error)=>{throw new Error(`${error.message}\nBrowser errors: ${errors.join('; ')}\nDOM: ${(await page.locator('body').innerText()).slice(0,1000)}`);});
      await page.waitForTimeout(100);
    };
    const layout = async (variant) => {
      const bounds = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-academy-rider-card]')].filter(element=>element.checkVisibility()).map(element => {
          const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
          return {id:element.id,x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom,
            borderTopWidth:style.borderTopWidth,borderLeftWidth:style.borderLeftWidth,borderTopColor:style.borderTopColor,borderRadius:style.borderRadius,
            background:style.backgroundColor,boxShadow:style.boxShadow};
        });
        const overflow=[...document.querySelectorAll('body *')].filter(element=>element.checkVisibility()).map(element=>{
          const rect=element.getBoundingClientRect();return {tag:element.tagName,id:element.id,x:rect.x,right:rect.right,className:element.className?.baseVal??element.className};
        }).filter(entry=>entry.x<-.5||entry.right>innerWidth+.5);
        return {cards,overflow,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
      });
      check(bounds.scrollWidth <= width, `${width}/${variant}: page overflows: ${JSON.stringify(bounds.overflow.slice(-8))}`);
      check(bounds.overflow.length === 0, `${width}/${variant}: visible content leaves viewport: ${JSON.stringify(bounds.overflow.slice(-8))}`);
      for (const item of bounds.cards) {
        check(parseFloat(item.borderTopWidth)>0 && parseFloat(item.borderLeftWidth)>0, `${width}/${variant}: ${item.id} has visible card boundaries`);
        check(parseFloat(item.borderRadius)>=16, `${width}/${variant}: ${item.id} has a distinct rounded card`);
      }
      for (let index=1; index<bounds.cards.length; index++) {
        const gap=bounds.cards[index].y-bounds.cards[index-1].bottom;
        check(gap>=11 && gap<=20, `${width}/${variant}: next rider separated by ${gap}px`);
      }
      measurements.push({width,variant,...bounds});
      return bounds;
    };
    let beforeHeight;
    if (baselinePath) {
      await mount({before:true,locale:'fr'});
      const before=await layout('before-fr');
      beforeHeight=before.cards[0].height;
      if (screenshotDirectory) await page.screenshot({path:join(screenshotDirectory,`academy-before-${width}-fr.png`),fullPage:true});
    }
    if (baselineOnly) {
      check(errors.length===0, `${width}: baseline browser errors: ${errors.join('; ')}`);
      check(networkCalls===0, `${width}: baseline makes no network requests`);
      await context.close();
      continue;
    }
    for (const locale of locales) {
      await mount({locale});
      const after=await layout(`after-${locale}-collapsed`);
      if (screenshotDirectory) await page.screenshot({path:join(screenshotDirectory,`academy-after-${width}-${locale}-collapsed.png`),fullPage:true});
      const first=card(),second=card(2),released=card(3);
      const modeFilter=page.locator('select').first();
      const filterBar=page.locator('[data-youth-training-filter]');
      const displayedCount=()=>filterBar.locator('strong').first().textContent();
      const visibleCardIds=()=>page.locator('[data-academy-rider-card]:visible').evaluateAll(elements=>elements.map(element=>element.id));
      const originalFirstCard=await first.elementHandle();
      checkFilter(await modeFilter.inputValue()==='all', `${width}/${locale}: current-mode filter defaults to all juniors`);
      checkFilter(await displayedCount()==='3 / 3', `${width}/${locale}: default counter includes every junior`);
      checkFilter(JSON.stringify(await modeFilter.locator('option').evaluateAll(options=>options.map(option=>option.value)))===JSON.stringify(['all','manual','automatic']), `${width}/${locale}: exactly the three requested mode filters`);
      if(locale==='en') checkFilter(!/Tous les juniors|Manuel|Automatique/.test(await modeFilter.textContent()), `${width}: mode filter options translated into English`);
      await modeFilter.selectOption('manual');
      checkFilter(JSON.stringify(await visibleCardIds())===JSON.stringify(['junior-qa-junior-1']), `${width}/${locale}: manual filter excludes a future manual preference and pending departures`);
      checkFilter(await page.locator('[data-academy-rider-card]').count()===3, `${width}/${locale}: hidden cards remain mounted`);
      checkFilter(await displayedCount()==='1 / 3', `${width}/${locale}: manual filter counter matches visible riders`);
      await layout(`after-${locale}-manual-filter`);
      if(screenshotDirectory&&(width===320||width===390||width===1440)) await page.screenshot({path:join(screenshotDirectory,`academy-filter-${width}-${locale}-manual.png`),fullPage:true});
      await modeFilter.selectOption('automatic');
      checkFilter(JSON.stringify(await visibleCardIds())===JSON.stringify(['junior-qa-junior-2']), `${width}/${locale}: automatic filter uses today's mode despite manual preference for tomorrow`);
      checkFilter(await displayedCount()==='1 / 3', `${width}/${locale}: automatic filter counter matches visible riders`);
      checkFilter(await first.evaluate((element,original)=>element===original,originalFirstCard), `${width}/${locale}: changing filters preserves each actual card node`);
      await layout(`after-${locale}-automatic-filter`);
      await modeFilter.selectOption('all');
      checkFilter((await visibleCardIds()).length===3, `${width}/${locale}: all restores active juniors and pending departures`);
      const sections=first.locator('[data-academy-section]');
      check(await sections.count()===3, `${width}/${locale}: profile, training, management sections exist`);
      check(await sections.evaluateAll(elements=>elements.every(element=>element.tagName==='DETAILS'&&!element.open)), `${width}/${locale}: three native sections initially collapsed`);
      const maximumHeight=width===320?400:340;
      check(after.cards[0].height<=maximumHeight, `${width}/${locale}: default first card height ${after.cards[0].height}px exceeds ${maximumHeight}px`);
      if (beforeHeight) check(after.cards[0].height<=beforeHeight*.5, `${width}/${locale}: card height ${after.cards[0].height}px must halve baseline ${beforeHeight}px`);
      check(await first.locator('[data-rating-importance="primary"]:visible').count()===6, `${width}/${locale}: six primary ratings visible`);
      check(await first.locator('[data-rider-morale-gauge]:visible').count()===1, `${width}/${locale}: morale visible`);
      check(await first.getByRole('button',{name:/Préparer le minijeu|Prepare the minigame|Prepare minigame/i}).count()===0, `${width}/${locale}: mini-game hidden from accessible controls when collapsed`);
      check(await first.getByRole('combobox').count()===0, `${width}/${locale}: training inputs hidden from accessible controls when collapsed`);
      check(await first.locator('select').count()===2, `${width}/${locale}: collapsed training controls remain mounted`);
      check((await second.innerText()).includes('2027'), `${width}/${locale}: scheduled promotion remains visible`);
      check(/Dernière année|Final year|Last year/i.test(await second.innerText()), `${width}/${locale}: final-year status remains visible`);
      check(/Départ programmé|Scheduled departure|Departure scheduled/i.test(await released.innerText()), `${width}/${locale}: pending departure remains visible`);
      check(await released.locator('select').count()===0, `${width}/${locale}: pending departure has no training settings`);
      check(await released.getByRole('button',{name:/Préparer|Prepare/i}).count()===0, `${width}/${locale}: pending departure has no mini-game`);
      if (locale==='en') {
        const labels=await sections.locator(':scope > summary').allTextContents();
        check(labels.every(text=>!text.includes('Profil complet')&&!text.includes('Entraînement')&&!text.includes('Gestion')), `${width}: English section labels translated: ${labels.join('; ')}`);
        check(!/\bManuel\b|Automatique|Scolarité et avenir|Notes secondaires et aptitudes/.test(labels.join('; ')), `${width}: English section status and detail translated: ${labels.join('; ')}`);
      }

      const profile=first.locator('[data-academy-section="profile"]');
      const training=first.locator('[data-academy-section="training"]');
      const management=first.locator('[data-academy-section="management"]');
      const toggle=async(section)=>{
        const summary=section.locator(':scope > summary');
        if(width<768) await summary.tap();
        else {await summary.focus();await summary.press('Enter');}
        await page.waitForTimeout(35);
      };
      await toggle(profile);
      check(await profile.getAttribute('open')!==null, `${width}/${locale}: profile opens`);
      check(await first.locator('[data-rating-importance]:visible').count()===13, `${width}/${locale}: all thirteen ratings in full profile`);
      check(await second.locator('[data-academy-section][open]').count()===0, `${width}/${locale}: opening first profile leaves next rider closed`);
      await layout(`after-${locale}-profile`);
      await toggle(profile);

      await toggle(training);
      check(await training.getByRole('combobox').count()===2, `${width}/${locale}: both real training selects reachable`);
      const prepare=training.getByRole('button',{name:/Préparer le minijeu|Prepare.*mini.?game/i});
      check(await prepare.count()===1 && await prepare.isEnabled(), `${width}/${locale}: manual mini-game preparation reachable only after expansion`);
      if(width<768) await prepare.tap();
      else await prepare.click();
      const dialog=page.getByRole('dialog');
      await dialog.waitFor();
      check(await dialog.evaluate(element=>element.parentElement===document.body), `${width}/${locale}: academy mini-game uses a body portal`);
      await training.evaluate(element=>{element.open=false;});
      check(await dialog.isVisible(), `${width}/${locale}: closing training cannot hide a prepared mini-game dialog`);
      check(await dialog.evaluate(element=>element.closest('details')===null), `${width}/${locale}: mini-game dialog stays outside closed disclosure`);
      await modeFilter.selectOption('automatic');
      checkFilter(await first.isHidden(), `${width}/${locale}: manual rider is hidden by the automatic filter`);
      checkFilter(await dialog.isVisible(), `${width}/${locale}: filtering its rider cannot hide the prepared mini-game body portal`);
      if(screenshotDirectory&&(width===390||width===1440)) await page.screenshot({path:join(screenshotDirectory,`academy-after-${width}-${locale}-minigame.png`),fullPage:true});
      await dialog.getByRole('button',{name:/^Retour$|^Back$|^Return$/i}).click();
      await dialog.waitFor({state:'hidden'});
      await modeFilter.selectOption('all');
      check(await page.evaluate(()=>window.qaActionCalls.length===0), `${width}/${locale}: preparing and canceling never starts a server-side training session`);
      await toggle(training);
      const mode=training.locator('select').nth(0),priority=training.locator('select').nth(1);
      const initialPriority=await priority.inputValue();
      const nextPriority=await priority.locator('option').evaluateAll(options=>options.find(option=>option.value!==options[0].parentElement.value).value);
      await priority.selectOption(nextPriority);
      await page.locator('form input[name="settings"]').waitFor({state:'attached'});
      const changed=JSON.parse(await page.locator('form input[name="settings"]').inputValue());
      check(changed.length===1&&changed[0].academyRiderId==='qa-junior-1'&&changed[0].trainingPriority===nextPriority, `${width}/${locale}: provider stages the correct rider's changed settings`);
      const selectedReference=await priority.elementHandle();
      await toggle(training);
      check(await first.getByRole('combobox').count()===0, `${width}/${locale}: collapsing hides accessible selects`);
      await toggle(training);
      check(await priority.inputValue()===nextPriority, `${width}/${locale}: changed setting survives closing and reopening`);
      check(await priority.evaluate((element,original)=>element===original,selectedReference), `${width}/${locale}: select stays mounted through collapse`);
      const secondTraining=second.locator('[data-academy-section="training"]');
      await toggle(secondTraining);
      check(await secondTraining.locator('select').nth(0).inputValue()==='manual', `${width}/${locale}: scheduled preference remains separate from active mode`);
      check(/Mode actif|Active mode/i.test(await secondTraining.innerText()), `${width}/${locale}: active automatic mode retained before pending manual switch`);
      check(/prochaine journée|next day|next training day/i.test(await secondTraining.innerText()), `${width}/${locale}: pending-mode explanatory notice retained`);
      check(await secondTraining.getByRole('button',{name:/Préparer|Prepare/i}).count()===0, `${width}/${locale}: pending manual switch does not enable today's mini-game`);
      check(await secondTraining.locator('select').nth(1).inputValue()===initialPriority, `${width}/${locale}: changing first rider leaves second rider untouched`);
      await toggle(secondTraining);
      await mode.selectOption('automatic');
      const twiceChanged=JSON.parse(await page.locator('form input[name="settings"]').inputValue());
      check(twiceChanged.length===1&&twiceChanged[0].trainingMode==='automatic', `${width}/${locale}: changed mode stages correctly`);
      const stagedSettings=JSON.stringify(twiceChanged);
      await modeFilter.selectOption('manual');
      checkFilter(await first.isVisible()&&await second.isHidden(), `${width}/${locale}: a local preference change does not reclassify today's manual training`);
      await modeFilter.selectOption('automatic');
      checkFilter(await first.isHidden()&&await second.isVisible(), `${width}/${locale}: automatic filter hides the edited manual junior`);
      checkFilter(await priority.inputValue()===nextPriority&&await mode.inputValue()==='automatic', `${width}/${locale}: hidden training inputs retain their changed values`);
      checkFilter(await page.locator('form input[name="settings"]').inputValue()===stagedSettings, `${width}/${locale}: filtering preserves the exact bulk save payload`);
      checkFilter(await filterBar.getByRole('status').isVisible()&&await filterBar.getByRole('status').locator('strong').textContent()==='1', `${width}/${locale}: one hidden training decision is explicitly flagged`);
      await modeFilter.selectOption('all');
      checkFilter(await priority.evaluate((element,original)=>element===original,selectedReference), `${width}/${locale}: a filtered training field is not remounted`);
      checkFilter(await training.getAttribute('open')!==null, `${width}/${locale}: a card's disclosure state survives filtering`);
      checkFilter(await filterBar.getByRole('status').count()===0, `${width}/${locale}: hidden-decision warning disappears when all cards are visible`);
      await layout(`after-${locale}-training-changed`);
      if (screenshotDirectory&&(width===390||width===1440)) await page.screenshot({path:join(screenshotDirectory,`academy-after-${width}-${locale}-training.png`),fullPage:true});
      await mode.selectOption('manual');
      await priority.selectOption(initialPriority);
      check(await page.locator('form input[name="settings"]').count()===0, `${width}/${locale}: restoring selections clears bulk training decision`);
      await toggle(training);

      await toggle(management);
      const promotion=management.locator('form').filter({has:page.locator('input[name="academyRiderId"]')});
      check(await promotion.count()===2, `${width}/${locale}: original promotion and naturalization forms retained`);
      check(await promotion.locator('input[name="academyRiderId"]').evaluateAll(inputs=>inputs.every(input=>input.value==='qa-junior-1')), `${width}/${locale}: retained forms target correct rider`);
      const dismissal=management.locator('input[type="checkbox"]');
      if (!(await dismissal.isVisible())) {
        const nested=management.locator('details');
        check(await nested.count()===1, `${width}/${locale}: explicit departure disclosure retained`);
        await toggle(nested);
      }
      await dismissal.check();
      const dismissalValue=JSON.parse(await page.locator('input[name="academyRiderIds"]').inputValue());
      check(dismissalValue.length===1&&dismissalValue[0]==='qa-junior-1', `${width}/${locale}: departure selection stages correct rider`);
      const secondManagement=second.locator('[data-academy-section="management"]');
      await toggle(secondManagement);
      const secondDismissal=secondManagement.locator('input[type="checkbox"]');
      if(!(await secondDismissal.isVisible())) await toggle(secondManagement.locator('details'));
      await secondDismissal.check();
      const bothDismissals=await page.locator('input[name="academyRiderIds"]').inputValue();
      checkFilter(JSON.parse(bothDismissals).length===2, `${width}/${locale}: two departures can be selected across both modes`);
      await modeFilter.selectOption('automatic');
      checkFilter(await page.locator('input[name="academyRiderIds"]').inputValue()===bothDismissals, `${width}/${locale}: filtering never silently removes a hidden departure selection`);
      checkFilter(await dismissal.isChecked()&&await secondDismissal.isChecked(), `${width}/${locale}: both visible and hidden dismissal controls preserve state`);
      checkFilter(await filterBar.getByRole('status').isVisible()&&await filterBar.getByRole('status').locator('strong').textContent()==='1', `${width}/${locale}: one hidden departure is explicitly flagged`);
      await modeFilter.selectOption('all');
      await secondDismissal.uncheck();
      await toggle(secondManagement);
      check(await page.locator('input[name="age"]').inputValue()==='18', `${width}/${locale}: bulk filter state preserved`);
      await toggle(management);
      await toggle(management);
      check(await dismissal.isChecked(), `${width}/${locale}: departure decision survives close/reopen`);
      await layout(`after-${locale}-management`);
      if (screenshotDirectory&&(width===390||width===1440)) await page.screenshot({path:join(screenshotDirectory,`academy-after-${width}-${locale}-management.png`),fullPage:true});
      await dismissal.uncheck();
      await toggle(management);
      check(await page.evaluate(()=>window.qaSubmitEvents.length===0&&window.qaActionCalls.length===0), `${width}/${locale}: disclosure interactions never submit forms or invoke server actions`);
      await mount({locale,variant:'young'});
      const emptyModeFilter=page.locator('select').first();
      const youngCardReference=await card().elementHandle();
      await card().locator('[data-academy-section="training"] > summary').click();
      await emptyModeFilter.selectOption('automatic');
      checkFilter(await page.locator('[data-academy-rider-card]:visible').count()===0, `${width}/${locale}: unmatched current-mode filter shows no rider`);
      checkFilter(await card().count()===1&&await card().isHidden(), `${width}/${locale}: an empty filtered result keeps the real card mounted`);
      checkFilter(await page.locator('[data-youth-training-filter] strong').first().textContent()==='0 / 1', `${width}/${locale}: empty filter counter is accurate`);
      const showAll=page.getByRole('button',{name:/^Voir tous les juniors$|^Show all juniors$/i});
      checkFilter(await showAll.isVisible(), `${width}/${locale}: empty filter has a clear translated reset action`);
      await showAll.click();
      checkFilter(await emptyModeFilter.inputValue()==='all'&&await card().isVisible(), `${width}/${locale}: empty filter reset restores all juniors`);
      checkFilter(await card().evaluate((element,original)=>element===original,youngCardReference), `${width}/${locale}: resetting an empty filter does not remount the card`);
      checkFilter(await card().locator('[data-academy-section="training"]').getAttribute('open')!==null, `${width}/${locale}: opening state survives an empty filtered result`);
    }
    await mount({locale:'fr',variant:'young'});
    check(/Recrutable à partir de 17 ans/.test(await card().textContent()), `${width}: under-age recruitment restriction retained`);
    await card().locator('[data-academy-section="training"] > summary').click();
    await page.waitForFunction(()=>document.querySelector('#junior-qa-junior-1 [data-academy-section="training"]').open);
    await page.waitForTimeout(35);
    const youngText=await card().innerText();
    if(screenshotDirectory&&(width===390||width===1440)) await page.screenshot({path:join(screenshotDirectory,`academy-after-${width}-fr-young.png`),fullPage:true});
    check(/Créneau manuel déjà effectué/i.test(youngText), `${width}: completed manual slot state retained`);
    check(await card().getByRole('button',{name:/Préparer le minijeu/i}).count()===0, `${width}: completed slot cannot prepare again`);
    await layout('after-fr-young-completed');
    await mount({locale:'fr',variant:'capacity'});
    check(/Promotion impossible/.test(await card().textContent()), `${width}: full next-season roster restriction retained`);
    check(await card().locator('form').count()===1, `${width}: capacity restriction removes only promotion form`);
    await layout('after-fr-capacity');
    check(errors.length===0, `${width}: browser errors: ${errors.join('; ')}`);
    check(networkCalls===0, `${width}: cards make no network requests`);
    console.log(`${width}px: compact roster, disclosures, staged training and management passed.`);
    await context.close();
  }
} finally {
  await browser.close();
  if (screenshotDirectory) writeFileSync(join(screenshotDirectory,baselineOnly?'baseline-measurements.json':'measurements.json'),JSON.stringify(measurements,null,2));
}
console.log(`PASS ${checks} isolated ${baselineOnly?'baseline':'compact academy'} checks (${modeFilterChecks} mode-filter checks) across ${widths.join('/')}px${baselineOnly?'':', FR/EN, training state, management, promotion and departure variants'}.`);
