// Real report components in isolated Chromium. No account, database, network,
// game operation or production fixture is used.
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
  @source "../scripts/test-training-personality-report-ui.mjs";
  @source "../components/game";
  * { box-sizing:border-box; }
  body { margin:0; background:#EAF5F3; color:#183f37; font-family:Arial,sans-serif; }
  main { max-width:1180px; margin:auto; padding:12px; }
`, { from: join(process.cwd(), "app/training-personality-report-harness.css") });

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx",
    contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {LocaleProvider} from '@/components/i18n/locale-provider';
      import {TrainingPersonalityBonusNotice} from '@/components/game/training-personality-bonus-notice';
      import {LatestTrainingReport,TrainingReportPopover} from '@/components/game/training-report-popover';
      import {DailyTrainingTextReport} from '@/components/game/daily-training-text-report';
      import {YouthTrainingReports} from '@/components/game/academy-rider-card';
      import {buildTrainingBonusBreakdown} from '@/lib/game/training-bonus-breakdown';
      import {getTrainingPersonalityBonus} from '@/lib/game/training-personality-bonus';
      import {trainingLimitLatestFixture,trainingLimitSeasonFixture} from '@/test/fixtures/training-progress-limits';
      const root=createRoot(document.getElementById('root'));
      const recorded=getTrainingPersonalityBonus({recordedPercentage:5,currentPersonalityKey:'fidele'});
      const current=getTrainingPersonalityBonus({recordedPercentage:null,currentPersonalityKey:'assidu'});
      const absent=getTrainingPersonalityBonus({recordedPercentage:0,currentPersonalityKey:'assidu'});
      const skipped=getTrainingPersonalityBonus({recordedPercentage:5,currentPersonalityKey:'assidu',completed:false});
      const bonusFor=kind=>({recorded,current,absent,skipped})[kind];
      const reportFor=kind=>({...trainingLimitLatestFixture,dayNumber:8,status:kind==='skipped'?'skipped_injury':'completed',
        progressMilli:kind==='skipped'?{}:{mountain:105},declineMilli:{},ratingChanges:{},personalityBonus:bonusFor(kind),
        bonusBreakdownByStat:{mountain:buildTrainingBonusBreakdown({ratingKey:'mountain',trainerLevel:3,
          trainerSpecialty:'mountain',trainerCountryMatch:false,personalityBonusPercentage:kind==='recorded'?5:0})}});
      const statChanges=[{statCode:'mountain',shortLabel:'MON',label:'Montagne',value:.105}];
      const dailyRiders=['recorded','current','absent','skipped'].map((kind,index)=>({
        riderId:kind,firstName:['Jean','Léa','Marc','Paul'][index],lastName:'Rapport',sessionCount:1,
        status:kind==='skipped'?'skipped_injury':'completed',trainingModes:[],statChanges:kind==='skipped'?[]:statChanges,
        formBefore:90,formDelta:kind==='skipped'?0:-10,formAfter:kind==='skipped'?90:80,personalityBonus:bonusFor(kind)}));
      const daily={audience:'senior',teamName:'Équipe du test',seasonName:'Saison 6',dayNumber:8,currentDayNumber:9,
        calendarDate:'2026-11-27',riders:dailyRiders,sessionCount:4,completedRiderCount:3,progressedRiderCount:3,totalPositiveChange:.315};
      const juniorFor=kind=>({dayNumber:8,trainingMode:'manual',slot:'manual_am',score:900,
        ratingChanges:{mountain:.105,hills:.02},personalityBonus:bonusFor(kind)});
      const juniorSeason={ratingChanges:{mountain:.315,hills:.06},sessionCount:3,automaticSessionCount:1,
        manualSessionCount:2,fromDayNumber:1,toDayNumber:8};
      function Harness({locale='fr'}){return <LocaleProvider initialLocale={locale} key={locale}><main>
        <section className='mb-4 rounded-2xl bg-white p-3' data-qa='notices'>
          <div data-qa='notice-recorded'><TrainingPersonalityBonusNotice bonus={recorded}/></div>
          <div className='mt-2' data-qa='notice-current'><TrainingPersonalityBonusNotice bonus={current}/></div>
          <div data-qa='notice-absent'><TrainingPersonalityBonusNotice bonus={absent}/></div>
          <div data-qa='notice-skipped'><TrainingPersonalityBonusNotice bonus={skipped}/></div>
          <div className='mt-2' data-qa='notice-partial'><TrainingPersonalityBonusNotice bonus={{...recorded,sessionCount:1,totalSessionCount:2}}/></div>
        </section>
        <div data-qa='daily'><DailyTrainingTextReport report={daily} baseHref='/jeu/entrainement/rapport'
          sectionHref='/jeu/entrainement' sectionLabel='Entraînements'/></div>
        <div className='mt-5 grid gap-4 lg:grid-cols-2'>
          {['recorded','current','absent','skipped'].map(kind=><section key={kind} data-qa={'latest-'+kind}
            className='min-w-0 rounded-2xl bg-[#071A17] p-4 text-white'>
            <LatestTrainingReport report={reportFor(kind)} seasonReport={trainingLimitSeasonFixture}/></section>)}
        </div>
        <div className='mt-5' data-qa='popover'><TrainingReportPopover report={reportFor('recorded')} seasonReport={trainingLimitSeasonFixture}/></div>
        <div className='mt-5 grid gap-4 lg:grid-cols-2'>
          {['recorded','current','absent'].map(kind=><div data-qa={'junior-'+kind} key={kind} className='min-w-0'>
            <YouthTrainingReports latestReport={juniorFor(kind)} seasonReport={juniorSeason}/></div>)}
        </div>
      </main></LocaleProvider>}
      window.mountTrainingReports=props=>root.render(<Harness {...props}/>);
    `,
  },
  plugins: [{name:"isolated-report-boundaries",setup(builder){
    builder.onLoad({filter:/[\\/]components[\\/]game[\\/]academy-rider-card\.tsx$/},({path})=>({
      loader:"tsx",resolveDir:join(process.cwd(),"components/game"),
      contents:readFileSync(path,"utf8")+'\nexport {YouthTrainingReports};',
    }));
    builder.onLoad({filter:/[\\/]app[\\/].*\.ts$/},({path})=>{
      const source=readFileSync(path,"utf8");
      if(!/^["']use server["']/.test(source.trimStart()))return;
      return {contents:[...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)]
        .map(match=>`export const ${match[1]}=()=>{throw Error('No game action allowed in isolated report QA');};`).join('\n')};
    });
    builder.onResolve({filter:/^next\/dynamic$/},()=>({path:"dynamic",namespace:"qa"}));
    builder.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"qa"}));
    builder.onResolve({filter:/^@\/components\/ui\/app-link$/},()=>({path:"link",namespace:"qa"}));
    builder.onLoad({filter:/.*/,namespace:"qa"},({path})=>({loader:"tsx",resolveDir:process.cwd(),
      contents:path==='dynamic'?`import {DocumentLocaleBridge} from '@/components/i18n/document-locale-bridge';export default function dynamic(){return DocumentLocaleBridge;}`
        :path==='navigation'?`export const useRouter=()=>({refresh(){},push(){},replace(){},prefetch(){}});export const usePathname=()=>'/jeu/entrainement';`
        :`import React,{forwardRef} from 'react';export default forwardRef(function Link({href,children,prefetchOnIntent,onNavigate,showPendingIndicator,...props},ref){return <a {...props} ref={ref} href={typeof href==='string'?href:href.pathname}>{children}</a>;});`,
    }));
  }}],
  bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",
  define:{"process.env.NODE_ENV":'"production"'},
});

