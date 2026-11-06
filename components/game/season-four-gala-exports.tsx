"use client";
import {useEffect,useRef,useState} from "react";
import {GALA_EVENTS,galaClubCapacity,type GalaExportStatus} from "@/lib/game/season-four-gala";
import styles from "./season-four-gala.module.css";

export type PreparedGalaDownload = {url:string;filename:string;template:boolean;dispose:()=>void};

export async function prepareGalaDownload(response:Response):Promise<PreparedGalaDownload>{
 if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error??'Export du gala indisponible.');}
 const filename=response.headers.get('content-disposition')?.match(/filename="([A-Za-z0-9_.-]+)"/)?.[1];
 if(!filename)throw new Error('Nom du fichier d’export invalide.');
 const blob=await response.blob();
 if(!blob.size)throw new Error('Le fichier d’export est vide.');
 const url=URL.createObjectURL(blob);let disposed=false;
 return {url,filename,template:response.headers.get('x-cs-template')==='true',dispose(){if(!disposed){URL.revokeObjectURL(url);disposed=true;}}};
}

export function GalaPreparedDownloadLink({download}:{download:Pick<PreparedGalaDownload,'url'|'filename'>}){
 return <a href={download.url} download={download.filename} className={styles.exportSuccess} style={{textDecoration:"underline"}}>Télécharger le fichier préparé <span>{download.filename}</span></a>;
}

export function SeasonFourGalaExports({status={counts:{}}}:{status?:GalaExportStatus}){
 const [busy,setBusy]=useState<string|null>(null);const [message,setMessage]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);
 const [prepared,setPrepared]=useState<PreparedGalaDownload|null>(null);const preparedRef=useRef<PreparedGalaDownload|null>(null);const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;preparedRef.current?.dispose();};},[]);
 async function download(key:string,query:string){
  if(busy)return;preparedRef.current?.dispose();preparedRef.current=null;setPrepared(null);setBusy(key);setMessage(null);setError(null);
  try{
   const response=await fetch('/api/admin/gala-s4-export?'+query,{method:'POST',credentials:'same-origin',headers:{'X-CS-Requested-With':'gala-s4-export'}});
   const file=await prepareGalaDownload(response);if(!mounted.current){file.dispose();return;}preparedRef.current=file;setPrepared(file);
   const anchor=document.createElement('a');anchor.href=file.url;anchor.download=file.filename;document.body.append(anchor);
   try{anchor.click();}finally{anchor.remove();}
   setMessage(file.template?'Modèle prêt : aucune équipe inscrite n’est incluse.':'Archive prête : '+file.filename);
  }catch(error){setError(error instanceof Error?error.message:'Export du gala indisponible.');}finally{setBusy(null);}
 }
 return <details className={styles.exports}><summary>Organisation · Exports PCM <span>6 startlists · accès privé</span><b aria-hidden="true">＋</b></summary>
  <div className={styles.exportBody}>
   <p>Une startlist par course, avec une équipe de simulation. Les modèles sont vides d’inscrits ; les SL utilisent exclusivement les compositions enregistrées, jamais les équipes de démonstration.</p>
   <div className={styles.exportActions}><button disabled={!!busy} onClick={()=>download('templates','template=1')}>{busy==='templates'?'Préparation…':'Les 6 modèles XML'}</button><button disabled={!!busy||!!status.unavailable||GALA_EVENTS.some(event=>!(status.counts[event.key]??0))} onClick={()=>download('all','')}>Les 6 startlists (.zip)</button></div>
   {error?<p role="alert" className={styles.exportError}>{error}</p>:null}{message?<p role="status" className={styles.exportSuccess}>{message}</p>:null}{prepared?<p><GalaPreparedDownloadLink download={prepared}/></p>:null}
   {status.unavailable?<p role="alert">Les compteurs d’inscription sont indisponibles. Les modèles restent accessibles.</p>:null}
   <div className={styles.exportList}>{GALA_EVENTS.map(event=><article key={event.key}>
    <div><strong>{event.program==='world-tour'?'World Tour':'Continental'} · {event.course.profile}</strong><code>{event.course.startlistFilename}</code><small>{status.counts[event.key]??0} club(s) · {galaClubCapacity(event.course)} places hors simulation</small></div>
    <div><button disabled={!!busy||!!status.unavailable||!(status.counts[event.key]??0)} onClick={()=>download(event.key,'event='+encodeURIComponent(event.key))}>Exporter la SL (.zip)</button><button disabled={!!busy} onClick={()=>download('model:'+event.key,'event='+encodeURIComponent(event.key)+'&template=1')}>Modèle XML (.zip)</button></div>
   </article>)}</div>
   <p className={styles.exportHelp}><a href="https://steamcommunity.com/sharedfiles/filedetails/?id=3811779261" target="_blank" rel="noopener noreferrer" style={{color:"inherit",textDecoration:"underline"}}>Référence : BDD Steam Gala S4 v4 du 6 novembre.</a><br/>Extraire les XML et les copier directement dans <code>%APPDATA%\Pro Cycling Manager 2026\Cloud\Startlists\</code>. Un seul programme à la fois. Conserver les noms XML sans suffixe « (1) », puis revenir au menu des courses dans PCM. Hautacam : Tour 2022, étape 18 uniquement.</p>

  </div>
 </details>;
}
