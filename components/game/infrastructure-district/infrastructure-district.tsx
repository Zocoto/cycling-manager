"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

import { useTutorial } from "@/components/tutorial/tutorial-provider";
import { TEAM_INFRASTRUCTURE_DEFINITIONS, type TeamInfrastructureCode } from "@/lib/game/infrastructure";
import type { CampusSponsor, InfrastructureDistrictBuilding } from "@/lib/game/infrastructure-district";

import { InfrastructureMiniatureCard } from "./infrastructure-miniature-card";
import styles from "./infrastructure-district.module.css";

const InfrastructureDistrictMap = dynamic(
  () => import("./infrastructure-district-map").then((module) => module.InfrastructureDistrictMap),
  { ssr: false },
);
const DISTRICT_MAP_MEDIA = "(min-width: 1024px)";
function subscribeToDesktop(onChange: () => void) {
  const media = window.matchMedia(DISTRICT_MAP_MEDIA);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const readDesktop = () => window.matchMedia(DISTRICT_MAP_MEDIA).matches;
const readServerDesktop = () => false;

type DistrictFilter = "all" | "built" | "planned";
export type InfrastructureDistrictCard = { code: TeamInfrastructureCode; content: ReactNode };

const filters: Array<{ key: DistrictFilter; label: string }> = [
  { key: "all", label: "Tout" },
  { key: "built", label: "Construits" },
  { key: "planned", label: "Projets" },
];

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function replaceBuildingHash(code: TeamInfrastructureCode | null) {
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${code ? `#batiment-${code}` : ""}`);
  window.dispatchEvent(new Event("hashchange"));
}

export function InfrastructureDistrict({
  buildings,
  sponsor,
  cards,
  detailedView = false,
}: {
  buildings: readonly InfrastructureDistrictBuilding[];
  sponsor: CampusSponsor | null;
  cards: readonly InfrastructureDistrictCard[];
  detailedView?: boolean;
}) {
  const [selectedCode, setSelectedCode] = useState<TeamInfrastructureCode>(buildings[0]?.code ?? "training_center");
  const [filter, setFilter] = useState<DistrictFilter>("all");
  const [showDetails, setShowDetails] = useState(false);
  const showMap = useSyncExternalStore(subscribeToDesktop, readDesktop, readServerDesktop);
  const { activeTutorial } = useTutorial();
  const tutorialActive = activeTutorial?.definition.key === "infrastructure";
  const isDetailed = detailedView || showDetails || tutorialActive;
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
  const modalCode = buildings.find((building) => hash === `#batiment-${building.code}`)?.code ?? null;
  const modalBuilding = buildings.find((building) => building.code === modalCode);
  const selectedCard = cards.find((card) => card.code === modalCode);
  const filteredBuildings = buildings.filter((building) => filter === "all" || (filter === "built" ? building.level > 0 : building.level === 0));

  useEffect(() => {
    if (!isDetailed || !modalCode) return;
    document.getElementById(`batiment-${modalCode}`)?.scrollIntoView({ block: "start" });
  }, [isDetailed, modalCode]);

  function openBuilding(code: TeamInfrastructureCode) {
    setSelectedCode(code);
    replaceBuildingHash(code);
  }

  return (
    <div className={styles.district} data-infrastructure-district="team">
      <div className={styles.viewToolbar}>
        <div>
          <p className={styles.eyebrow}>Le domaine de l’équipe</p>
          <h2>{showMap ? "Votre quartier, bâtiment après bâtiment" : "Vos infrastructures"}</h2>
        </div>
        <button type="button" aria-pressed={isDetailed} onClick={() => setShowDetails((value) => !value)} disabled={Boolean(detailedView || tutorialActive)}>
          {isDetailed ? showMap ? "Vue du quartier" : "Vue compacte" : "Vue détaillée"}
        </button>
      </div>

      {isDetailed ? (
        <div className={styles.detailedCards} data-building-order="starting-cost-ascending">
          {cards.map((card) => <div key={card.code}>{card.content}</div>)}
        </div>
      ) : (
        <div className={styles.workspace} data-map-visible={showMap}>
          {showMap ? (
          <section className={styles.mapPanel} aria-labelledby="infrastructure-district-title">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Le domaine de l’équipe</p>
                <h3 id="infrastructure-district-title">Quartier {sponsor?.shortName ?? "de l’équipe"}</h3>
              </div>
              <div className={styles.legend} aria-label="Légende de la carte">
                <span><i className={styles.builtDot} />Construit</span>
                <span><i className={styles.constructionDot} />En travaux</span>
                <span><i className={styles.ghostDot} />Projet</span>
              </div>
            </div>
            <InfrastructureDistrictMap buildings={buildings} selectedCode={modalCode ?? selectedCode} filter={filter} sponsor={sponsor} onSelect={setSelectedCode} onOpen={openBuilding} />
            <p className={styles.mapHint}>Sélectionnez un bâtiment ou sa miniature pour le gérer.</p>
          </section>
          ) : null}
          <aside className={styles.catalogPanel} aria-labelledby="infrastructure-catalog-title">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Gérer le domaine</p>
                <h3 id="infrastructure-catalog-title">Les infrastructures</h3>
              </div>
              <span className={styles.resultCount}>{filteredBuildings.length}</span>
            </div>
            <div className={styles.filters} aria-label="Filtrer les bâtiments">
              {filters.map((item) => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</button>)}
            </div>
            <div className={styles.buildingList} data-building-order="starting-cost-ascending">
              {filteredBuildings.map((building) => (
                <InfrastructureMiniatureCard key={building.code} definition={TEAM_INFRASTRUCTURE_DEFINITIONS[building.code]} building={building} selected={(modalCode ?? selectedCode) === building.code} onSelect={() => setSelectedCode(building.code)} onOpen={() => openBuilding(building.code)} />
              ))}
            </div>
          </aside>
        </div>
      )}
      {!isDetailed && modalBuilding && selectedCard ? (
        <BuildingDialog name={TEAM_INFRASTRUCTURE_DEFINITIONS[modalBuilding.code].name} construction={modalBuilding.construction} onClose={() => replaceBuildingHash(null)}>
          {selectedCard.content}
        </BuildingDialog>
      ) : null}
    </div>
  );
}

function BuildingDialog({ name, construction, onClose, children }: {
  name: string;
  construction: InfrastructureDistrictBuilding["construction"];
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function externalAlertIsOpen() {
      return Boolean(document.querySelector('[role="alertdialog"][aria-modal="true"]'));
    }
    function keyDown(event: KeyboardEvent) {
      if (externalAlertIsOpen()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? []).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    function focusIn(event: FocusEvent) {
      if (!externalAlertIsOpen() && event.target instanceof Node && !dialogRef.current?.contains(event.target)) closeRef.current?.focus();
    }
    document.addEventListener("keydown", keyDown);
    document.addEventListener("focusin", focusIn);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyDown);
      document.removeEventListener("focusin", focusIn);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div className={styles.dialogBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={name} className={styles.dialog} tabIndex={-1}>
        <button ref={closeRef} type="button" className={styles.dialogClose} onClick={onClose} aria-label="Fermer la fiche du bâtiment">×</button>
        {construction ? <div className={styles.constructionNotice}><strong>Chantier en cours · vers le niveau {construction.targetLevel}</strong><span>{construction.remainingDays > 0 ? `${construction.remainingDays} jours de jeu restants` : "Livraison imminente"} · saison {construction.completionGameYear}, J{construction.completionDayNumber}</span></div> : null}
        {children}
      </div>
    </div>, document.body,
  );
}
