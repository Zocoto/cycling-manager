"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import type { CollectorCard } from "@/lib/game/collector-album";
import styles from "./collector-album-paste-menu.module.css";

export function CollectorAlbumPasteMenu({ cards, ready, onPaste, onView }: {
  cards: readonly CollectorCard[];
  ready: boolean;
  onPaste: (card: CollectorCard) => void;
  onView: (card: CollectorCard) => void;
}) {
  const { locale } = useLocale();
  const en = locale === "en";
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const select = (card: CollectorCard, paste: boolean) => {
    setOpen(false);
    if (paste) onPaste(card);
    else onView(card);
  };

  return <div ref={root} className={styles.menu} data-album-paste-menu="true">
    <button
      ref={trigger}
      type="button"
      className={`${styles.trigger}${cards.length > 0 ? ` ${styles.available}` : ""}`}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={`${en ? "Stickers to paste" : "Cartes à coller"} (${cards.length})`}
      disabled={!ready}
      onClick={() => setOpen(previous => !previous)}
    >
      <svg aria-hidden="true" viewBox="0 0 20 22" fill="none"><path d="M3 1h14v15l-5 5H3z" stroke="currentColor" strokeWidth="1.7"/><path d="M12 21v-5h5M6 6h8M6 10h8" stroke="currentColor" strokeWidth="1.5"/></svg>
      {en ? "To paste" : "À coller"}
      <span className={styles.count} aria-hidden="true">{cards.length}</span>
    </button>
    {open ? <section id={panelId} className={styles.panel} aria-label={en ? "Stickers ready to paste" : "Cartes prêtes à coller"}>
      <header className={styles.heading}>
        <div><h2>{en ? "Your next stickers" : "Tes prochaines vignettes"}</h2><p>{en ? "Fill an empty slot or find its page in the album." : "Complète un emplacement ou retrouve sa page dans l’album."}</p></div>
        <button type="button" className={styles.close} aria-label={en ? "Close stickers to paste" : "Fermer les cartes à coller"} onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button>
      </header>
      {cards.length ? <ul className={styles.list}>
        {cards.map(card => <li key={card.number} className={styles.row}>
          <span className={styles.number} aria-hidden="true">{String(card.number).padStart(2, "0")}</span>
          <div className={styles.identity}><strong>{card.name}</strong><span>{card.country}</span></div>
          <div className={styles.actions}>
            <button type="button" className={styles.view} onClick={() => select(card, false)}>{en ? "View page" : "Voir la page"}</button>
            <button type="button" className={styles.paste} disabled={!ready} aria-label={`${en ? "Paste" : "Coller"} ${card.name}`} onClick={() => select(card, true)}>{en ? "Paste" : "Coller"}<span aria-hidden="true"> ↗</span></button>
          </div>
        </li>)}
      </ul> : <p className={styles.empty}>{en ? "Your album is up to date. Open boosters or trade to grow your collection." : "Ton album est à jour. Ouvre des boosters ou fais un échange pour compléter ta collection."}</p>}
    </section> : null}
  </div>;
}
