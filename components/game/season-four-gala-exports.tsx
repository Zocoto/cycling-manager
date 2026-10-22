"use client";
import {useState} from "react";
import {GALA_EVENTS,galaClubCapacity,type GalaExportStatus} from "@/lib/game/season-four-gala";
import styles from "./season-four-gala.module.css";

export function SeasonFourGalaExports({status={counts:{}}}:{status?:GalaExportStatus}){
 const [busy,setBusy]=useState<string|null>(null);const [message,setMessage]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);
 async function download(key:string,query:string){
  if(busy)return;setBusy(key);setMessage(null);setError(null);
  try{
   const response=await fetch('/api/admin/gala-s4-export?'+query,{method:'POST',credentials:'same-origin',headers:{'X-CS-Requested-With':'gala-s4-export'}});
   if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error??'Export du gala indisponible.');}
   const filename=response.headers.get('content-disposition')?.match(/filename="([A-Za-z0-9_.-]+)"/)?.[1];
   if(!filename)throw new Error('Nom du fichier d’export invalide.');
   const url=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage(response.headers.get('x-cs-template')==='true'?'Modèle téléchargé : aucune équipe inscrite n’est incluse.':'Export téléchargé : '+filename);
  }catch(error){setError(error instanceof Error?error.message:'Export du gala indisponible.');}finally{setBusy(null);}
 }
 return <details className={styles.exports}><summary>Organisation · Exports PCM <span>6 startlists · accès privé</span><b aria-hidden="true">＋</b></summary>
  <div className={styles.exportBody}>
   <p>Une startlist par course, avec une équipe de simulation. Les modèles sont vides d’inscrits ; les SL utilisent exclusivement les compositions enregistrées, jamais les équipes de démonstration.</p>
   <div className={styles.exportActions}><button disabled={!!busy} onClick={()=>download('templates','template=1')}>{busy==='templates'?'Préparation…':'Les 6 modèles XML'}</button><button disabled={!!busy||!!status.unavailable||GALA_EVENTS.some(event=>!(status.counts[event.key]??0))} onClick={()=>download('all','')}>Les 6 startlists</button><button disabled={!!busy} onClick={()=>download('database','kind=database')}>{busy==='database'?'Construction de la base…':'Base PCM Gala S4 · 7–8 coureurs'}</button></div>
   {status.unavailable?<p role="alert">Les compteurs d’inscription sont indisponibles. Les modèles restent accessibles.</p>:null}
   <div className={styles.exportList}>{GALA_EVENTS.map(event=><article key={event.key}>
    <div><strong>{event.program==='world-tour'?'World Tour':'Continental'} · {event.course.profile}</strong><code>{event.course.startlistFilename}</code><small>{status.counts[event.key]??0} club(s) · {galaClubCapacity(event.course)} places hors simulation</small></div>
    <div><button disabled={!!busy||!!status.unavailable||!(status.counts[event.key]??0)} onClick={()=>download(event.key,'event='+encodeURIComponent(event.key))}>Exporter la SL</button><button disabled={!!busy} onClick={()=>download('model:'+event.key,'event='+encodeURIComponent(event.key)+'&template=1')}>Modèle XML</button></div>
   </article>)}</div>
   <p className={styles.exportHelp}>Les XML de montagne et vallons portent le même nom dans chaque programme. Copier un seul dossier à la fois, sans renommer les fichiers. Le ZIP contient les instructions et les variantes à sélectionner ; en montagne, choisir uniquement l’étape 18 du Tour 2022.</p>
   {error?<p role="alert" className={styles.exportError}>{error}</p>:null}{message?<p role="status" className={styles.exportSuccess}>{message}</p>:null}
  </div>
 </details>;
}
