"use client";

import Link from "@/components/ui/app-link";
import type { FC } from "react";
import { AlbumBoosterArtwork } from "./collector-album-artwork";
import styles from "./collector-album-retro.module.css";

/** The owner shortcut follows the current S4 album, without presenting pilot stock as real packs. */
export const CollectorAlbumInventoryPreview: FC<{storageOwnerId:string}> = () => {
  return <section className={styles.inventoryEntry} aria-label="Album de collection, aperçu privé"><div><AlbumBoosterArtwork sourceSeason={4} gamesEdition compact provisional additionalRiders={3} /></div><div><small>COLLECTION · APERÇU PRIVÉ</small><h2>Album de Cyclo-Stickers · Saison 4</h2><p>Les coureurs, les équipes et les champions de S4.</p><p>Parcourir la série S4 et retrouver les pages de collection.</p><Link href="/jeu/album?onglet=boosters">Ouvrir l’album de la saison 4 →</Link></div></section>;
};
