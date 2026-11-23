// Offline React 19 integration: SSR, current training settings and browser restoration.
// Supply an installed playwright-core module and browser executable path.
// An isolated headless browser is used; no player account or network is used.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const browserModule = process.argv[2];
const executablePath = process.argv[3];
if (!browserModule || !executablePath) throw Error("Supply playwright-core module and browser executable paths");
const expectBug = process.argv.includes("--expect-bug");
const expectLateBug = process.argv.includes("--expect-late-bug");
const artifactIndex = process.argv.indexOf("--artifacts");
const artifactDirectory = artifactIndex < 0 ? null : process.argv[artifactIndex + 1];
const sourceIndex = process.argv.indexOf("--controls-source");
const controlsSource = sourceIndex < 0 ? null : process.argv[sourceIndex + 1];
const refIndex = process.argv.indexOf("--controls-ref");
const controlsRef = refIndex < 0 ? null : process.argv[refIndex + 1];
const legacyControls = controlsSource ? readFileSync(controlsSource, "utf8") : controlsRef
  ? execFileSync("git", ["show", `${controlsRef}:components/game/training-controls.tsx`], { encoding: "utf8" }) : null;
const { chromium } = await import(pathToFileURL(browserModule).href);

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from "react";
      import {renderToString} from "react-dom/server.edge";
      import {hydrateRoot} from "react-dom/client";
      import {RiderTrainingPlanFields, TrainingPlansEditor, TrainingRosterList}
        from "@/components/game/training-controls";
      const trainers = [
        {contractId:"coach-a",countryId:"fr",countryName:"France",countryCode:"FR",firstName:"Jean",lastName:"Actif",level:5,
          specialty:"mountain",specialtyLabel:"Montagne",efficiencyBonus:20,talents:[],assignedRiderCount:1,riderCapacity:1},
        {contractId:"coach-b",countryId:"be",countryName:"Belgique",countryCode:"BE",firstName:"Luc",lastName:"Second",level:3,
          specialty:"sprint",specialtyLabel:"Sprint",efficiencyBonus:12,talents:[],assignedRiderCount:0,riderCapacity:2},
      ];
      const initialPlans = [
        {riderId:"a",intensity:58,domain:"stage_racer",trainerContractId:"coach-a"},
        {riderId:"b",intensity:75,domain:"sprinter",trainerContractId:null},
      ];
      const riders = [{id:"a",firstName:"Ana",lastName:"Zulu",squadStatus:"absolute_leader"},
        {id:"b",firstName:"Bob",lastName:"Alpha",squadStatus:"domestique"}];
      function App(){return <TrainingPlansEditor trainerIds={trainers.map(t=>t.contractId)} initialPlans={initialPlans}>
        <TrainingRosterList riders={riders}>{riders.map(rider=><article key={rider.id} data-rider={rider.id}>
          <RiderTrainingPlanFields riderId={rider.id} riderCountryCode="FR" trainers={trainers}/>
        </article>)}</TrainingRosterList>
      </TrainingPlansEditor>}
      window.qaMarkup=renderToString(<App/>);
      window.qaHydrate=()=>{window.qaRoot=hydrateRoot(document.getElementById("root"),<App/>,
        {onRecoverableError:error=>window.qaErrors.push(error.message)});};
      window.qaUnmount=()=>window.qaRoot.unmount();
    `,
  },
  plugins: [{ name: "offline-training", setup(b) {
    b.onResolve({ filter: /^@\/app\/jeu\/entrainement\/actions$/ }, () => ({ path: "actions", namespace: "qa" }));
    b.onLoad({ filter: /.*/, namespace: "qa" }, () => ({ contents: `
      export const saveRiderTrainingPlansAction=(previous,data)=>window.qaSave(previous,data);
      export const saveTeamTrainingSettingsAction=()=>{throw Error("Unexpected threshold save");};
    ` }));
    if (legacyControls) {
      b.onResolve({ filter: /^@\/components\/game\/training-controls$/ }, () => ({ path: "controls", namespace: "baseline" }));
      b.onLoad({ filter: /.*/, namespace: "baseline" }, () => ({ contents: legacyControls, loader: "tsx", resolveDir: process.cwd() }));
    }
  } }],
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  let networkCalls = 0;
  await context.route("**/*", route => { networkCalls++; return route.abort(); });
  await page.setContent('<style>article{min-height:650px}select{display:block;max-width:350px}</style><div id="root"></div>');
  await page.evaluate(() => {
    window.qaErrors = [];
    window.qaCalls = [];
    window.qaSave = (_previous, data) => new Promise(resolve => window.qaCalls.push({ plans: JSON.parse(data.get("plans")), resolve }));
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const tick = () => page.waitForTimeout(60);
  const field = (kind, rider = "a") => page.locator(`#training-${kind}-${rider}`);
  const caption = (kind, rider = "a") => page.locator(`#training-${kind}-${rider}-value`).textContent();
  const options = (kind, rider = "a") => field(kind, rider).locator("xpath=..").getByRole("button");
  const plans = () => page.locator('input[name="plans"]').inputValue().then(JSON.parse);
  const calls = () => page.evaluate(() => window.qaCalls.map(call => call.plans));
  const restoreBrowserFields = () => page.evaluate(() => {
    const trainer = document.getElementById("training-trainer-a");
    const domain = document.getElementById("training-domain-a");
    document.querySelector("form").reset();
    if (trainer instanceof HTMLSelectElement) trainer.value = "";
    if (domain instanceof HTMLSelectElement) domain.value = "climber";
  });
  const pageshow = () => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await page.evaluate(() => { document.getElementById("root").innerHTML = window.qaMarkup; });

  if (expectBug || expectLateBug) {
    assert.equal(await field("trainer").inputValue(), "coach-a");
    assert.equal(await field("domain").inputValue(), "stage_racer");
    await restoreBrowserFields();
    await page.evaluate(() => window.qaHydrate());
    await tick(); await tick();
    if (expectLateBug) {
      assert.equal(await field("trainer").inputValue(), "coach-a", "previous fix reconciles initial hydration");
      await pageshow();
      await tick(); await tick();
      await restoreBrowserFields();
    }
    assert.equal(await field("trainer").inputValue(), "");
    assert.equal(await field("domain").inputValue(), "climber");
    assert.match(await page.locator('[data-rider="a"]').textContent(), /Compétence de base · Montagne/);
    assert.deepEqual(await plans(), []);
    assert.equal((await calls()).length, 0);
    console.log(JSON.stringify({ baselineBugReproduced: true, lateBrowserRestoration: expectLateBug, gameplayWrites: 0 }));
  } else {
    assert.equal(await caption("trainer"), "Jean Actif", "SSR displays the saved active coach");
    assert.match(await caption("domain"), /^Coureur de tour/, "SSR displays the saved focus");
    assert.equal(await caption("trainer", "b"), "Sans entraîneur");
    assert.match(await caption("domain", "b"), /^Sprinteur/);

    await restoreBrowserFields();
    await page.evaluate(() => window.qaHydrate());
    await tick();
    await pageshow();
    await tick(); await tick();
    await restoreBrowserFields();
    assert.equal(await caption("trainer"), "Jean Actif", "late restoration cannot overwrite the rendered coach");
    assert.match(await caption("domain"), /^Coureur de tour/, "late restoration cannot overwrite the rendered focus");
    assert.deepEqual(await plans(), [], "browser restoration never marks plans dirty");

    await field("trainer", "b").click();
    assert.equal(await options("trainer", "b").filter({ hasText: "Jean Actif" }).isDisabled(), true, "full coach cannot be assigned to another rider");
    await field("trainer", "b").press("Escape");
    assert.equal(await field("trainer", "b").locator("xpath=..").getAttribute("open"), null);

    await field("trainer").press("Enter");
    const currentCoach = options("trainer").filter({ hasText: "Jean Actif" });
    assert.equal(await currentCoach.isEnabled(), true, "current full coach stays selectable");
    assert.equal(await currentCoach.getAttribute("aria-pressed"), "true");
    await field("trainer").press("Tab");
    const firstCoachChoice = options("trainer").filter({ hasText: "Sans entraîneur" });
    assert.equal(await firstCoachChoice.evaluate(button => document.activeElement === button), true);
    await firstCoachChoice.press("Escape");
    assert.equal(await field("trainer").evaluate(summary => document.activeElement === summary), true, "Escape returns focus to the selector");

    await field("domain").click();
    await options("domain").filter({ hasText: /^Rouleur/ }).click();
    assert.match(await caption("domain"), /^Rouleur/);
    await field("trainer").click();
    await options("trainer").filter({ hasText: "Luc Second" }).click();
    assert.equal(await caption("trainer"), "Luc Second");
    assert.equal(await field("trainer").locator("xpath=..").getAttribute("open"), null);
    assert.deepEqual(await plans(), [{ riderId: "a", intensity: 58, domain: "rouleur", trainerContractId: "coach-b" }]);

    await pageshow();
    await restoreBrowserFields();
    await tick(); await tick();
    await restoreBrowserFields();
    assert.equal(await caption("trainer"), "Luc Second", "history retains the current draft coach");
    assert.match(await caption("domain"), /^Rouleur/, "history retains the current draft focus");
    assert.equal(await caption("trainer", "b"), "Sans entraîneur");
    assert.equal((await calls()).length, 0);

    await page.locator("select").first().selectOption("rider"); await tick();
    assert.deepEqual(await page.locator("article[data-rider]").evaluateAll(rows => rows.map(row => row.dataset.rider)), ["b", "a"]);
    await field("trainer").scrollIntoViewIfNeeded();
    assert.equal(await caption("trainer"), "Luc Second");
    assert.match(await caption("domain"), /^Rouleur/);

    await field("trainer").click();
    await options("trainer").filter({ hasText: "Sans entraîneur" }).click();
    assert.equal(await caption("trainer"), "Sans entraîneur", "the DS can explicitly remove the coach");
    assert.equal((await plans())[0].trainerContractId, null);
    assert.doesNotMatch(await page.locator('[data-rider="a"]').textContent(), /Talents de l’entraîneur/);

    await page.evaluate(() => document.querySelector("form").requestSubmit()); await tick();
    assert.equal((await calls()).length, 1, "one explicit validation performs one batch save");
    assert.deepEqual((await calls())[0], [{ riderId: "a", intensity: 58, domain: "rouleur", trainerContractId: null }]);
    await page.evaluate(() => {
      const submitted = window.qaCalls[0].plans;
      window.qaCalls[0].resolve({ status: "success", message: "Enregistré.", savedPlans: submitted, submittedPlans: submitted, failures: [] });
    });
    await tick();
    assert.deepEqual(await plans(), []);
    assert.deepEqual(await page.evaluate(() => window.qaErrors), []);
    assert.deepEqual(pageErrors, []);
    assert.equal(networkCalls, 0);
    console.log(JSON.stringify({ offlineChromiumMobileChecks: "passed", lateBrowserRestoration: true, localEditsPreserved: true,
      keyboardAccess: true, coachCapacity: true, rosterSortAndScroll: true, explicitRemoval: true, oneBatchSave: true, networkCalls }));
  }
  await page.evaluate(() => window.qaUnmount());
  await context.close();

  if (!expectBug && !expectLateBug && !legacyControls) {
    await checkTrainingRosterSorting(browser);
  }
} finally {
  await browser.close();
}

