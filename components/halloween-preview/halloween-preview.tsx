"use client";

import Link from "@/components/ui/app-link";
import { useState } from "react";

import { GameHeader } from "@/components/game/game-header";
import { InventoryItemIllustration } from "@/components/game/inventory-item-illustration";
import { HALLOWEEN_PREVIEW_BOARDS, HALLOWEEN_PREVIEW_ITEMS, type HalloweenPreviewBoard, type HalloweenPreviewItem, type HalloweenPreviewKind } from "@/lib/game/halloween-preview";
import { HalloweenItemIllustration, NativeAvatarPreview, SpiderWeb } from "./halloween-art";
import { HalloweenRunner } from "./halloween-runner";
import { RUNNER_TITLE } from "@/lib/game/halloween-runner-preview";
import "@/app/jeu/mobile.css";
import "./halloween-preview.css";

const PREVIEW_BRAND = {
  name: "Cyclo Stratège", shortName: "Mon équipe", countryCode: "FR",
  logoPath: "/logo-cyclo-stratege.png",
  colors: { primary: "#D27A41", secondary: "#8A7365", accent: "#EDB378", background: "#FBF7F1", text: "#2B2622" },
};

export function HalloweenPreview({ board }: { board: HalloweenPreviewBoard }) {
  return <div className="halloween-preview" data-halloween-preview="private">
    <div className="halloween-private-strip"><span>Atelier privé · Halloween</span><span>Maquettes uniquement · aucune récompense réelle</span></div>
    <div className="halloween-header-wrap">
      <GameHeader displayName="Roger · aperçu" sponsor={PREVIEW_BRAND} maxWidth="standard" />
      <SpiderWeb className="halloween-logo-web" />
    </div>
    <main className="halloween-main">
      <div className="halloween-board-header">
        <div><p className="halloween-eyebrow">Conception · proposition 03</p><h1>Halloween, dans l’esprit du jeu.</h1></div>
        <Link href="/jeu" prefetch={false} className="halloween-back">Retour au vrai bureau ↗</Link>
      </div>
      <nav aria-label="Planches de conception Halloween" className="halloween-board-nav">
        {HALLOWEEN_PREVIEW_BOARDS.map((entry) => <Link key={entry.slug} href={`/apercus/halloween/${entry.slug}`} prefetch={false} aria-current={entry.slug === board ? "page" : undefined}>{entry.label}</Link>)}
      </nav>
      <p className="halloween-disclaimer">Données fictives. Les clics ne changent ni votre avatar, ni votre inventaire, ni les finances. Les prix et effets sont des propositions à valider.</p>
      {board === "bureau" ? <OfficeBoard /> : null}
      {board === "cycliste-sans-tete" ? <HalloweenRunner /> : null}
      {board === "boutique" ? <ShopBoard /> : null}
      {board === "mauvais-bonbons" ? <TricksBoard /> : null}
      <footer className="halloween-footer">Pages non reliées aux menus des joueurs · accès serveur réservé au compte de test · aucun événement actif</footer>
    </main>
  </div>;
}

