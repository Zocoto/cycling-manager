"use client";

import { useState } from "react";
import Link from "@/components/ui/app-link";
import { CYCLO_STICKERS_S5_PREPARATION, SEASON_FIVE_ALBUM_PAGES, SEASON_FIVE_ALBUM_SLOTS,
  type SeasonFiveAlbumSection } from "@/lib/game/cyclo-stickers-s5-preparation";
import { CollectorAlbumCover } from "./collector-album-cover";
import { CycloStickersSeasonFiveArtwork } from "./cyclo-stickers-season-five-artwork";
import styles from "./cyclo-stickers-season-five-preparation.module.css";
import book from "./collector-album-book.module.css";

const seasonFiveCoverSkin = {
  coverClassName: styles.cover, spineClassName: styles.spine, headingClassName: styles.coverTheme,
  editionClassName: styles.edition, actionsClassName: styles.coverActions,
  heading: "CYCL’O QUIZZ · LA SAISON CUMBRE",
  artwork: <CycloStickersSeasonFiveArtwork className={`${book.coverArt} ${styles.art}`} />,
  poem: <>Des sommets dans les jambes.<br />Des réponses dans la tête.</>,
};

/** Read-only editorial mockup. No album inventory, storage or mutation is used. */
export function CycloStickersSeasonFivePreparation({ ownerName = "Zocoto", initialPage }: {
  ownerName?: string; initialPage?: number;
}) {
  const [bookOpen, setBookOpen] = useState(initialPage !== undefined);
  const [page, setPage] = useState(Math.max(0, Math.min(SEASON_FIVE_ALBUM_PAGES.length - 1, Math.floor(initialPage ?? 0))));
  const current = SEASON_FIVE_ALBUM_PAGES[page];
  const plan = CYCLO_STICKERS_S5_PREPARATION;
  return <section className={styles.page} data-album-preparation="s5" data-source-season={plan.sourceSeason} data-collection-season={plan.collectionSeason}>
    <header className={styles.masthead}>
      <div><p className={styles.eyebrow}>Maquette privée · S5 à collectionner en S6</p><h1>Album de Cyclo-Stickers</h1></div>
      <Link href="/jeu/album">Mon album actuel ↗</Link>
    </header>
    <aside className={styles.notice}>
      <p><strong>L’habillage est prêt, les cartes restent à écrire.</strong></p>
      <p>Les coureurs, les équipes et les champions seront renseignés à J28. Les cases restent vides : aucun classement ni titre n’est figé dans cette maquette.</p>
    </aside>
    {!bookOpen ? <div className={styles.overview}>
      <div><CollectorAlbumCover season={plan.sourceSeason} count={0} total={SEASON_FIVE_ALBUM_SLOTS.length} skin={seasonFiveCoverSkin} ownerName={ownerName} onOpen={() => setBookOpen(true)} /></div>
      <div className={styles.notes}>
        <p className={styles.eyebrow}>La saison Cumbre</p>
        <h2>Du sommet au quiz.</h2>
        <p>Les trois couleurs des grands tours traversent la couverture. La montagne raconte l’empreinte de Cumbre ; la fiche de quiz garde le souvenir du Cycl’o Quizz.</p>
        <dl><div><dt>Saison racontée</dt><dd>S5</dd></div><div><dt>Collection prévue</dt><dd>S6</dd></div><div><dt>Emplacements</dt><dd>{SEASON_FIVE_ALBUM_SLOTS.length}</dd></div><div><dt>Cartes créées</dt><dd>0</dd></div></dl>
        <div className={styles.packPreview}>
          <div className={styles.pack} role="img" aria-label="Maquette du sachet S5, sans carte ni booster disponible">
            <div className={styles.packEdge} /><div className={styles.packBody}><span>CYCLO STRATÈGE · ÉDITION S5</span><strong>ALBUM DE<br />CYCLO-STICKERS</strong><CycloStickersSeasonFiveArtwork /><small>CYCL’O QUIZZ · LA SAISON CUMBRE</small></div><div className={styles.packEdge} />
          </div>
          <p><strong>Le même souvenir, du sachet à l’album.</strong><br />Aperçu graphique uniquement.</p>
        </div>
      </div>
    </div> : <div className={styles.reader}>
      <header className={styles.readerHeader}>
        <div><p className={styles.eyebrow}>Saison 5 · Emplacements réservés</p><h2>{current.section.label}</h2><p>{current.section.description}</p></div>
        <button type="button" className={styles.button} onClick={() => setBookOpen(false)}>Fermer l’album</button>
      </header>
      <nav className={styles.pageNav} aria-label="Feuilleter la préparation de l’album">
        <button type="button" className={styles.button} aria-label="Page précédente" disabled={page === 0} onClick={() => setPage(value => value - 1)}>←</button>
        <label className={styles.pagePicker}><span><span>Aller à une page</span><strong>{page + 1} / {SEASON_FIVE_ALBUM_PAGES.length}</strong></span>
          <select value={page} onChange={event => setPage(Number(event.target.value))}>
            {SEASON_FIVE_ALBUM_PAGES.map((entry, index) => <option key={index} value={index}>{index + 1} · {entry.section.label}{entry.sectionPages > 1 ? ` · ${entry.sectionPage}/${entry.sectionPages}` : ""}</option>)}
          </select>
        </label>
        <button type="button" className={styles.button} aria-label="Page suivante" disabled={page === SEASON_FIVE_ALBUM_PAGES.length - 1} onClick={() => setPage(value => value + 1)}>→</button>
      </nav>
      <div className={styles.grid} aria-live="polite">
        {current.slots.map(slot => <article key={slot.key} className={styles.slot} data-prepared-slot={slot.number} data-section={slot.section}>
          <span>{String(slot.number).padStart(2, "0")} / {SEASON_FIVE_ALBUM_SLOTS.length}</span>
          <SlotArtwork section={slot.section} quiz={slot.key === "memory-cyclo-quizz"} />
          <strong>{slot.label}</strong><small>{slot.section === "memories" ? "Visuel à composer · J28" : "Vignette à attribuer · J28"}</small>
        </article>)}
      </div>
      <footer className={styles.readerFoot}><span>Aucune carte créée. Aucun effet sur les collections des joueurs.</span><span>Les profils des coureurs seront répartis à J28.</span></footer>
    </div>}
  </section>;
}

function SlotArtwork({ section, quiz }: { section: SeasonFiveAlbumSection; quiz: boolean }) {
  return <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    {section === "teams" ? <path d="m31 16-21 17 14 18 10-6v40h32V45l10 6 14-18-21-17-12 8H43Z" />
      : section === "continental" || section === "world" ? <><circle cx="50" cy="49" r="31" /><ellipse cx="50" cy="49" rx="16" ry="31" /><path d="M20 39h60M20 59h60M50 18v62M24 85h52" /></>
      : section === "memories" ? quiz ? <><path d="M22 12h56v76H22Z" /><circle cx="50" cy="39" r="15" /><path d="M45 35c0-8 13-8 13 0 0 5-8 5-8 11m0 6h.1M34 66h32M34 73h32" /></> : <><path d="m10 72 25-42 13 22 14-34 28 54Z" /><path d="m28 42 7-12 8 13m11-4 8-21 11 24M20 83h60M34 86v6m16-6v6m16-6v6" /></>
      : <><circle cx="27" cy="65" r="19" /><circle cx="76" cy="65" r="19" /><path d="m27 65 17-33 13 33H27l24-22h17l8 22M45 31h-9M65 29h8l-5 14M18 88h64" /></>}
  </svg>;
}
