// Real sprint renderer in isolated Chromium; no session, DB, or network access.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const [modulePath, executablePath, artifactDirectory] = process.argv.slice(2);
assert(modulePath && executablePath, "Supply existing playwright-core and Chromium paths");
const { chromium } = await import(pathToFileURL(modulePath).href);
const css = await postcss([tailwindcss()]).process(`
  @import "tailwindcss" source(none);
  @source "../components/game/race-live-lab.tsx";
  @source "../components/game/race-cyclist-detailed.tsx";
  @source "../components/game/race-media-convoy.tsx";
  @source "../components/game/race-scenery.tsx";
  * { box-sizing:border-box; }
  body { margin:0; background:#142c25; color:white; font-family:Arial,sans-serif; }
  main { padding:16px; }
  .cm-race-motion-layer { transition:none !important; }
`, { from: join(process.cwd(), "app/sprint-lanes-harness.css") });

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx",
    contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {SprintLaneView} from '@/components/game/race-live-lab';
      const root = createRoot(document.getElementById('root'));
      const colors = ['#eb635e','#51b9a9','#e9c858','#9d92df','#eea56d','#6ebfe6'];
      const riders = Array.from({length:6},(_,team)=>['sprinter','leadout'].map(role=>({
        id:role+'-'+team, name:(role==='sprinter'?'Sprint':'Pilot')+' Rider'+team,
        teamId:'team-'+team, teamName:'Team '+team, role,
        teamPrimaryColor:colors[team], teamSecondaryColor:'#ffffff',
        countryCode:'BE', age:25, form:90, morale:70,
        ratings:{flat:75,mountain:45,hills:55,cobbles:60,downhill:65,sprint:role==='sprinter'?90-team:60,
          acceleration:80,timeTrial:55,prologue:60,endurance:70,resistance:75,recovery:70,breakaway:50},
      }))).flat();
      const results = [...riders].sort((a,b)=>a.role===b.role?a.id.localeCompare(b.id):a.role==='sprinter'?-1:1)
        .map((rider,index)=>({riderId:rider.id,rank:index+1,status:'finished',elapsedTimeSeconds:14000,
          gapToWinnerSeconds:0,energyAfter:60,injury:null,abandonment:null}));
      const group = {id:'peloton',type:'peloton',gapToLeaderSeconds:0,riderIds:riders.map(r=>r.id)};
      const baseSimulation = {stageId:'offline-sprint',resolvedRiders:riders,results,
        timeline:[{segmentNumber:20,groups:[group]}],primes:[],mountainPoints:{},sprintPoints:{}};
      const scenario={contenderIds:riders.map(r=>r.id),decisiveContenderIds:[],droppedRiderIds:[],
        entryLeaderIds:[],entryGroupLabel:'Peloton',entryGroups:[],lateJoiners:[]};
      const segment={segmentNumber:20,surface:'asphalt',averageGradientPct:0};
      const weather={condition:'clear',rainIntensity:'none',temperatureC:20,windSpeedKph:0,
        windDirection:'tailwind',windIntensity:'calm',isWet:false};
      window.mountSprint=({seed='sprint-ui-0',metersRemaining=3000,finishPassageProgress=0})=>{
        window.sprintFixtureFingerprint=JSON.stringify(baseSimulation);
        root.render(<main><SprintLaneView simulation={{...baseSimulation,seed}}
          riderById={new Map(riders.map(r=>[r.id,r]))} segment={segment} scenario={scenario}
          finalSegmentMeters={5000} metersRemaining={metersRemaining}
          finishPassageProgress={finishPassageProgress} weather={weather}/></main>);
      };
    `,
  },
  plugins: [{
    name: "private-sprint-component-test-export",
    setup(builder) {
      // Keep the product component private; expose it only in this test bundle.
      builder.onLoad({ filter: /[\\/]components[\\/]game[\\/]race-live-lab\.tsx$/ }, ({ path }) => ({
        loader: "tsx", resolveDir: join(process.cwd(), "components/game"),
        contents: `${readFileSync(path, "utf8")}\nexport { SprintLaneView };`,
      }));
    },
  }],
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
});

const browser = await chromium.launch({ executablePath, headless: true });
const measurements = [];
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 850 }, isMobile: width < 768 });
    let networkCalls = 0;
    await context.route("**/*", route => { networkCalls++; return route.abort(); });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setContent("<meta name='viewport' content='width=device-width, initial-scale=1'><div id='root'></div>");
    await page.addStyleTag({ content: css.css });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    check(errors.length === 0, `${width}: bundle initializes (${errors})`);
    const mount = async props => {
      await page.evaluate(value => window.mountSprint(value), props);
      await page.locator("[data-sprint-team-lane]").first().waitFor();
      await page.waitForTimeout(30);
      return page.evaluate(() => ({
        lanes: [...document.querySelectorAll('[data-sprint-team-lane]')].map(el=>el.dataset.sprintTeamLane),
        riders: [...document.querySelectorAll('[data-finish-rider-id]')].map(el=>({
          id:el.dataset.finishRiderId,rank:Number(el.dataset.finishRank),role:el.dataset.sprintRiderRole,
          transform:el.style.transform,hasSvg:!!el.querySelector('svg[role="img"]'),
        })),
        favoriteText:[...document.querySelectorAll('p')].find(el=>el.textContent.startsWith('Sprinteurs :'))?.textContent,
        fingerprint:window.sprintFixtureFingerprint,
      }));
    };
    const initial = await mount({ seed: 'sprint-ui-0', metersRemaining: 3000 });
    check(initial.lanes.length === 6, `${width}: six distinct team lanes`);
    check(new Set(initial.lanes).size === 6, `${width}: no duplicate lanes`);
    check(initial.riders.length === 12 && initial.riders.every(rider=>rider.hasSvg), `${width}: real cyclist sprites preserved`);
    check(initial.riders.filter(rider=>rider.role==='leadout').length === 6, `${width}: all leadout riders preserved`);
    for (const metersRemaining of [120, 0]) {
      const current = await mount({ seed: 'sprint-ui-0', metersRemaining });
      check(JSON.stringify(current.lanes) === JSON.stringify(initial.lanes), `${width}/${metersRemaining}: phase-stable lanes`);
      check(current.favoriteText === initial.favoriteText, `${width}/${metersRemaining}: phase-stable displayed sprinter list`);
      check(current.fingerprint === initial.fingerprint, `${width}: fixture unchanged`);
    }
    const coordinates = row => row.transform.match(/translate3d\(([-\d.]+)%, ([-\d.]+)%, 0px?\)/)?.slice(1).map(Number)
      ?? row.transform.match(/translate3d\(([-\d.]+)%, ([-\d.]+)%, 0\)/)?.slice(1).map(Number);
    for (const seconds of [0.08, 0.24, 0.40, 0.56, 0.72, 0.88]) {
      const current = await mount({ seed: 'sprint-ui-0', metersRemaining: 0, finishPassageProgress: seconds / 5 });
      const crossed = current.riders.filter(row=>row.role==='sprinter' && coordinates(row)?.[0] > 84).map(row=>row.rank).sort((a,b)=>a-b);
      const expectedCount = Math.min(6, Math.floor(seconds / 0.16)+1);
      check(JSON.stringify(crossed) === JSON.stringify(Array.from({length:expectedCount},(_,index)=>index+1)),
        `${width}/${seconds}s: official finish order preserved (${crossed})`);
    }
    const winnerLanes = new Set();
    for (let seedIndex=0;seedIndex<12;seedIndex++) {
      const current = await mount({seed:`sprint-ui-${seedIndex}`,metersRemaining:120});
      winnerLanes.add(current.lanes.indexOf('team-0'));
      check(current.favoriteText === `Sprinteurs : ${current.lanes.map(id=>'Rider'+id.slice(5)).join(' · ')}`,
        `${width}: displayed sprinters use visual rather than finish order`);
    }
    check(winnerLanes.size >= 4, `${width}: winner moves between lanes across races`);
    const replay = await mount({seed:'sprint-ui-0',metersRemaining:3000});
    check(JSON.stringify(replay.lanes) === JSON.stringify(initial.lanes), `${width}: replay keeps original lane assignment`);
    if (width < 768) {
      // The production road is wider than a phone and its RTL scroll region
      // initially follows the finish line; pan back to the approaching field.
      await page.getByRole('region').evaluate(el=>{el.scrollLeft=-280;});
    }
    const drawn = await page.evaluate(() => {
      const viewport=document.querySelector('.cm-race-visual-viewport').getBoundingClientRect();
      const region=document.querySelector('[role="region"]').getBoundingClientRect();
      const visibleLeft=Math.max(0,region.left),visibleRight=Math.min(innerWidth,region.right);
      const riders=[...document.querySelectorAll('[data-finish-rider-id]')].map(el=>{
        const rect=el.querySelector('svg[role="img"]').getBoundingClientRect();
        return {id:el.dataset.finishRiderId,x:rect.x,y:rect.y,width:rect.width,height:rect.height,
          opacity:Number(getComputedStyle(el).opacity),
          onScreen:rect.right>visibleLeft&&rect.left<visibleRight&&rect.top>=viewport.top&&rect.bottom<=viewport.bottom};
      });
      return {viewport:{width:viewport.width,height:viewport.height},riders,
        scrollWidth:document.documentElement.scrollWidth,pageWidth:innerWidth};
    });
    check(drawn.riders.every(rider=>rider.width>0&&rider.height>0&&rider.opacity>0), `${width}: every cyclist has visible drawing dimensions/opacity`);
    check(drawn.riders.filter(rider=>rider.onScreen).length===12, `${width}: all cyclists visible after following the field`);
    check(drawn.scrollWidth<=drawn.pageWidth, `${width}: horizontal scrolling confined to race region`);
    check(errors.length === 0, `${width}: no browser errors (${errors})`);
    check(networkCalls === 0, `${width}: no network requests`);
    measurements.push({width,lanes:initial.lanes,winnerLanes:[...winnerLanes],riders:initial.riders.length,networkCalls,drawn});
    if (artifactDirectory) {
      mkdirSync(artifactDirectory,{recursive:true});
      await page.screenshot({path:join(artifactDirectory,`sprint-${width}.png`),fullPage:true});
      await page.locator('.cm-race-visual-viewport').screenshot({path:join(artifactDirectory,`sprint-${width}-road.png`)});
    }
    await context.close();
  }
} finally {
  await browser.close();
}
const result={checks,measurements};
if(artifactDirectory) writeFileSync(join(artifactDirectory,'sprint-ui-checks.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
