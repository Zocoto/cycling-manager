// Offline React 19 integration: SSR, current training settings and browser restoration.
// Supply an installed playwright-core module and browser executable path.
// An isolated headless browser is used; no player account or network is used.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const browserModule = process.argv[2];
const executablePath = process.argv[3];
if (!browserModule || !executablePath) throw Error("Supply playwright-core module and browser executable paths");
const expectBug = process.argv.includes("--expect-bug");
const expectLateBug = process.argv.includes("--expect-late-bug");
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

    await page.getByLabel("Trier par").selectOption("rider"); await tick();
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
} finally {
  await browser.close();
}