function OfficeBoard() {
  return <section aria-label="Aperçu du bureau Halloween">
    <header className="halloween-office-heading"><div><p className="halloween-eyebrow">Bureau du Directeur Sportif</p><h2>Bonjour, Roger.</h2></div><div className="halloween-shortcuts"><span>Inventaire · 12</span><span>Objectifs · 3</span><span>Mon maillot</span></div></header>
    <Link href="/apercus/halloween/cycliste-sans-tete" prefetch={false} className="halloween-event-banner" data-preview-event-banner>
      <span className="halloween-banner-candy"><Wheel /></span>
      <span className="halloween-banner-copy"><span className="halloween-eyebrow">Événement Halloween · un essai par jour</span><strong>{RUNNER_TITLE}</strong><span>Fuyez la citrouille. Récoltez les pièces. Défiez le classement.</span></span>
      <span className="halloween-button">Entrer dans la légende <span aria-hidden="true">→</span></span>
    </Link>
    <div className="halloween-federation" data-preview-federation>
      <span role="img" aria-label="Drapeau français" className="halloween-flag"><span /><span /><span /></span>
      <div><p>Espace national</p><h3>Fédération</h3><span>Retrouvez le salon, les sélections et les projets de votre fédération.</span></div><span aria-hidden="true">→</span>
    </div>
    <section className="halloween-card halloween-assistant" data-preview-assistant><div><p className="halloween-eyebrow">Vos prochaines décisions</p><h3>Assistant du DS</h3></div><div className="halloween-assistant-links"><span>Préparer les courses <b>2</b></span><span>Répondre aux convocations <b>1</b></span><span>Suivre les entraînements <b>✓</b></span></div></section>
    <div className="halloween-office-grid">
      <section className="halloween-card"><p className="halloween-eyebrow">Directeur Sportif</p><div className="halloween-director"><NativeAvatarPreview /><div><h3>Roger Letesteur</h3><p>France · Abbaye du Lion</p><span className="halloween-tag">Votre portrait reste inchangé</span></div></div><div className="halloween-metrics"><div><span>Réputation</span><strong>3 240</strong></div><div><span>Effectif</span><strong>25 coureurs</strong></div><div><span>Division</span><strong>Élite</strong></div></div></section>
      <section className="halloween-card"><p className="halloween-eyebrow">Finances · données d’exemple</p><h3>Projection de fin de saison</h3><p className="halloween-financial-positive">+124 500 €</p><p className="halloween-secondary">Les alertes financières gardent leurs couleurs habituelles.</p><div className="halloween-metrics"><div><span>Situation saine</span><strong className="halloween-positive">Vert</strong></div><div><span>Attention</span><strong className="halloween-negative">Rouge</strong></div></div></section>
    </div>
    <div className="halloween-note"><strong>Habillage léger.</strong> Fond uni, géométrie habituelle, orange sur les accents. La toile se limite au logo ; le bouton événement reste une tuile compacte au-dessus de la fédération.</div>
  </section>;
}

