// Offline React interaction checks. The DOM runtime is supplied explicitly;
// no dependency download, live account or translation provider is involved.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

if (!process.argv[2]) throw Error('Supply the installed happy-dom module path');
const { Window } = await import(pathToFileURL(process.argv[2]).href);
const bundle = await build({
  stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {LocaleContext} from '@/components/i18n/locale-provider';
    import {GazetteCommentTranslations, GazetteCommentText} from './components/game/gazette-comment-translations';
    const root=createRoot(document.getElementById('root'));
    const sources=[{messageId:'fr',sourceMessage:'Nous allons attaquer.',sourceEditedAt:null},
      {messageId:'en',sourceMessage:'We will attack.',sourceEditedAt:null},
      {messageId:'hidden',sourceMessage:'La réponse complète.',sourceEditedAt:null}];
    window.renderQA=(locale,enabled=true)=>root.render(<LocaleContext.Provider value={{locale}}>
      <GazetteCommentTranslations editionId="issue" sources={sources} languages={{fr:'fr',en:'en',hidden:'fr'}} enabled={enabled}>
        <GazetteCommentText commentKey="fr" text="Nous allons attaquer." />
        <GazetteCommentText commentKey="en" text="We will attack." />
        <details><GazetteCommentText commentKey="fr" text="Nous allons attaquer." />
          <GazetteCommentText commentKey="hidden" text="La réponse complète." /></details>
      </GazetteCommentTranslations></LocaleContext.Provider>);
    window.unmountQA=()=>root.unmount();`, resolveDir: process.cwd(), loader: 'tsx' },
  plugins: [{ name: 'locale-only', setup(b) {
    b.onResolve({ filter: /^@\/components\/i18n\/locale-provider$/ }, () => ({ path: 'locale', namespace: 'qa' }));
    b.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: `import {createContext,useContext} from 'react';export const LocaleContext=createContext({locale:'fr'});export const useLocale=()=>useContext(LocaleContext);`, resolveDir: process.cwd() }));
  }}],
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
});
const win = new Window({ url: 'http://localhost/' });
win.document.body.innerHTML = '<div id="root"></div>';
const observers = new Set();
win.IntersectionObserver = class {
  constructor(callback) { this.callback=callback; observers.add(this); }
  observe(target) { this.target=target; }
  disconnect() { observers.delete(this); }
};
const requests=[];
win.fetch = (_url, init) => new Promise(resolve => requests.push({ body:JSON.parse(init.body), signal:init.signal, resolve }));
win.eval(bundle.outputFiles[0].text);
const tick = ms => new Promise(resolve=>setTimeout(resolve,ms??40));
const body=()=>win.document.body.textContent;
const visible = (key, details=false) => {
  const observer=[...observers].find(o=>o.target?.dataset.gazetteComment===key && Boolean(o.target.closest('details'))===details);
  assert.ok(observer, `observer ${key} ${details}`); observer.callback([{isIntersecting:true}]);
};
const finish=(request,key,text,source)=>request.resolve({ok:true,json:async()=>({translations:[{messageId:key,status:'loaded',translation:{translatedText:text,detectedSourceLocale:source}}]})});

win.renderQA('en'); await tick();
assert.equal(requests.length,0);
assert.ok(![...observers].some(o=>o.target?.dataset.gazetteComment==='en'));
visible('fr'); await tick(730);
assert.equal(requests.length,1); assert.deepEqual(requests[0].body,{editionId:'issue',messageIds:['fr'],targetLocale:'en'});
finish(requests[0],'fr','We are going to attack.','fr'); await tick();
assert.match(body(),/We are going to attack/);
const original=[...win.document.querySelectorAll('button')].find(b=>b.textContent==='Show original');
assert.ok(original); original.click(); await tick(); assert.match(body(),/Nous allons attaquer/);
assert.match(body(),/Show translation/);
visible('fr',true); await tick(730); assert.equal(requests.length,1,'duplicate excerpt reuses loaded text');

// Switching game language must discard old target-language output immediately.
win.renderQA('fr'); await tick(); assert.doesNotMatch(body(),/We are going to attack/);
visible('en'); await tick(730);
assert.equal(requests.length,2); assert.equal(requests[1].body.targetLocale,'fr');
win.renderQA('en'); await tick(); assert.equal(requests[1].signal.aborted,true);
finish(requests[1],'en','Nous attaquerons.','en'); await tick(); assert.doesNotMatch(body(),/Nous attaquerons/);
assert.equal(requests.some(r=>r.body.messageIds.includes('hidden')),false,'closed interview never queues');

// A provider failure leaves the original readable and stops further work.
win.renderQA('fr'); await tick(); visible('en'); await tick(730);
assert.equal(requests.length,3);
requests[2].resolve({ok:false,json:async()=>({})}); await tick(2200);
assert.equal(requests.length,3); assert.match(body(),/We will attack/);
win.renderQA('en',false); await tick(); assert.equal(observers.size,0);
win.unmountQA(); await tick(); await win.happyDOM.close();
console.log(JSON.stringify({offlineReactChecks:'passed',sameLanguageSkipped:true,closedInterviewSkipped:true,duplicateReused:true,staleReplyIgnored:true,originalToggle:true,providerCalls:0}));