async function checkTrainingRosterSorting(browser) {
  const css = await postcss([tailwindcss()]).process(`
    @import "tailwindcss" source(none);
    @source "../components/game/training-controls.tsx";
    @source "../components/game/training-intensity-presets.tsx";
    @source "../components/game/training-domain-gain-breakdown.tsx";
    @source "../scripts/test-training-select-hydration.mjs";
    * { box-sizing:border-box; }
    body { margin:0; background:#edf5f1; color:#183f37; font-family:Arial,sans-serif; }
  `, { from: join(process.cwd(), "app/training-sort-harness.css") });
  const sortingBundle = await build({
    stdin: {
      resolveDir: process.cwd(), loader: "tsx", contents: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {LocaleProvider} from '@/components/i18n/locale-provider';
        import {RiderTrainingPlanFields,TrainingPlansEditor,TrainingRosterList}
          from '@/components/game/training-controls';
        const ratings = value => ({mountain:value,hills:value,flat:value,timeTrial:value,
          cobbles:value,sprint:value,acceleration:value,downhill:value,endurance:value,
          resistance:value,recovery:value,breakaway:value,prologue:value});
        const riders = [
          {id:'a',firstName:'Ana',lastName:'Zulu',countryName:'France',countryCode:'FR',age:25,
            potentialSteps:6,form:90,morale:40,squadStatus:'absolute_leader',intensity:58,
            ratings:{...ratings(60),mountain:65,sprint:88,timeTrial:71}},
          {id:'b',firstName:'Bob',lastName:'Alpha',countryName:'Belgique',countryCode:'BE',age:21,
            potentialSteps:10,form:70,morale:80,squadStatus:'domestique',intensity:75,
            ratings:{...ratings(70),mountain:70,timeTrial:90}},
          {id:'c',firstName:'Cara',lastName:'Gamma',countryName:'Éthiopie',countryCode:'ET',age:28,
            potentialSteps:8,form:80,morale:70,squadStatus:null,intensity:0,
            ratings:{...ratings(65),mountain:80,timeTrial:65}},
          {id:'d',firstName:'Dan',lastName:'Beta',countryName:'France',countryCode:'FR',age:24,
            potentialSteps:8,form:60,morale:60,squadStatus:'co_leader',intensity:40,
            ratings:{...ratings(75),mountain:70,flat:85,timeTrial:80}},
        ];
        const initialPlans = [
          {riderId:'a',intensity:58,domain:'stage_racer',trainerContractId:'coach-a'},
          {riderId:'b',intensity:75,domain:'sprinter',trainerContractId:null},
          {riderId:'c',intensity:0,domain:'climber',trainerContractId:null},
          {riderId:'d',intensity:40,domain:'puncheur',trainerContractId:null},
        ];
        const trainers = [
          {contractId:'coach-a',countryId:'fr',countryName:'France',countryCode:'FR',firstName:'Jean',lastName:'Actif',level:5,
            specialty:'mountain',specialtyLabel:'Montagne',efficiencyBonus:20,talents:[],assignedRiderCount:1,riderCapacity:1},
          {contractId:'coach-b',countryId:'be',countryName:'Belgique',countryCode:'BE',firstName:'Luc',lastName:'Second',level:3,
            specialty:'sprint',specialtyLabel:'Sprint',efficiencyBonus:12,talents:[],assignedRiderCount:0,riderCapacity:3},
        ];
        window.mountSorting=(locale)=>{
          createRoot(document.getElementById('root')).render(<LocaleProvider initialLocale={locale}>
            <main className='mx-auto max-w-7xl p-3 sm:p-6'>
              <TrainingPlansEditor trainerIds={trainers.map(t=>t.contractId)} initialPlans={initialPlans}>
                <TrainingRosterList riders={riders}>{riders.map(rider=><article
                  className='rounded-2xl border border-[#315B3E]/15 bg-white p-4' key={rider.id} data-rider={rider.id}>
                  <h2 className='mb-3 font-black'>{rider.firstName} {rider.lastName} · {rider.countryName}</h2>
                  <RiderTrainingPlanFields riderId={rider.id} riderCountryCode={rider.countryCode} trainers={trainers}/>
                </article>)}</TrainingRosterList>
              </TrainingPlansEditor>
            </main>
          </LocaleProvider>);
        };
      `,
    },
    plugins: [{ name: "offline-training-sort", setup(builder) {
      builder.onResolve({filter:/^@\/app\/jeu\/entrainement\/actions$/},()=>({path:"actions",namespace:"qa"}));
      builder.onLoad({filter:/.*/,namespace:"qa"},()=>({contents:`
        export const saveRiderTrainingPlansAction=(previous,data)=>window.qaSave(previous,data);
        export const saveTeamTrainingSettingsAction=()=>{throw Error('Unexpected threshold save');};
      `}));
    }}],
    bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",
    define:{"process.env.NODE_ENV":'"production"'},
  });
  let checks = 0;
  const measurements = [];
  const check = (condition,message)=>{assert(condition,message);checks++;};
  for (const width of [390,1440]) for (const locale of ["fr","en"]) {
    const context = await browser.newContext({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768});
    let networkCalls=0;
    await context.route("**/*",route=>{networkCalls++;return route.abort();});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>');
    await page.addStyleTag({content:css.css});
    await page.evaluate(()=>{
      window.qaCalls=[];
      window.qaSave=(_previous,data)=>{window.qaCalls.push(JSON.parse(data.get("plans")));throw Error("Unexpected sorting save");};
    });
    await page.addScriptTag({content:sortingBundle.outputFiles[0].text});
    await page.evaluate(value=>window.mountSorting(value),locale);
    await page.locator("article[data-rider]").first().waitFor();
    const sort=page.locator("select").first();
    const sector=page.locator("select").nth(1);
    const order=()=>page.locator("article[data-rider]").evaluateAll(rows=>rows.map(row=>row.dataset.rider));
    const pending=()=>page.locator('input[name="plans"]').inputValue().then(JSON.parse);
    const coachSummary=page.locator("#training-trainer-a");
    const domainSummary=page.locator("#training-domain-a");
    const invert=page.getByRole("button",{name:/Trier par ordre (?:croissant|décroissant)|Sort.*(?:ascending|descending)/i});
    const choose=async(key,expected)=>{
      await sort.selectOption(key);
      await page.waitForTimeout(35);
      check(JSON.stringify(await order())===JSON.stringify(expected),`${width}/${locale}/${key}: expected order ${expected}`);
    };
    if(locale==="en") await page.waitForFunction(()=>[...document.querySelectorAll('option')].some(option=>option.value==='nationality'&&option.textContent==='Nationality'));
    const offeredKeys=await sort.locator("option").evaluateAll(options=>options.map(option=>option.value).sort());
    const expectedKeys=["default","rider","squad_status","nationality","age","profile","potential","form","morale",
      "mountain","hills","flat","time_trial","cobbles","sprint","acceleration","downhill","endurance","resistance",
      "recovery","breakaway","prologue","average"].sort();
    check(JSON.stringify(offeredKeys)===JSON.stringify(expectedKeys),`${width}/${locale}: all 23 sort choices, including all 13 ratings`);
    check(await invert.isDisabled(),`${width}/${locale}: default order cannot invert`);
    await coachSummary.click();
    await coachSummary.locator("xpath=..").getByRole("button").filter({hasText:"Luc Second"}).click();
    await domainSummary.click();
    await domainSummary.locator("xpath=..").getByRole("button").filter({hasText:/^Rouleur/}).click();
    const draft=await pending();
    check(JSON.stringify(draft)===JSON.stringify([{riderId:"a",intensity:58,domain:"rouleur",trainerContractId:"coach-b"}]),`${width}/${locale}: explicit draft ready`);
    await choose("nationality",["b","c","d","a"]);
    check(await invert.getAttribute("type")==="button",`${width}/${locale}: inversion cannot submit form`);
    await invert.click();
    check(JSON.stringify(await order())===JSON.stringify(["d","a","c","b"]),`${width}/${locale}: reverse nationality`);
    await choose("potential",["b","d","c","a"]);
    await invert.click();
    check(JSON.stringify(await order())===JSON.stringify(["a","d","c","b"]),`${width}/${locale}: reverse potential`);
    await choose("mountain",["c","b","d","a"]);
    await invert.click();
    check(JSON.stringify(await order())===JSON.stringify(["a","b","d","c"]),`${width}/${locale}: reverse mountain`);
    await choose("time_trial",["b","d","a","c"]);
    await choose("profile",["c","b","d","a"]);
    await invert.click();
    check(JSON.stringify(await order())===JSON.stringify(["a","b","d","c"]),`${width}/${locale}: reverse sporting profile`);
    await choose("age",["b","d","a","c"]);
    await choose("form",["a","c","b","d"]);
    await choose("morale",["b","c","d","a"]);
    await choose("average",["d","b","c","a"]);
    await choose("rider",["b","d","c","a"]);
    await choose("squad_status",["a","d","b","c"]);
    await choose("default",["a","b","c","d"]);
    check(JSON.stringify(await pending())===JSON.stringify(draft),`${width}/${locale}: all sorts preserve current training draft`);
    check((await page.locator("#training-trainer-a-value").textContent())==="Luc Second",`${width}/${locale}: coach stays visibly assigned`);
    check((await page.locator("#training-domain-a-value").textContent()).startsWith("Rouleur"),`${width}/${locale}: domain stays visible`);
    await sector.selectOption("rouleur");
    check(JSON.stringify(await order())===JSON.stringify(["a"]),`${width}/${locale}: sector uses unsaved current draft`);
    await choose("potential",["a"]);
    await sector.selectOption("");
    const unscheduled=page.locator('input[type="checkbox"]').first();
    await unscheduled.check();
    check(JSON.stringify(await order())===JSON.stringify(["c"]),`${width}/${locale}: unscheduled filter survives sorting`);
    await choose("nationality",["c"]);
    await unscheduled.uncheck();
    check(JSON.stringify(await pending())===JSON.stringify(draft),`${width}/${locale}: filters retain draft`);
    check(await page.evaluate(()=>window.qaCalls.length)===0,`${width}/${locale}: zero saves from sorting or filtering`);
    check(networkCalls===0,`${width}/${locale}: no network request`);
    check(errors.length===0,`${width}/${locale}: no browser errors (${errors})`);
    const dimensions=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
    check(dimensions.scrollWidth<=width,`${width}/${locale}: no horizontal overflow`);
    if(artifactDirectory){
      mkdirSync(artifactDirectory,{recursive:true});
      await sort.scrollIntoViewIfNeeded();
      await page.screenshot({path:join(artifactDirectory,`training-sort-${width}-${locale}.png`),fullPage:true});
    }
    measurements.push({width,locale,networkCalls,...dimensions});
    await context.close();
  }
  const result={trainingRosterSortingChecks:checks,measurements};
  if(artifactDirectory)writeFileSync(join(artifactDirectory,"training-sort-checks.json"),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}
