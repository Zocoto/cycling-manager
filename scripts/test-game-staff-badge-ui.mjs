// Isolated rendering of the actual game staff identity components. No account,
// game operation, database, notification service or network request is used.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const [modulePath, executablePath, artifactDirectory] = process.argv.slice(2);
assert(modulePath && executablePath, "Supply installed playwright-core and Chromium paths");
const { chromium } = await import(pathToFileURL(modulePath).href);
const profileSource=readFileSync(join(process.cwd(),"app/jeu/directeurs-sportifs/[identifiantPublic]/page.tsx"),"utf8");
const profileMarkup=profileSource.match(/(<div className="mt-2 flex min-w-0 flex-wrap[^>]*>[\s\S]*?<\/div>)\s*<DirectorSeasonAwardShelf/)?.[1];
assert(profileMarkup,"Locate the actual director name and badge layout");
const css = await postcss([tailwindcss()]).process(`
  @import "tailwindcss" source(none);
  @source "../scripts/test-game-staff-badge-ui.mjs";
  @source "../components/game";
  @source "../app/jeu/directeurs-sportifs";
  * { box-sizing:border-box; }
  body { margin:0; background:#EAF5F3; color:#082A2A; font-family:Arial,sans-serif; }
  main { margin:auto; max-width:1300px; padding:12px; }
  [data-qa='messages'] { display:flex;flex-direction:column;gap:16px; }
  [data-qa='online'] { display:flex;flex-direction:column;max-width:360px;height:500px; }
`, { from: join(process.cwd(), "app/game-staff-badge-harness.css") });

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx",
    contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {LocaleProvider} from '@/components/i18n/locale-provider';
      import {GameStaffBadge} from '@/components/game/game-staff-badge';
      import {GameUserMenu} from '@/components/game/game-user-menu';
      import {ChatMessage,OnlineDirectorsContent} from '@/components/game/global-game-chat';
      const root=createRoot(document.getElementById('root'));
      const longName='Sousou La Directrice Sportive Au Pseudonyme Exceptionnellement Long';
      const profile={display_name:longName,entity_id:'staff'};
      const gameStaffDirectorIds=['staff'];
      const noop=()=>{};
      const messages=[['staff','Sousou',true,false],['long',longName,true,false],
        ['self','Sousou',true,true],['player',longName,false,false]].map(([id,name,staff,self])=>({
          id,sportingDirectorId:id,authorAvatarKey:null,authorAvatarFrameKey:null,authorCountry:null,
          teamId:'team-'+id,authorDisplayName:name,teamDisplayName:'Une équipe au nom particulièrement long',
          message:'Merci pour votre aide !',preview:null,replyTo:null,reactions:[],
          createdAt:'2026-11-23T15:30:00.000Z',editedAt:null,staff,self}));
      const directors=messages.map(message=>({sportingDirectorId:message.id,username:message.id,
        displayName:message.authorDisplayName,avatarKey:null,avatarFrameKey:null,rookieBadgeExpiresAt:null,
        gameStaff:message.staff,country:null,teamId:message.teamId,teamName:message.teamDisplayName,
        teamHref:'/jeu/equipes/'+message.teamId}));
      function Harness({locale}){return <LocaleProvider initialLocale={locale} key={locale}>
        <main>
          <header className='mb-4 flex justify-end rounded-xl bg-[#071A17] p-2' data-qa='user-menu'>
            <GameUserMenu displayName={longName} viewerEmail='qa@example.test'/>
          </header>
          <section className='mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3' data-qa='samples'>
            <GameStaffBadge/><span className='inline-flex rounded-lg bg-[#071A17] p-2'><GameStaffBadge inverse/></span>
          </section>
          <section data-qa='messages'>{messages.map(message=><ChatMessage key={message.id} message={message}
            avatarKey={null} avatarFrameKey={null} authorCountry={null} rookieBadgeExpiresAt={null}
            gameStaff={message.staff} isCurrentDirector={message.self} isMentioned={false}
            currentDirectorId='self' pendingReactionKey={null} reactionsDisabled canEdit={false}
            isEditing={false} editingDraft='' editingError={null} isEditPending={false}
            translation={null} translationEnabled={false} onReply={noop} onReaction={noop}
            onFocusMessage={noop} onDirectMessage={noop} onBeginEdit={noop} onEditingDraftChange={noop}
            onCancelEdit={noop} onSubmitEdit={noop} onToggleTranslation={noop}/>)}</section>
          <section data-qa='profile' className='mt-5 rounded-2xl bg-[#071A17] p-4 text-white'>
            ${profileMarkup}
          </section>
          <section data-qa='online' className='mt-5 rounded-2xl bg-[#071A17] text-white'>
            <OnlineDirectorsContent directors={directors} currentDirectorId='self' onDirectMessage={noop}/>
          </section>
        </main></LocaleProvider>}
      window.qaActionCalls=[];
      window.qaRpcCalls=[];
      window.mountStaff=props=>root.render(<Harness {...props}/>);
    `,
  },
  plugins: [{ name: "offline-staff-boundaries", setup(builder) {
    builder.onLoad({filter:/[\\/]components[\\/]game[\\/]global-game-chat\.tsx$/},({path})=>({
      loader:"tsx",resolveDir:join(process.cwd(),"components/game"),
      contents:`${readFileSync(path,"utf8")}\nexport {ChatMessage,OnlineDirectorsContent};`,
    }));
    builder.onLoad({filter:/[\\/]components[\\/]game[\\/]game-header-indicators-provider\.tsx$/},()=>({
      loader:"tsx",contents:`export function useGameHeaderIndicators(){return {gameStaffRole:'game_staff',
        pcmExportAvailable:false,collectorAlbumAvailable:false,collectorAlbumHasUnopenedBoosters:false,
        collectorAlbumPendingTradeCount:0,christmasPreviewAvailable:false};}
        export function GameHeaderIndicatorsProvider({children}){return children;}`,
    }));
    builder.onLoad({filter:/[\\/]components[\\/]game[\\/]marketing-email-preference-control\.tsx$/},()=>({
      loader:"tsx",contents:`export function MarketingEmailPreferenceControl(){return null;}`,
    }));
    builder.onLoad({filter:/[\\/]components[\\/]pwa[\\/]push-notification-control\.tsx$/},()=>({
      loader:"tsx",contents:`export function PushNotificationControl(){return null;}`,
    }));
    builder.onLoad({filter:/[\\/]lib[\\/]supabase[\\/]client\.ts$/},()=>({
      contents:`export function createSupabaseBrowserClient(){window.qaRpcCalls.push('client');throw Error('No RPC allowed');}`,
    }));
    builder.onLoad({filter:/[\\/]app[\\/].*\.ts$/},({path})=>{
      const source=readFileSync(path,"utf8");
      if(!/^['"]use server['"]/.test(source.trimStart()))return;
      return {contents:[...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)]
        .map((match)=>`export const ${match[1]}=(...args)=>{window.qaActionCalls.push(args);throw Error('No action allowed');};`).join('\n')};
    });
    builder.onResolve({filter:/^next\/dynamic$/},()=>({path:"dynamic",namespace:"qa"}));
    builder.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"qa"}));
    builder.onResolve({filter:/^@\/components\/ui\/app-link$/},()=>({path:"link",namespace:"qa"}));
    builder.onLoad({filter:/.*/,namespace:"qa"},({path})=>({loader:"tsx",resolveDir:process.cwd(),
      contents:path==='dynamic'?`import {DocumentLocaleBridge} from '@/components/i18n/document-locale-bridge';export default function dynamic(){return DocumentLocaleBridge;}`
        :path==='navigation'?`export const useRouter=()=>({refresh(){},push(){},replace(){},prefetch(){}});export const usePathname=()=>'/jeu';`
        :`import React,{forwardRef} from 'react';export default forwardRef(function Link({href,children,prefetchOnIntent,onNavigate,showPendingIndicator,...props},ref){return <a {...props} ref={ref} href={typeof href==='string'?href:href.pathname}>{children}</a>;});`,
    }));
  }}],
  bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",
  define:{"process.env.NODE_ENV":'"production"',"process.env":"{}"},
});

const browser=await chromium.launch({executablePath,headless:true});
let checks=0;
const measurements=[];
const check=(condition,message)=>{assert(condition,message);checks++;};
const luminance=value=>{
  const channels=value.match(/[\d.]+/g).slice(0,3).map(Number).map(channel=>{
    const normalized=channel/255;
    return normalized<=0.04045?normalized/12.92:((normalized+0.055)/1.055)**2.4;
  });
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
};
const contrast=(foreground,background)=>{
  const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
  return (values[0]+0.05)/(values[1]+0.05);
};
try {
  for(const width of [320,390,1440]) for(const locale of ['fr','en']) {
    const context=await browser.newContext({viewport:{width,height:920},isMobile:width<768,hasTouch:width<768});
    let networkCalls=0;
    await context.route('**/*',route=>{networkCalls++;return route.abort();});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.setContent("<meta name='viewport' content='width=device-width,initial-scale=1'><div id='root'></div>");
    await page.addStyleTag({content:css.css});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.evaluate(value=>window.mountStaff(value),{locale});
    const badgeLabel=locale==='en'?'Game team':'Équipe du jeu';
    await page.waitForFunction(label=>document.querySelector('[data-game-staff-badge]')?.textContent.includes(label),badgeLabel);
    const badges=await page.locator('[data-game-staff-badge]').evaluateAll(elements=>elements.filter(el=>!el.closest('[hidden]')).map(el=>{
      const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
      const clipped=[];
      for(let parent=el.parentElement;parent;parent=parent.parentElement){const box=parent.getBoundingClientRect(),css=getComputedStyle(parent);
        if(['hidden','clip','auto','scroll'].includes(css.overflowX)&&(rect.left<box.left-1||rect.right>box.right+1))clipped.push(parent.tagName);}
      return {text:el.textContent.trim(),aria:el.getAttribute('aria-label'),width:rect.width,height:rect.height,
        color:style.color,background:style.backgroundColor,fontSize:style.fontSize,fontWeight:style.fontWeight,
        scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,clipped};
    }));
    check(badges.length===9,`${width}/${locale}: expected badges on samples, three chat staff, profile and three online staff`);
    for(const badge of badges){
      badge.contrast=contrast(badge.color,badge.background);
      check(badge.text===badgeLabel&&badge.aria===badgeLabel,`${width}/${locale}: translated label`);
      check(badge.height>=16&&badge.height<=26,`${width}/${locale}: compact visible badge (${badge.height})`);
      check(badge.width>60&&badge.width<160,`${width}/${locale}: readable badge width (${badge.width})`);
      check(badge.clipped.length===0,`${width}/${locale}: badge not clipped (${badge.clipped})`);
      check(badge.scrollWidth<=badge.clientWidth,`${width}/${locale}: badge text fits its own box`);
      check(badge.contrast>=4.5,`${width}/${locale}: sufficient text contrast (${badge.contrast})`);
      check(badge.fontSize==='9px'&&badge.fontWeight==='900',`${width}/${locale}: emphasized but compact type`);
    }
    const chat=page.locator('[data-qa="messages"]');
    check(await chat.locator('[data-game-staff-badge]').count()===3,`${width}/${locale}: ordinary player remains unbadged`);
    for(const id of ['staff','long','self'])check(await page.locator(`#global-chat-message-${id} a[href='/jeu/equipes/team-${id}']`).count()>=1,`${width}/${locale}: identity team link retained`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}/${locale}: no page overflow`);
    await page.locator('[data-game-user-menu] > button').click();
    const menu=page.locator('[data-game-user-menu] section[role="dialog"]');
    check(await menu.isVisible(),`${width}/${locale}: real user menu opens`);
    const menuBadge=menu.locator('[data-game-staff-badge]');
    check(await menuBadge.isVisible(),`${width}/${locale}: menu badge visible`);
    const menuGeometry=await menuBadge.evaluate(el=>{const rect=el.getBoundingClientRect(),panel=el.closest('section').getBoundingClientRect();return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,panelLeft:panel.left,panelRight:panel.right};});
    check(menuGeometry.left>=menuGeometry.panelLeft&&menuGeometry.right<=menuGeometry.panelRight,`${width}/${locale}: menu badge fits panel`);
    check(await menu.locator("a[href='/jeu/administration/equipe']").count()===0,`${width}/${locale}: visual staff status does not expose owner management`);
    if(artifactDirectory){mkdirSync(artifactDirectory,{recursive:true});await page.screenshot({path:join(artifactDirectory,`staff-menu-${width}-${locale}.png`)});}
    await page.keyboard.press('Escape');
    check(!(await menu.isVisible()),`${width}/${locale}: Escape closes menu`);
    check(await page.evaluate(()=>!window.qaActionCalls.length&&!window.qaRpcCalls.length),`${width}/${locale}: no actions or RPC`);
    check(networkCalls===0,`${width}/${locale}: no network requests (${networkCalls})`);
    check(errors.length===0,`${width}/${locale}: no browser errors (${errors})`);
    measurements.push({width,locale,badges,networkCalls});
    if(artifactDirectory)await page.screenshot({path:join(artifactDirectory,`staff-identities-${width}-${locale}.png`),fullPage:true});
    await context.close();
  }
} finally {await browser.close();}
const result={checks,measurements};
if(artifactDirectory)writeFileSync(join(artifactDirectory,'staff-badge-checks.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({checks,widths:[320,390,1440],locales:['fr','en'],networkCalls:0},null,2));
