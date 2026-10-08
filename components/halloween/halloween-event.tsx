"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HalloweenRunner } from "./halloween-runner";
import { HalloweenItemIllustration, HalloweenCandyScene } from "./halloween-art";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import { DemonicWheel } from "./halloween-wheel";
import { halloweenRequest } from "./halloween-client";
import { HALLOWEEN_PREVIEW_ITEMS, halloweenPresentationEffect } from "@/lib/game/halloween-catalog";
import type { HalloweenState } from "@/lib/game/halloween-event";

const curseCopy = { vampire: "Votre prochaine poursuite garde son score complet, mais 10 % de ses roues sont retenues. Le sort disparaît ensuite.", mummy: "Votre prochain cadeau sera emballé dans cinq bandelettes. Déballez-le pour tout récupérer." };
type Tab = "accueil" | "poursuite" | "bonbons" | "boutique" | "collection";
export function HalloweenEvent({ initial: state, initialTab = "accueil" }: { initial: HalloweenState; initialTab?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(["accueil", "poursuite", "bonbons", "boutique", "collection"].includes(initialTab) ? initialTab as Tab : "accueil");
  const [notice, setNotice] = useState("");
  const [busy, startTransition] = useTransition();
  const [target, setTarget] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");
  const action = (kind: string, payload: Record<string, unknown> = {}) => {
    if (busy) return;
    startTransition(async () => {
      try { const result = await halloweenRequest(kind, payload); setNotice(String(result.message ?? "Action enregistrée.")); router.refresh(); }
      catch (error) { setNotice(error instanceof Error ? error.message : "Action indisponible."); }
    });
  };
  const open = state.state === "open";
  const shopOpen = open || state.state === "shop";
  return <main className="halloween-preview halloween-public-event" data-halloween-event-state={state.state}>
    <header className="halloween-hero">
      <div><p className="halloween-eyebrow">Du 9 octobre au 2 novembre inclus · heure de Paris</p><h1>Le peloton de minuit</h1><p>Échappez à l’équipier sans tête, choisissez votre bonbon et collectionnez les trésors d’Halloween.</p><Link href="/jeu" className="halloween-text-link">← Retour au bureau du DS</Link></div>
      <div className="halloween-card"><span>Votre portefeuille</span><strong className="halloween-wallet"><DemonicWheel size={32} />{state.coins} roues démoniaques</strong><small>{state.tickets} ticket{state.tickets > 1 ? "s" : ""} bonus · aucun effet sur les finances de l’équipe</small></div>
    </header>
    <nav className="halloween-filter" aria-label="Halloween">{([["accueil", "L’événement"], ["poursuite", "Cycling Hollow"], ["bonbons", "Trick or Treat"], ["boutique", "La boutique"], ["collection", "Mes trésors"]] as const).map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {notice ? <p role="status" className="halloween-card">{notice}</p> : null}
    {!shopOpen ? <section className="halloween-card"><h2>{state.state === "scheduled" ? "La nuit s’ouvre à minuit" : state.state === "archived" ? "Les jeux sont terminés" : "Les jeux sont momentanément fermés"}</h2><p>{state.state === "scheduled" ? "Ouverture vendredi 9 octobre à 00 h, heure de Paris." : "Vos gains déjà acquis et votre collection sont conservés."}</p></section> : null}
    {state.state === "shop" ? <p className="halloween-card">Les jeux sont terminés. Vous pouvez dépenser vos dernières roues jusqu’au 9 novembre inclus. Vos objets acquis restent utilisables ensuite.</p> : null}
    {!state.joined && shopOpen ? <section className="halloween-card"><h2>Bienvenue dans la nuit</h2><p>Recevez 24 roues démoniaques de bienvenue, une seule fois sur cette édition.</p><button disabled={busy} className="halloween-button" onClick={() => action("join")}>Participer · recevoir mes 24 roues</button></section> : null}
    {state.curse ? <section className="halloween-card"><h2>{state.curse.kind === "vampire" ? "Le baiser du vampire" : "La malédiction de la momie"}</h2><p>Un sort envoyé par {state.curse.sender}. {curseCopy[state.curse.kind as keyof typeof curseCopy]} Expiration : {new Date(state.curse.expiresAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.</p><button disabled={busy} className="halloween-button" onClick={() => action("dispel")}>Sel anti-malédiction · lever gratuitement</button>
      {state.pendingGift ? <div><p>Cinq bandelettes à retirer, du dessus vers le dessous. {state.bandages}/5 retirées.</p><button disabled={busy} className="halloween-button" onClick={() => action("unwrap", { bandage: state.bandages })}>Retirer la bandelette {state.bandages + 1}</button></div> : null}
    </section> : null}
    {tab === "accueil" ? <section className="halloween-card"><p className="halloween-eyebrow">Une parenthèse hors des courses</p><h2>Des frissons, pas de fatigue.</h2><p>Les jeux Halloween ne modifient ni la forme de vos coureurs, ni les classements cyclistes. Les objets de la boutique ont les effets indiqués sur leur fiche, uniquement lorsque vous décidez de les utiliser.</p><div className="halloween-shop-grid"><article><h3>Cycling Hollow</h3><p>Un essai quotidien sur le même parcours pour tous. Votre meilleur score est conservé ; les roues de chaque essai validé sont ajoutées à votre portefeuille. Un ticket permet un second essai, au maximum un par jour.</p><button className="halloween-button" onClick={() => setTab("poursuite")}>S’élancer dans la nuit →</button></article><article><h3>Trick or Treat</h3><p>Un tirage quotidien pour 5 roues. La couleur ne change pas vos chances. Un cadeau, des roues ou un essai supplémentaire vous attendent peut-être…</p><button className="halloween-button" onClick={() => setTab("bonbons")}>Choisir un bonbon →</button></article></div><p className="halloween-secondary">Journées renouvelées à minuit à Paris. Les podiums quotidiens sont attribués après la sauvegarde des essais de fin de journée ; les lots finaux après la clôture du 2 novembre. La boutique reste ouverte une semaine supplémentaire. Les tickets non utilisés expirent à la fin des jeux ; les roues non dépensées expirent après la fermeture de la boutique.</p></section> : null}
    {tab === "poursuite" ? <HalloweenRunner state={state} onRefresh={() => router.refresh()} onNotice={setNotice} /> : null}
    {tab === "bonbons" ? <section className="halloween-card"><div className="halloween-section-heading"><div><p className="halloween-eyebrow">Une fois par jour · mise de 5 roues</p><h2>Trick or Treat</h2><p>Trois couleurs, les mêmes chances. Votre cadeau est tiré et enregistré côté serveur.</p></div><HalloweenCandyScene /></div><div className="halloween-filter">{["Orange", "Violet", "Vert"].map(color => <button key={color} disabled={busy || !open || state.drawn || state.coins < 5 || !!state.pendingGift} onClick={() => action("draw")}>{color} · 5 roues</button>)}</div><p>{state.drawn ? "Votre bonbon du jour a déjà été choisi." : "Vos chances : 50 % sans cadeau ; 30 % pour 8 roues ; 12 % pour 15 roues ; 5 % pour un consommable ; 1 % pour un cosmétique ; 1,9 % pour un ticket bonus ; 0,1 % pour l’Étoile de la sorcière."}</p><p className="halloween-secondary">Chaque objet d’une même famille a la même chance. Un cosmétique déjà possédé est remplacé par la moitié de son prix, avec un minimum de 5 roues. Après votre première Étoile de la sorcière, ce tirage rare donne 15 roues. Les reliques et le cadre exclusif du vainqueur ne figurent pas dans les tirages ordinaires.</p></section> : null}
    {tab === "boutique" || tab === "collection" ? <section><div className="halloween-section-heading"><div><p className="halloween-eyebrow">{tab === "collection" ? "Votre collection persistante" : "Roues démoniaques uniquement"}</p><h2>{tab === "collection" ? "Mes trésors" : "La boutique de minuit"}</h2></div><div className="halloween-filter">{["all", "cosmetic", "consumable", "transformation"].map(key => <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key}>{({ all: "Tout", cosmetic: "Portrait", consumable: "Objets", transformation: "Sorts" })[key]}</button>)}</div></div>
      {tab === "collection" ? <div className="halloween-card"><h3>Votre portrait Halloween</h3><div className="halloween-collection-portrait"><SportingDirectorAvatar avatarKey={state.avatarKey} size="xlarge" /></div><button disabled={busy} className="halloween-subtle-button" onClick={() => action("equip", { item: "none" })}>Retirer les accessoires Halloween</button>{(state.inventory["headless-frame-claim"] ?? 0) > 0 ? <button disabled={busy} className="halloween-button" onClick={() => action("use", { item: "headless-frame-claim" })}>Récupérer mon cadre exclusif dans l’inventaire de l’équipe</button> : null}</div> : null}
      <div className="halloween-shop-grid">{HALLOWEEN_PREVIEW_ITEMS.filter(item => (item.price !== null || tab === "collection") && item.id !== "anti-curse-salt" && (filter === "all" || item.kind === filter) && (tab !== "collection" || (state.inventory[item.id] ?? 0) > 0)).map(item => {
        const owned = state.inventory[item.id] ?? 0;
        const max = item.kind === "cosmetic" || item.relic ? 1 : item.kind === "transformation" ? 10 : 30;
        const projectItem = ["gravediggers-hourglass", "cursed-builders-seal"].includes(item.id);
        return <article key={item.id} className="halloween-card"><div className="halloween-item-art"><HalloweenItemIllustration art={item.art} name={item.name} /></div><h3>{item.name}</h3><p>{item.description}</p><details className="halloween-secondary"><summary>Effet et conditions</summary><p>{halloweenPresentationEffect(item, true)}</p>{item.bodyChange ? <p>{item.bodyChange.limit}</p> : null}{item.relic ? <p>{item.relic.limit}</p> : <p>{item.kind === "cosmetic" ? "Acquisition unique, conservée après Halloween." : `${max} achats maximum sur cette édition. Les cadeaux s’ajoutent dans la limite prévue pour l’objet.`}</p>}</details>
          <p className="halloween-item-price">{item.price !== null ? <><DemonicWheel size={20} /> {item.price} roues · </> : null}{owned} possédé{owned > 1 ? "s" : ""}</p>
          {tab === "boutique" ? <button className="halloween-button" disabled={busy || !state.joined || !shopOpen || state.coins < item.price! || (state.purchases[item.id] ?? 0) >= max || (item.kind === "cosmetic" && (state.obtained[item.id] ?? 0) > 0) || (item.id === "witches-star" && (state.obtained[item.id] ?? 0) > 0)} onClick={() => action("buy", { item: item.id })}>Acquérir</button> : item.kind === "cosmetic" ? <button className="halloween-button" disabled={busy || state.state === "paused"} onClick={() => action("equip", { item: item.id })}>Porter</button> : <>
            {item.id !== "scouts-candy" ? <label>Choisir {item.kind === "transformation" ? "un autre DS" : projectItem ? "le chantier" : "un coureur"}<select value={target[item.id] ?? ""} onChange={event => setTarget({ ...target, [item.id]: event.target.value })}><option value="">Sélectionner…</option>{(item.kind === "transformation" ? state.targets : projectItem ? (state.projects ?? []) : state.riders).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label> : null}
            <button className="halloween-button" disabled={busy || state.state === "paused" || (item.kind === "transformation" && !open) || (item.id !== "scouts-candy" && !target[item.id])} onClick={() => action(item.kind === "transformation" ? "curse" : "use", { item: item.id, ...(target[item.id] ? { target: target[item.id] } : {}) })}>{item.kind === "transformation" ? "Envoyer le sort" : "Utiliser"}</button>
          </>}
        </article>;
      })}</div>
      {tab === "collection" && !Object.values(state.inventory).some(quantity => quantity > 0) ? <p className="halloween-card">Votre collection est encore vide. Les roues de Cycling Hollow et les cadeaux vous permettront de la remplir.</p> : null}
    </section> : null}
  </main>;
}
