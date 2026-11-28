// Offline Chromium check of the real preparation form and profile descriptions.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const [modulePath,executablePath,artifactDirectory]=process.argv.slice(2);
assert(modulePath&&executablePath,'Supply existing playwright-core and Chromium paths');
const {chromium}=await import(pathToFileURL(modulePath).href);
const source=readFileSync(join(process.cwd(),'components/game/race-preparation-segment-labels.test.tsx'),'utf8');
const fixture=source.slice(source.indexOf('const stage:'),source.indexOf('function render('));
const edition=source.slice(source.indexOf('  const edition:'),source.indexOf('  const action ='));
assert(fixture.includes('segmentNumber: 7')&&edition.includes('attackOrders:'));
const css=await postcss([tailwindcss()]).process(`
  @import "tailwindcss" source(none);
  @source "../components/game";
  * {box-sizing:border-box;}
  body {margin:0;background:#EAF5F3;color:#183f37;font-family:Arial,sans-serif;}
  main {max-width:1180px;margin:auto;padding:12px;}
`,{from:join(process.cwd(),'app/race-segment-labels-harness.css')});
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  import React from 'react';
  import {createRoot} from 'react-dom/client';
  import {LocaleProvider} from '@/components/i18n/locale-provider';
  import {RacePreparationWorkspace} from '@/components/game/race-preparation-workspace';
  import {RaceStageProfile} from '@/components/game/race-stage-profile';
  import {DEFAULT_RACE_TEAM_STRATEGY} from '@/lib/game/race-strategy';
  ${fixture}
  const root=createRoot(document.getElementById('root'));
  function Harness({locale}){
    const mode='team';
    const overrides={};
    ${edition}
    const action=async()=>{throw Error('No game action is allowed in offline QA');};
    return <LocaleProvider initialLocale={locale}><main>
      <RacePreparationWorkspace editions={[edition]} action={action} tacticalAction={action}
        timeTrialAction={action} gameYear={5} tacticalCenterLevel={0} tacticalBriefingsByStageId={{}}
        tacticalError={false} nowIso="2026-11-28T09:00:00Z" equipmentError={false} mode={mode}/>
      <section data-qa="selectable-profile"><RaceStageProfile segments={stage.segments} onSelectSegment={()=>{}}/></section>
      <section data-qa="static-profile"><RaceStageProfile segments={stage.segments}/></section>
    </main></LocaleProvider>;
  }
  window.mount=locale=>root.render(<Harness key={locale} locale={locale}/>);
`},plugins:[{name:'offline-boundaries',setup(builder){
  builder.onLoad({filter:/[\\/]app[\\/].*\.ts$/},({path})=>{
    const source=readFileSync(path,'utf8');
    if(!/^["']use server["']/.test(source.trimStart()))return;
    return {contents:[...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)]
      .map(match=>`export const ${match[1]}=()=>{throw Error('No game action allowed in offline preparation QA');};`).join('\n')};
  });
  builder.onResolve({filter:/^next\/dynamic$/},()=>({path:'dynamic',namespace:'qa'}));
  builder.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'qa'}));
  builder.onResolve({filter:/^@\/components\/ui\/app-link$/},()=>({path:'link',namespace:'qa'}));
  builder.onLoad({filter:/.*/,namespace:'qa'},({path})=>({loader:'tsx',resolveDir:process.cwd(),contents:
    path==='dynamic'?`import {DocumentLocaleBridge} from '@/components/i18n/document-locale-bridge';export default function dynamic(){return DocumentLocaleBridge;}`
      :path==='navigation'?`export const useRouter=()=>({refresh(){},push(){},replace(){},prefetch(){}});export const usePathname=()=>'/jeu/preparation-course';`
      :`import React,{forwardRef} from 'react';export default forwardRef(function Link({href,children,prefetchOnIntent,onNavigate,showPendingIndicator,...props},ref){return <a {...props} ref={ref} href={typeof href==='string'?href:href.pathname}>{children}</a>;});`,
  }));
}}],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});

const browser=await chromium.launch({executablePath,headless:true});
let checks=0;
const measurements=[];
const check=(condition,message)=>{assert(condition,message);checks++;};
try{
  for(const width of [320,390,1440])for(const locale of ['fr','en']){
    const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<768,hasTouch:width<768});
    let requests=0;
    await context.route('**/*',route=>{requests++;return route.abort();});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>');
    await page.addStyleTag({content:css.css});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.evaluate(value=>window.mount(value),locale);
    const select=page.locator('select:has(option[value="7"])');
    await select.waitFor();
    if(locale==='en')await page.waitForFunction(()=>!document.querySelector('select:has(option[value="7"])').textContent.includes('Montée pavée'));
    const options=await select.locator('option').evaluateAll(nodes=>nodes.map(node=>({value:node.value,label:node.textContent})));
    check(options.map(item=>item.value).join(',')==='3,7,12',`${width}/${locale}: stored segment IDs and order unchanged`);
    check(await select.inputValue()==='7',`${width}/${locale}: saved attack still selects its climb`);
    check(options[1].label.includes(locale==='fr'?'Montée pavée':'Cobbled climb'),`${width}/${locale}: climb and paving visible together`);
    check(options[1].label.includes('+6 %'),`${width}/${locale}: climb gradient shown`);
    check((await select.getAttribute('title')).includes(options[1].label),`${width}/${locale}: selected segment remains available in full on hover`);
    check(options[2].label.includes(locale==='fr'?'Descente pavée':'Cobbled descent')&&options[2].label.includes('-4 %'),`${width}/${locale}: descent paving and negative gradient shown`);
    const before=JSON.parse(await page.locator('input[name="attackOrders"]').first().inputValue());
    await select.selectOption('12');
    check(JSON.parse(await page.locator('input[name="attackOrders"]').first().inputValue())[0].segmentNumber===12,`${width}/${locale}: changing selection saves original segment ID`);
    await select.selectOption('7');
    check(JSON.stringify(JSON.parse(await page.locator('input[name="attackOrders"]').first().inputValue()))===JSON.stringify(before),`${width}/${locale}: restoring saved order changes no instruction`);
    const label=await page.locator('[data-qa="selectable-profile"] button').nth(1).getAttribute('aria-label');
    check(label.includes(locale==='fr'?'Montée pavée':'Cobbled climb')&&label.includes('+6 %'),`${width}/${locale}: profile accessibility matches the form`);
    if(locale==='en')check(!/Tronçon|kilomètres/.test(label),`${width}/en: profile description is completely translated`);
    const title=await page.locator('[data-qa="static-profile"] rect > title').nth(1).textContent();
    check(title.includes(locale==='fr'?'Montée pavée':'Cobbled climb'),`${width}/${locale}: static profile tooltip preserves paving and climb`);
    const bounds=await select.evaluate(element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,pageWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth};});
    check(bounds.left>=0&&bounds.right<=width+1,`${width}/${locale}: full segment control fits viewport`);
    check(bounds.scrollWidth<=width,`${width}/${locale}: no page overflow`);
    check(errors.length===0,`${width}/${locale}: no browser error: ${errors.join(';')}`);
    check(requests===0,`${width}/${locale}: no network or database requests`);
    if(artifactDirectory){mkdirSync(artifactDirectory,{recursive:true});await page.screenshot({path:join(artifactDirectory,`segment-labels-${width}-${locale}.png`),fullPage:true});}
    measurements.push({viewportWidth:width,locale,...bounds,requests,profileLabel:label});
    await context.close();
  }
}finally{await browser.close();}
const result={checks,measurements};
if(artifactDirectory)writeFileSync(join(artifactDirectory,'segment-labels-ui-checks.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
