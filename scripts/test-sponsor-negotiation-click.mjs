// Offline React/native-form integration. No player account or server mutation.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
if(!process.argv[2])throw Error('Supply the installed happy-dom module path');
const {Window}=await import(pathToFileURL(process.argv[2]).href);
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import React,{useState}from'react';import{createRoot}from'react-dom/client';
 import{SponsorNegotiationControl}from'./app/jeu/sponsoring/sponsor-negotiation-control';
 const root=createRoot(document.getElementById('root'));
 function App({mode}){const[saved,setSaved]=useState('balanced');window.qaSaved=setSaved;
 return <><SponsorNegotiationControl offerId="offer" contractId={mode==='continuing-contract'?'contract':undefined} negotiationMode={mode}
 sponsorName="Lima Maki" targetSeasonName="Saison 5" baseBudget={1000000} budgetCeiling={1100000} currentDifficulty={saved}
 primaryColor="#123456"textColor="#123456"backgroundColor="#ffffff"/><div data-current>{saved}</div></>}
 window.mountQA=mode=>root.render(<App key={mode} mode={mode}/>);window.unmountQA=()=>root.unmount();
 `},plugins:[{name:'offline-actions',setup(b){
 b.onResolve({filter:/^\.\/actions$/},args=>args.importer.endsWith('sponsor-negotiation-control.tsx')?{path:'actions',namespace:'qa'}:undefined);
 b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:`export const negotiateSponsorOfferAction=data=>window.qaSave('offer',data);export const negotiateContinuingSponsorObjectivesAction=data=>window.qaSave('continuing-contract',data);`}));
 }}],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const win=new Window({url:'http://localhost/jeu/sponsoring'});
win.document.body.innerHTML='<div id="root"></div>';
let confirmations=0;
win.confirm=()=>{confirmations++;throw Error('Confirmation dialog forbidden');};
win.fetch=()=>{throw Error('Network forbidden in offline QA');};
const calls=[];
win.qaSave=(mode,data)=>new Promise(resolve=>calls.push({mode,data,resolve}));
win.eval(bundle.outputFiles[0].text);
const tick=()=>new Promise(resolve=>setTimeout(resolve,50));
const buttons=()=>[...win.document.querySelectorAll('button')];
const button=value=>win.document.querySelector(`button[value="${value}"]`);
const saved=()=>win.document.querySelector('[data-current]').textContent;
const complete=async(call,success)=>{if(success)win.qaSaved(call.data.get('objectiveDifficulty'));call.resolve();await tick();};
win.mountQA('offer');await tick();
assert.equal(button('balanced').disabled,true);
button('ambitious').click();await tick();
assert.equal(calls.length,1);assert.equal(calls[0].mode,'offer');
assert.deepEqual(calls[0].data.getAll('objectiveDifficulty'),['ambitious']);
assert.equal(calls[0].data.get('offerId'),'offer');
assert.equal(button('ambitious').getAttribute('aria-checked'),'true');
assert.ok(buttons().every(b=>b.disabled));
button('accessible').click();await tick();assert.equal(calls.length,1,'pending choice blocks racing updates');
await complete(calls[0],true);
assert.equal(saved(),'ambitious');assert.equal(button('ambitious').getAttribute('aria-checked'),'true');
assert.equal(button('balanced').disabled,false);
button('balanced').click();await tick();assert.equal(calls.length,2);
await complete(calls[1],false);
assert.equal(saved(),'ambitious');assert.equal(button('ambitious').getAttribute('aria-checked'),'true','failed save retains server-confirmed choice');
win.mountQA('continuing-contract');await tick();button('accessible').click();await tick();
assert.equal(calls.length,3);assert.equal(calls[2].mode,'continuing-contract');assert.equal(calls[2].data.get('contractId'),'contract');
assert.deepEqual(calls[2].data.getAll('objectiveDifficulty'),['accessible']);await complete(calls[2],true);
assert.equal(saved(),'accessible');assert.equal(confirmations,0);
assert.equal(buttons().length,3,'no separate validation button');
win.unmountQA();await tick();await win.happyDOM.close();
console.log(JSON.stringify({offlineReactChecks:'passed',clickSavesOnce:true,correctSubmitterValue:true,pendingBlocksOtherUpdates:true,failedSaveReverts:true,continuingAndNewOffers:true,confirmationDialogs:0,networkCalls:0}));