const browser=await chromium.launch({executablePath,headless:true});
const measurements=[];
let checks=0;
const check=(condition,message)=>{assert(condition,message);checks++;};
try {
  for(const width of [320,390,1440])for(const locale of ['fr','en']){
    const context=await browser.newContext({viewport:{width,height:950},isMobile:width<768,hasTouch:width<768});
    let networkCalls=0;
    await context.route('**/*',route=>{networkCalls++;return route.abort();});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.setContent("<meta name='viewport' content='width=device-width,initial-scale=1'><div id='root'></div>");
    await page.addStyleTag({content:css.css});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.evaluate(value=>window.mountTrainingReports({locale:value}),locale);
    await page.locator('[data-qa="notice-recorded"]').waitFor();
    if(locale==='en')await page.waitForFunction(()=>!document.querySelector('[data-qa="notice-current"]').textContent.includes('Caractère'));
    const notice=section=>page.locator(`[data-qa="${section}"] [data-training-personality-bonus]`);
    for(const section of ['notice-recorded','latest-recorded','junior-recorded']){
      check(await notice(section).count()===1,`${width}/${locale}: recorded source shown once in ${section}`);
      check(await notice(section).getAttribute('data-training-personality-bonus')==='session',`${section}: source is recorded session`);
      check(/5\s*%/.test(await notice(section).innerText()),`${section}: five-percent effect remains visible`);
    }
    for(const section of ['notice-current','latest-current','junior-current']){
      check(await notice(section).count()===1,`${width}/${locale}: current source shown once in ${section}`);
      check(await notice(section).getAttribute('data-training-personality-bonus')==='current',`${section}: does not claim a historical snapshot`);
      check((await notice(section).innerText()).toLowerCase().includes(locale==='fr'?'actuel':'current'),`${section}: current personality explicitly labelled`);
    }
    for(const section of ['notice-absent','notice-skipped','latest-absent','latest-skipped','junior-absent'])
      check(await notice(section).count()===0,`${width}/${locale}: no misleading bonus in ${section}`);
    check(await page.locator('[data-qa="daily"] [data-training-personality-bonus="session"]').count()===1,`${width}/${locale}: daily recorded source`);
    check(await page.locator('[data-qa="daily"] [data-training-personality-bonus="current"]').count()===1,`${width}/${locale}: daily current source`);
    for(const kind of ['recorded','current']){
      const section=page.locator(`[data-qa="latest-${kind}"]`);
      const summaries=section.locator('details[data-layout="inline"] > summary');
      check(await summaries.count()===1,`${kind}: one retained stat bonus detail`);
      const summaryText=await summaries.innerText();
      check(summaryText.includes(kind==='recorded'?'17,6':'12'),`${kind}: global total includes only recorded personality multiplier`);
      await summaries.click();
      const details=await section.locator('details[data-layout="inline"]').innerText();
      const occurrences=(details.match(new RegExp(locale==='fr'?'Assidu':'Diligent','g'))??[]).length;
      check(occurrences===(kind==='recorded'?1:0),`${kind}: stat detail contains Assidu exactly when applied`);
      check((await section.innerText()).includes('+0,105'),`${kind}: saved progression is never recomputed`);
    }
    const popover=page.locator('[data-qa="popover"]');
    check(await popover.locator('[data-training-personality-bonus]').count()===0,`${width}/${locale}: lazy report stays unmounted when closed`);
    await popover.locator('summary').first().click();
    check(await popover.locator('[data-training-personality-bonus="session"]').count()===1,`${width}/${locale}: opening actual report loads recorded badge`);
    await popover.locator('summary').first().click();
    const bounds=await page.evaluate(()=>({
      pageWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      notices:[...document.querySelectorAll('[data-training-personality-bonus]')].filter(el=>el.getBoundingClientRect().height>0)
        .map(el=>{const rect=el.getBoundingClientRect();return {left:rect.left,right:rect.right,width:rect.width,height:rect.height,text:el.textContent,title:el.title};}),
    }));
    check(bounds.scrollWidth<=width,`${width}/${locale}: no document overflow`);
    for(const bound of bounds.notices){
      check(bound.left>=-1 && bound.right<=width+1,`${width}/${locale}: complete notice fits inside viewport`);
      if(locale==='en')check(!/Caractère|Assidu|actuel|plafonds|arrondis/.test(bound.text+' '+bound.title),`${width}/en: notice and native explanation translated`);
    }
    check(errors.length===0,`${width}/${locale}: no browser errors (${errors})`);
    check(networkCalls===0,`${width}/${locale}: no network requests`);
    measurements.push({width,locale,networkCalls,noticeCount:bounds.notices.length,scrollWidth:bounds.scrollWidth});
    if(artifactDirectory){mkdirSync(artifactDirectory,{recursive:true});await page.screenshot({path:join(artifactDirectory,`training-personality-${width}-${locale}.png`),fullPage:true});}
    await context.close();
  }
}finally{await browser.close();}
const result={checks,measurements};
if(artifactDirectory)writeFileSync(join(artifactDirectory,'training-personality-ui-checks.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
