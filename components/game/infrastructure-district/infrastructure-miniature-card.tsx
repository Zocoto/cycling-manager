"use client";

import Image from "next/image";

import type { TeamInfrastructureDefinition } from "@/lib/game/infrastructure";
import type { InfrastructureDistrictBuilding } from "@/lib/game/infrastructure-district";

import styles from "./infrastructure-miniature-card.module.css";

export function InfrastructureMiniatureCard({
  definition,
  building,
  selected,
  onSelect,
  onOpen,
}: {
  definition: TeamInfrastructureDefinition;
  building: InfrastructureDistrictBuilding;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const maximumLevel = definition.levels.at(-1)?.level ?? 5;
  const currentLevel = Math.min(maximumLevel, Math.max(0, building.level));
  const construction = building.construction;
  const levelLabel = currentLevel ? `Niveau ${currentLevel}` : "À construire";

  return (
    <button
      type="button"
      className={styles.card}
      data-selected={selected}
      data-state={construction ? "construction" : currentLevel ? "built" : "planned"}
      data-building-code={definition.code}
      data-starting-cost={definition.levels[0]?.cost}
      aria-label={`${definition.name}, ${construction ? `travaux vers le niveau ${construction.targetLevel}` : levelLabel.toLocaleLowerCase("fr-FR")}`}
      aria-pressed={selected}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      onClick={onOpen}
    >
      <Image
        src={definition.illustration.src}
        alt=""
        fill
        sizes="(max-width: 760px) 100vw, (max-width: 1120px) 50vw, 360px"
        className={styles.image}
      />
      <span className={styles.shade} aria-hidden="true" />
      <span className={styles.content}>
        <span className={styles.zone}>{building.zone}</span>
        <strong className={styles.name}>{definition.name}</strong>
        <span className={styles.domain}>{definition.domain}</span>
        <span className={styles.progress}>
          <span className={styles.stars} aria-hidden="true">
            {"★".repeat(currentLevel)}
            <span>{"☆".repeat(maximumLevel - currentLevel)}</span>
          </span>
          <span className={styles.level}>{construction ? `Vers le niveau ${construction.targetLevel}` : levelLabel}</span>
        </span>
        {construction ? (
          <span className={styles.construction}>
            <span>En travaux</span>
            <span className={styles.countdown} title={`Livraison en saison ${construction.completionGameYear}, J${construction.completionDayNumber}`}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="8" cy="9" r="5.5" /><path d="M8 5.5V9l2 1M6 1h4M8 1v2" />
              </svg>
              {construction.remainingDays > 0 ? `${construction.remainingDays} j de jeu` : "Livraison imminente"}
            </span>
          </span>
        ) : null}
      </span>
      <span className={styles.open} aria-hidden="true">↗</span>
    </button>
  );
}
