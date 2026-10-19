"use client";

import Link from "@/components/ui/app-link";
import { useCallback, useSyncExternalStore } from "react";
import { ALBUM_PILOT_EDITION, ALBUM_PILOT_SEASON, albumPilotStorageKey, getAlbumPilotPacks, readAlbumPilotState } from "@/lib/game/collector-album";
import { AlbumBoosterArtwork } from "./collector-album-artwork";
import styles from "./collector-album-retro.module.css";

const subscribe=(callback:()=>void)=>{window.addEventListener("storage",callback);return ()=>window.removeEventListener("storage",callback);};
export function CollectorAlbumInventoryPreview({storageOwnerId}: {storageOwnerId:string}) {
  const key=albumPilotStorageKey(storageOwnerId,ALBUM_PILOT_EDITION);
  const read=useCallback(()=>{try{return window.localStorage.getItem(key);}catch{return null;}},[key]);
  const raw=useSyncExternalStore(subscribe,read,()=>null);
  const state=readAlbumPilotState(raw,ALBUM_PILOT_SEASON);
  const remaining=getAlbumPilotPacks(ALBUM_PILOT_SEASON).length-state.openedPacks.length;
  return <section className={styles.inventoryEntry} aria-label="Sachets de collection, aperçu privé"><div><AlbumBoosterArtwork season={ALBUM_PILOT_SEASON} compact /></div><div><small>COLLECTION · APERÇU PRIVÉ</small><h2>Les sachets du peloton · Saison {ALBUM_PILOT_SEASON}</h2><p>{remaining} sachet(s) d’essai fermé(s) · deux cartes par sachet. Cet aperçu ne modifie pas ton inventaire de jeu.</p><Link href={`/jeu/album?saison=${ALBUM_PILOT_SEASON}&onglet=boosters`}>{remaining ? "Voir et ouvrir dans l’album →" : "Retrouver mes cartes dans l’album →"}</Link></div></section>;
}
