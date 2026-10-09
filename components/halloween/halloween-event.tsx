"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HalloweenRunnerOverview } from "./halloween-runner-overview";
import { HalloweenItemIllustration, SpiderWeb } from "./halloween-art";
import { HalloweenCandyGame, type CandyColor } from "./halloween-candy-game";
import { HalloweenSkinPortrait, HalloweenSkinPreview } from "./halloween-skin-preview";
import { HalloweenNightRide } from "./halloween-night-ride";
import { HalloweenEventHome } from "./halloween-event-home";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import { DemonicWheel } from "./halloween-wheel";
import { halloweenRequest } from "./halloween-client";
import { HALLOWEEN_PREVIEW_ITEMS, halloweenPresentationEffect, type HalloweenPreviewItem } from "@/lib/game/halloween-catalog";
import type { HalloweenState } from "@/lib/game/halloween-event";

const curseCopy = { vampire: "Votre prochaine poursuite garde son score complet, mais 10 % de ses roues sont retenues. Le sort disparaît ensuite.", mummy: "Votre prochain cadeau sera emballé dans cinq bandelettes. Déballez-le pour tout récupérer." };
type Tab = "accueil" | "classements" | "bonbons" | "boutique" | "collection";
export function HalloweenEvent({ initial: state, initialTab = "accueil" }: { initial: HalloweenState; initialTab?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(["accueil", "classements", "bonbons", "boutique", "collection"].includes(initialTab) ? initialTab as Tab : "accueil");
  const [notice, setNotice] = useState("");
  const [busy, startTransition] = useTransition();
  const [target, setTarget] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");
  const [previewItem, setPreviewItem] = useState<HalloweenPreviewItem | null>(null);
  const [chosenCandy, setChosenCandy] = useState<CandyColor | null>(null);
  const [drawResult, setDrawResult] = useState<string | null>(null);
  const actionLock = useRef(false);
  const action = (kind: string, payload: Record<string, unknown> = {}) => {
    if (actionLock.current) return;
    actionLock.current = true;
    startTransition(async () => {
      try { const result = await halloweenRequest(kind, payload); const message = String(result.message ?? "Action enregistrée."); setNotice(message); if (kind === "draw") setDrawResult(message); router.refresh(); }
      catch (error) { setNotice(error instanceof Error ? error.message : "Action indisponible."); if (kind === "draw") setChosenCandy(null); }
      finally { actionLock.current = false; }
    });
  };
  const open = state.state === "open";
  const shopOpen = open || state.state === "shop";
  const selectActivity = (activity: "poursuite" | "bonbons" | "boutique") => {
    if (activity === "poursuite") router.push("/jeu/halloween/poursuite");
    else setTab(activity);
  };
  return <main className="halloween-preview halloween-public-event" data-site-theme="halloween" data-halloween-event-state={state.state}>
    <div className="halloween-event-topline">
      <Link href="/jeu" className="halloween-text-link">← Retour au bureau du DS</Link>
      <div className="halloween-event-wallet" aria-label="Votre portefeuille Halloween"><strong><DemonicWheel size={26} />{state.coins} roues démoniaques</strong><small>{state.tickets} ticket{state.tickets > 1 ? "s" : ""} bonus · hors finances de l’équipe</small></div>
    </div>
    <header className="halloween-event-hero">
      <SpiderWeb className="halloween-event-corner-web" />
      <div className="halloween-event-hero-copy"><p className="halloween-eyebrow">Du 9 octobre au 2 novembre inclus · heure de Paris</p><h1>Événement <span>Halloween.</span></h1><p>Échappez à l’équipier sans tête, choisissez votre bonbon et collectionnez les trésors du peloton de minuit.</p></div>
      <div className="halloween-event-hero-art"><HalloweenNightRide /></div>
    </header>
    <nav className="halloween-filter" aria-label="Halloween"><Link href="/jeu/halloween/poursuite" prefetch={false} className="halloween-button">Cycling Hollow ↗</Link>{([["accueil", "L’événement"], ["classements", "Classements"], ["bonbons", "Trick or Treat"], ["boutique", "La boutique"], ["collection", "Mes trésors"]] as const).map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {notice ? <p role="status" className="halloween-card">{notice}</p> : null}
    {state.replayAvailable && open ? <p className="halloween-card" role="status">Vous avez joué avant la mise à jour : <Link href="/jeu/halloween/poursuite" prefetch={false}>un essai gratuit vous a été restitué</Link>. Vos scores et vos gains restent acquis.</p> : null}
    {!shopOpen ? <section className="halloween-card"><h2>{state.state === "scheduled" ? "La nuit s’ouvre à minuit" : state.state === "archived" ? "Les jeux sont terminés" : "Les jeux sont momentanément fermés"}</h2><p>{state.state === "scheduled" ? "Ouverture vendredi 9 octobre à 00 h, heure de Paris." : "Vos gains déjà acquis et votre collection sont conservés."}</p></section> : null}
    {state.state === "shop" ? <p className="halloween-card">Les jeux sont terminés. Vous pouvez dépenser vos dernières roues jusqu’au 9 novembre inclus. Vos objets acquis restent utilisables ensuite.</p> : null}
    {!state.joined && shopOpen ? <section className="halloween-card"><h2>Bienvenue dans la nuit</h2><p>Recevez 24 roues démoniaques de bienvenue, une seule fois sur cette édition.</p><button disabled={busy} className="halloween-button" onClick={() => action("join")}>Participer · recevoir mes 24 roues</button></section> : null}
    {state.curse ? <section className="halloween-card"><h2>{state.curse.kind === "vampire" ? "Le baiser du vampire" : "La malédiction de la momie"}</h2><p>Un sort envoyé par {state.curse.sender}. {curseCopy[state.curse.kind as keyof typeof curseCopy]} Expiration : {new Date(state.curse.expiresAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.</p><button disabled={busy} className="halloween-button" onClick={() => action("dispel")}>Sel anti-malédiction · lever gratuitement</button>
      {state.pendingGift ? <div><p>Cinq bandelettes à retirer, du dessus vers le dessous. {state.bandages}/5 retirées.</p><button disabled={busy} className="halloween-button" onClick={() => action("unwrap", { bandage: state.bandages })}>Retirer la bandelette {state.bandages + 1}</button></div> : null}
    </section> : null}
    {tab === "accueil" ? <HalloweenEventHome onSelect={selectActivity} /> : null}
    {tab === "classements" ? <HalloweenRunnerOverview state={state} /> : null}
    {tab === "bonbons" ? <HalloweenCandyGame disabled={busy || !open || !state.joined || state.drawn || state.coins < 5 || !!state.pendingGift} busy={busy} drawn={state.drawn} pendingGift={!!state.pendingGift} coins={state.coins} chosen={chosenCandy} result={drawResult} onChoose={color => { if (actionLock.current || drawResult) return; setChosenCandy(color); action("draw"); }} /> : null}
    {tab === "boutique" || tab === "collection" ? <section><div className="halloween-section-heading"><div><p className="halloween-eyebrow">{tab === "collection" ? "Votre collection persistante" : "Roues démoniaques uniquement"}</p><h2>{tab === "collection" ? "Mes trésors" : "La boutique de minuit"}</h2></div><div className="halloween-filter">{["all", "cosmetic", "consumable", "transformation"].map(key => <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key}>{({ all: "Tout", cosmetic: "Portrait", consumable: "Objets", transformation: "Sorts" })[key]}</button>)}</div></div>
      {tab === "collection" ? <div id="halloween-item-headless-frame-claim" className="halloween-card"><h3>Votre portrait Halloween</h3><div className="halloween-collection-portrait"><SportingDirectorAvatar avatarKey={state.avatarKey} size="xlarge" /></div><button disabled={busy} className="halloween-subtle-button" onClick={() => action("equip", { item: "none" })}>Retirer les accessoires Halloween</button>{(state.inventory["headless-frame-claim"] ?? 0) > 0 ? <button disabled={busy} className="halloween-button" onClick={() => action("use", { item: "headless-frame-claim" })}>Récupérer mon cadre exclusif dans l’inventaire de l’équipe</button> : null}</div> : null}
      <div className="halloween-shop-grid">{HALLOWEEN_PREVIEW_ITEMS.filter(item => (item.price !== null || tab === "collection") && item.id !== "anti-curse-salt" && (filter === "all" || item.kind === filter) && (tab !== "collection" || (state.inventory[item.id] ?? 0) > 0)).map(item => {
        const owned = state.inventory[item.id] ?? 0;
        const max = item.kind === "cosmetic" || item.relic ? 1 : item.kind === "transformation" ? 10 : 30;
        const projectItem = ["gravediggers-hourglass", "cursed-builders-seal"].includes(item.id);
        return <article key={item.id} id={`halloween-item-${item.id}`} className="halloween-card">{item.kind === "cosmetic" || item.kind === "transformation" ? <><HalloweenSkinPortrait avatarKey={state.avatarKey} item={item} /><button type="button" className="halloween-skin-try halloween-text-link" onClick={() => setPreviewItem(item)}>Essayer sur mon portrait ↗</button></> : <HalloweenItemIllustration art={item.art} name={item.name} />}<h3>{item.name}</h3><p>{item.description}</p><details className="halloween-secondary"><summary>Effet et conditions</summary><p>{halloweenPresentationEffect(item, true)}</p>{item.bodyChange ? <p>{item.bodyChange.limit}</p> : null}{item.relic ? <p>{item.relic.limit}</p> : <p>{item.kind === "cosmetic" ? "Acquisition unique, conservée après Halloween." : `${max} achats maximum sur cette édition. Les cadeaux s’ajoutent dans la limite prévue pour l’objet.`}</p>}</details>
          <p className="halloween-item-price">{item.price !== null ? <><DemonicWheel size={20} /> {item.price} roues · </> : null}{owned} possédé{owned > 1 ? "s" : ""}</p>
          {tab === "boutique" ? <button className="halloween-button" disabled={busy || !state.joined || !shopOpen || state.coins < item.price! || (state.purchases[item.id] ?? 0) >= max || (item.kind === "cosmetic" && (state.obtained[item.id] ?? 0) > 0) || (item.id === "witches-star" && (state.obtained[item.id] ?? 0) > 0)} onClick={() => action("buy", { item: item.id })}>Acquérir</button> : item.kind === "cosmetic" ? <button className="halloween-button" disabled={busy || state.state === "paused"} onClick={() => action("equip", { item: item.id })}>Porter</button> : <>
            {item.id !== "scouts-candy" ? <label>Choisir {item.kind === "transformation" ? "un autre DS" : projectItem ? "le chantier" : "un coureur"}<select value={target[item.id] ?? ""} onChange={event => setTarget({ ...target, [item.id]: event.target.value })}><option value="">Sélectionner…</option>{(item.kind === "transformation" ? state.targets : projectItem ? (state.projects ?? []) : state.riders).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label> : null}
            <button className="halloween-button" disabled={busy || state.state === "paused" || (item.kind === "transformation" && !open) || (item.id !== "scouts-candy" && !target[item.id])} onClick={() => action(item.kind === "transformation" ? "curse" : "use", { item: item.id, ...(target[item.id] ? { target: target[item.id] } : {}) })}>{item.kind === "transformation" ? "Envoyer le sort" : "Utiliser"}</button>
          </>}
        </article>;
      })}</div>
      {tab === "collection" && !Object.values(state.inventory).some(quantity => quantity > 0) ? <p className="halloween-card">Votre collection est encore vide. Les roues de Cycling Hollow et les cadeaux vous permettront de la remplir.</p> : null}
    </section> : null}
    {previewItem ? <HalloweenSkinPreview avatarKey={state.avatarKey} item={previewItem} onClose={() => setPreviewItem(null)} /> : null}
  </main>;
}
