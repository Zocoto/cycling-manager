// Offline React 19 integration: SSR, native controls and browser restoration.
// Supply an installed playwright-core module and browser executable path.
// An isolated headless browser is used; no player account or network is used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const browserModule = process.argv[2];
const executablePath = process.argv[3];
if (!browserModule || !executablePath) throw Error("Supply playwright-core module and browser executable paths");
const expectBug = process.argv.includes("--expect-bug");
const sourceIndex = process.argv.indexOf("--controls-source");
const controlsSource = sourceIndex < 0 ? null : process.argv[sourceIndex + 1];
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
    if (controlsSource) {
      b.onResolve({ filter: /^@\/components\/game\/training-controls$/ }, () => ({ path: "controls", namespace: "baseline" }));
      b.onLoad({ filter: /.*/, namespace: "baseline" }, () => ({ contents: readFileSync(controlsSource, "utf8"), loader: "tsx", resolveDir: process.cwd() }));
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
  const plans = () => page.locator('input[name="plans"]').inputValue().then(JSON.parse);
  const calls = () => page.evaluate(() => window.qaCalls.map(call => call.plans));
  await page.evaluate(() => { document.getElementById("root").innerHTML = window.qaMarkup; });
  assert.equal(await field("trainer").inputValue(), "coach-a", "SSR selects the saved active coach");
  assert.equal(await field("domain").inputValue(), "stage_racer", "SSR selects the saved focus");
  assert.equal(await field("trainer").evaluate(select => select.selectedOptions[0].disabled), false, "current full coach stays selectable");
  assert.equal(await field("trainer", "b").inputValue(), "", "unassigned rider initially has no coach");

  // Browser restoration/autofill can alter native properties before hydration
  // without changing the selected HTML attribute or dispatching a React event.
  await page.evaluate(() => {
    document.getElementById("training-trainer-a").value = "";
    document.getElementById("training-domain-a").value = "climber";
  });
  assert.match(await page.locator('[data-rider="a"]').textContent(), /Compétence de base · Montagne/);
  await page.evaluate(() => window.qaHydrate());
  await tick(); await tick();
  const hydrationSnapshot = { trainer: await field("trainer").inputValue(), domain: await field("domain").inputValue() };
  if (expectBug) {
    assert.deepEqual(hydrationSnapshot, { trainer: "", domain: "climber" }, "baseline reproduces native/React divergence");
    await field("domain").selectOption("rouleur"); await tick();
    assert.equal(await field("trainer").inputValue(), "coach-a", "changing focus makes the applied coach reappear");
    assert.equal((await plans())[0].trainerContractId, "coach-a", "React always retained the saved coach");
    assert.equal((await calls()).length, 0, "reproduction never saves or mutates gameplay");
    console.log(JSON.stringify({ baselineBugReproduced: true, hydrationSnapshot, coachReappearsAfterFocusChange: true, gameplayWrites: 0 }));
  } else {
    assert.deepEqual(hydrationSnapshot, { trainer: "coach-a", domain: "stage_racer" }, "hydration reconciles native controls before interaction");
    assert.deepEqual(await plans(), [], "reconciliation creates no unsaved change");
    assert.equal((await calls()).length, 0);
    await field("domain").selectOption("rouleur");
    await field("trainer").selectOption("coach-b"); await tick();
    assert.deepEqual(await plans(), [{ riderId: "a", intensity: 58, domain: "rouleur", trainerContractId: "coach-b" }]);

    // Returning from browser history must preserve latest local edits rather
    // than restore the server baseline or submit them automatically.
    await page.evaluate(() => {
      document.getElementById("training-trainer-a").value = "";
      document.getElementById("training-domain-a").value = "climber";
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await tick();
    assert.equal(await field("trainer").inputValue(), "coach-b", "history restores the current local coach");
    assert.equal(await field("domain").inputValue(), "rouleur", "history restores the current local focus");
    assert.equal(await field("trainer", "b").inputValue(), "", "no coach is invented for an unassigned rider");
    assert.equal(await field("domain", "b").inputValue(), "sprinter");
    assert.equal((await calls()).length, 0, "pageshow never saves");

    // Some browsers restore form properties after firing pageshow. A single
    // deferred reconciliation handles that order too, without polling.
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      document.getElementById("training-trainer-a").value = "";
      document.getElementById("training-domain-a").value = "climber";
    });
    await tick();
    assert.equal(await field("trainer").inputValue(), "coach-b", "late history restoration is reconciled on the next frame");
    assert.equal(await field("domain").inputValue(), "rouleur");
    assert.equal((await calls()).length, 0);

    await page.locator('select:not([id])').selectOption("rider"); await tick();
    assert.deepEqual(await page.locator("article[data-rider]").evaluateAll(rows => rows.map(row => row.dataset.rider)), ["b", "a"]);
    await field("trainer").scrollIntoViewIfNeeded();
    assert.equal(await field("trainer").inputValue(), "coach-b", "sort/scroll keep the right coach on its rider");
    assert.equal(await field("domain").inputValue(), "rouleur");
    await field("trainer").selectOption(""); await tick();
    assert.equal(await field("trainer").inputValue(), "", "explicit removal still works");
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
    assert.deepEqual(await plans(), [], "accepted programs are acknowledged");
    assert.deepEqual(await page.evaluate(() => window.qaErrors), [], "hydration has no recoverable mismatch");
    assert.deepEqual(pageErrors, []);
    assert.equal(networkCalls, 0);
    console.log(JSON.stringify({ offlineChromiumMobileChecks: "passed", hydrationRestoration: true, historyRestoration: true, lateHistoryRestoration: true, localEditsPreserved: true,
      fullAssignedCoach: true, noCoach: true, rosterSortAndScroll: true, explicitRemoval: true, oneBatchSave: true, networkCalls }));
  }
  await page.evaluate(() => window.qaUnmount());
  await context.close();
} finally {
  await browser.close();
}