function ShopBoard() {
  const [filter, setFilter] = useState<"all" | Exclude<HalloweenPreviewKind, "trick">>("all");
  const [selected, setSelected] = useState< HalloweenPreviewItem>(HALLOWEEN_PREVIEW_ITEMS[0]);
  const [avatarKey, setAvatarKey] = useState("director_m_01");
  const [selection, setSelection] = useState<string[]>([]);
  const items = HALLOWEEN_PREVIEW_ITEMS.filter((entry) => entry.kind !== "trick" && (filter === "all" || entry.kind === filter));
  return <section>
    <div className="halloween-section-heading"><div><p className="halloween-eyebrow">Boutique événement · catalogue proposé</p><h2>La Roue infernale</h2><p>Les pièces de la poursuite s’échangeront contre ces accessoires et objets. Prix à rééquilibrer après les essais.</p></div><div className="halloween-token-pill"><Wheel />24 pièces <span>Solde fictif</span></div></div>
    <div className="halloween-shop-layout">
      <div>
        <div className="halloween-filter" aria-label="Filtrer les objets">{([ ["all", "Tout"], ["cosmetic", "Cosmétiques"], ["consumable", "Consommables"] ] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
        <div className="halloween-catalog">{items.map((item) => <ItemCard key={item.id} item={item} selected={selected.id === item.id} onSelect={() => setSelected(item)} />)}</div>
      </div>
      <aside className="halloween-card halloween-dressing-room">
        <p className="halloween-eyebrow">Essayage privé · sans sauvegarde</p><h3>{selected.name}</h3>
        {selected.kind === "cosmetic" ? <>
          <div className="halloween-avatar-comparison"><figure><NativeAvatarPreview avatarKey={avatarKey} /><figcaption>Portrait actuel</figcaption></figure><figure><NativeAvatarPreview avatarKey={avatarKey} art={selected.art} /><figcaption>Avec l’accessoire</figcaption></figure></div>
          <label className="halloween-avatar-selector">Tester sur un autre portrait<select value={avatarKey} onChange={(event) => setAvatarKey(event.target.value)}><option value="director_m_01">Directeur classique</option><option value="director_m_03">Directeur moderne</option><option value="director_f_01">Directrice classique</option><option value="director_f_03">Directrice moderne</option></select></label>
        </> : <HalloweenItemIllustration art={selected.art} name={selected.name} />}
        <span className="halloween-tag">{selected.status}</span><p>{selected.effect}</p>
        <p className="halloween-price">{selected.price === null ? "Antidote gratuit proposé" : `${selected.price} pièces · prix proposé`}</p>
        <button type="button" className="halloween-button halloween-wide-button" disabled={selection.includes(selected.id)} onClick={() => setSelection((current) => [...current, selected.id])}>{selection.includes(selected.id) ? "Dans la sélection de démonstration" : "Ajouter à la sélection (démo)"}</button>
        <p className="halloween-secondary">Ce bouton ne dépense aucune pièce et ne débloque aucun objet réel. {selection.length} objet{selection.length > 1 ? "s" : ""} essayé{selection.length > 1 ? "s" : ""}.</p>
      </aside>
    </div>
    <details className="halloween-card halloween-style-comparison"><summary>Comparer avec une illustration d’inventaire actuelle</summary><div><InventoryItemIllustration name="Ration énergétique actuelle" iconKey="nutrition" /><HalloweenItemIllustration name="Jus de citrouille proposé" art="juice" /></div><p className="halloween-secondary">Même construction : dessin SVG, traits arrondis, petites ombres et silhouette de bidon. Seuls l’habillage et quelques détails changent.</p></details>
  </section>;
}

function ItemCard({ item, selected, onSelect }: { item: HalloweenPreviewItem; selected: boolean; onSelect: () => void }) {
  return <article className={`halloween-item-card ${selected ? "is-selected" : ""}`}>
    <HalloweenItemIllustration art={item.art} name={item.name} />
    <div><span className="halloween-eyebrow">{item.kind === "cosmetic" ? "Cosmétique" : item.kind === "trick" ? "Farce en réserve" : "Consommable"}</span><h3>{item.name}</h3><p>{item.description}</p><div className="halloween-item-bottom"><span>{item.price === null ? (item.kind === "trick" ? "Idée en réserve" : "Gratuit proposé") : `${item.price} pièces`}</span><button type="button" onClick={onSelect} className="halloween-subtle-button" aria-pressed={selected}>{item.kind === "cosmetic" ? "Essayer" : "Détails"}</button></div></div>
  </article>;
}

function TricksBoard() {
  const items = HALLOWEEN_PREVIEW_ITEMS.filter((entry) => entry.kind === "trick");
  const [selected, setSelected] = useState(items[0]);
  const [visible, setVisible] = useState(false);
  const isVisual = selected.art === "bell" || selected.art === "curse";
  return <section>
    <div className="halloween-section-heading"><div><p className="halloween-eyebrow">Anciennes pistes · non reliées à la poursuite</p><h2>Les farces, en réserve</h2><p>Le mini-jeu remplace les bonbons. Ces idées restent consultables, mais aucune mauvaise pioche aléatoire n’est prévue dans la poursuite.</p></div></div>
    <div className="halloween-shop-layout">
      <div className="halloween-catalog halloween-trick-catalog">{items.map((item) => <ItemCard key={item.id} item={item} selected={selected.id === item.id} onSelect={() => { setSelected(item); setVisible(false); }} />)}</div>
      <aside className="halloween-card halloween-dressing-room"><p className="halloween-eyebrow">Effet proposé</p><h3>{selected.name}</h3><div className="halloween-trick-portrait"><NativeAvatarPreview art={visible && selected.art === "curse" ? "wheel" : undefined} ghost={visible && isVisual} /></div><p>{selected.effect}</p><span className="halloween-tag">Pas vendu dans la boutique</span><button type="button" className="halloween-button halloween-wide-button" onClick={() => setVisible((current) => !current)}>{visible ? "Dissiper / jeter gratuitement (démo)" : isVisual ? "Essayer l’effet visuel" : "Ouvrir le mauvais cadeau"}</button>{visible ? <p role="status" className="halloween-negative-result">{isVisual ? "La farce apparaît uniquement sur ce portrait de démonstration." : "Mauvaise pioche : cet objet n’accorde aucun bonus supplémentaire. Il ne retire rien à l’équipe."}</p> : null}<p className="halloween-secondary">Argent, forme, moral, blessures, inscriptions et résultats ne changent jamais.</p></aside>
    </div>
    <div className="halloween-note"><strong>Grigri transmissible : garde-fous proposés.</strong> Participation volontaire aux farces, une transmission par jour, pas de transfert qui remet le compteur à zéro, pas d’empilement, pas de message automatique dans le chat et une dissipation toujours gratuite.</div>
    <div className="halloween-note"><strong>Dans la poursuite :</strong> le risque vient des obstacles et du rattrapage. Aucun malus sur l’équipe et aucune perte des pièces ramassées ne sont proposés.</div>
  </section>;
}

function Wheel() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="M12 3v7m0 4v7M3 12h7m4 0h7M6 6l5 5m2 2 5 5M6 18l5-5m2-2 5-5" /></svg>;
}
