import type { CSSProperties } from "react";
import Link from "@/components/ui/app-link";
import { cycloStickersEditionHref, type CycloStickersLibraryEntry } from "@/lib/game/cyclo-stickers-library";
import styles from "./cyclo-stickers-library.module.css";

const inks = [
  ["#294E43", "#E9D6A5"], ["#294A40", "#D8E8AD"],
  ["#3D4451", "#E7D8BD"], ["#714A35", "#F0D9AB"],
] as const;

/** The shelf reads summaries, not every album's cards or a demonstration save. */
export function CycloStickersLibrary({ editions, ownerPreview = false }: {
  editions: readonly CycloStickersLibraryEntry[];
  ownerPreview?: boolean;
}) {
  const pasted = editions.reduce((sum, edition) => sum + edition.pastedCount, 0);
  const total = editions.reduce((sum, edition) => sum + edition.totalCards, 0);
  const ordered = [...editions].sort((left, right) => left.sourceSeason - right.sourceSeason || left.editionId.localeCompare(right.editionId));
  const showPreparation = ownerPreview && !editions.some(edition => edition.sourceSeason === 5);
  return <section className={styles.library} aria-labelledby="cyclo-stickers-library-title">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Les souvenirs du peloton</p><h1 id="cyclo-stickers-library-title">Ta bibliothèque de Cyclo-Stickers</h1><p>Chaque saison a son album. Retrouve tes collections et les vignettes qu’il te reste à coller.</p></div>
      <div className={styles.summary}><strong>{editions.length}</strong><span>{editions.length === 1 ? "album disponible" : "albums disponibles"}</span><small>{pasted} / {total} vignettes collées</small></div>
    </header>
    <div className={styles.shelving}>
      <div className={styles.shelfHeading}><span>Mes collections</span><span>Choisis une tranche pour ouvrir ton album</span></div>
      <ul className={styles.books}>
        {ordered.map(edition => <Book key={edition.editionId} edition={edition} />)}
        {showPreparation ? <li className={styles.bookSlot}>
          <Link className={`${styles.spine} ${styles.preparation}`} href="/jeu/album/preparation-s5" data-album-preparation-spine="s5">
            <span className={styles.editionStamp}>SAISON <strong>5</strong></span>
            <span className={styles.spineTitle}>CYCLO-STICKERS</span>
            <span className={styles.bookEmblem} aria-hidden="true">✦</span>
            <span className={styles.preparationLabel}>En préparation<small>Maquette privée</small></span>
          </Link>
          <p className={styles.bookCaption}><strong>Souvenirs de S5</strong><span>Cartes à préparer à J28</span></p>
        </li> : null}
      </ul>
      {editions.length === 0 ? <p className={styles.empty}>Aucun album publié n’est disponible pour le moment.</p> : null}
    </div>
    <aside className={styles.notes}>
      <span aria-hidden="true">↔</span><div><h2>Les saisons se rencontrent dans les échanges.</h2><p>Un double d’une collection peut être échangé contre une vignette d’une autre saison. La saison de chaque vignette reste indiquée.</p></div>
    </aside>
    {ownerPreview ? <p className={styles.privateArchive}><Link href="/jeu/album?saison=3">Prototype privé S3 ↗</Link></p> : null}
  </section>;
}

function Book({ edition }: { edition: CycloStickersLibraryEntry }) {
  const [background, ink] = inks[edition.sourceSeason % inks.length];
  return <li className={styles.bookSlot} data-library-edition={edition.editionId} data-source-season={edition.sourceSeason}>
    <Link className={styles.spine} href={cycloStickersEditionHref(edition.editionId)} style={{ "--spine": background, "--spine-ink": ink } as CSSProperties}
      aria-label={`Ouvrir l’album S${edition.sourceSeason} · ${edition.pastedCount} sur ${edition.totalCards} vignettes collées · ${edition.completionPercent} %`}>
      <span className={styles.editionStamp}>SAISON <strong>{edition.sourceSeason}</strong></span>
      <span className={styles.spineTitle}>CYCLO-STICKERS</span>
      <span className={styles.bookEmblem} aria-hidden="true">✦</span>
      <span className={styles.completion}><strong>{edition.completionPercent}<small>%</small></strong><span>{edition.pastedCount} / {edition.totalCards}</span><progress aria-label={`Complétude de l’album S${edition.sourceSeason}`} value={edition.pastedCount} max={edition.totalCards} /></span>
    </Link>
    <p className={styles.bookCaption}><strong>Souvenirs de S{edition.sourceSeason}</strong><span>Ouvrir l’album ↗</span>
      {(edition.unopenedBoosterCount ?? 0) > 0 ? <Link className={styles.packLink} href={`${cycloStickersEditionHref(edition.editionId)}&onglet=boosters`}>Sachets à ouvrir : {edition.unopenedBoosterCount}</Link> : null}
    </p>
  </li>;
}

export function CycloStickersLibraryNavigation({ editions, selectedEditionId }: {
  editions: readonly CycloStickersLibraryEntry[]; selectedEditionId: string;
}) {
  const selected = editions.find(edition => edition.editionId === selectedEditionId);
  return <nav className={styles.navigation} aria-label="Naviguer entre les collections">
    <Link href="/jeu/album" className={styles.back}>← Ma bibliothèque</Link>
    {editions.length > 1 ? <form action="/jeu/album" method="get" className={styles.switcher}>
      <label><span>Changer de collection</span><select name="edition" defaultValue={selectedEditionId}>
        {editions.map(edition => <option key={edition.editionId} value={edition.editionId}>Album S{edition.sourceSeason}</option>)}
      </select></label><button type="submit">Ouvrir</button>
    </form> : selected ? <span className={styles.selected}>Album S{selected.sourceSeason}</span> : null}
  </nav>;
}
