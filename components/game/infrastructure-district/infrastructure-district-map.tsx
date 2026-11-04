"use client";

import { useCallback, useState } from "react";

import { TEAM_INFRASTRUCTURE_DEFINITIONS, type TeamInfrastructureCode } from "@/lib/game/infrastructure";
import type { InfrastructureDistrictBuilding, CampusSponsor } from "@/lib/game/infrastructure-district";

import { InfrastructureCampusCanvas, type CampusAnchor } from "./infrastructure-campus-canvas";

import styles from "./infrastructure-district-map.module.css";

export function InfrastructureDistrictMap({
  buildings,
  selectedCode,
  filter,
  sponsor,
  onSelect,
  onOpen,
}: {
  buildings: readonly InfrastructureDistrictBuilding[];
  selectedCode: TeamInfrastructureCode;
  filter: "all" | "built" | "planned";
  sponsor: CampusSponsor | null;
  onSelect: (code: TeamInfrastructureCode) => void;
  onOpen: (code: TeamInfrastructureCode) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [anchors, setAnchors] = useState<CampusAnchor[]>([]);
  const updateLayout = useCallback((next: CampusAnchor[]) => setAnchors(next), []);

  return (
    <div className={styles.mapFrame}>
      <div className={styles.viewport}>
        <div className={styles.scene} style={{ width: `${zoom * 100}%` }}>
          <InfrastructureCampusCanvas
            buildings={buildings}
            selectedCode={selectedCode}
            filter={filter}
            sponsor={sponsor}
            onLayout={updateLayout}
          />
          <div className={styles.hotspots} aria-label="Bâtiments du quartier">
            {buildings.map((building) => {
              const anchor = anchors.find((item) => item.code === building.code);
              if (!anchor) return null;
              const planned = building.level === 0;
              const construction = building.construction;
              const dimmed =
                filter !== "all" &&
                (filter === "built" ? planned : !planned);
              const definition = TEAM_INFRASTRUCTURE_DEFINITIONS[building.code];
              const maximumLevel = definition.levels.at(-1)?.level ?? 5;

              return (
                <button
                  key={building.code}
                  type="button"
                  className={styles.building}
                  style={{
                    left: `${anchor.x}%`,
                    top: `${anchor.y}%`,
                    width: `${anchor.width}%`,
                    height: `${anchor.height}%`,
                    zIndex: Math.round(anchor.y * 10),
                  }}
                  data-building-code={building.code}
                  data-building-state={construction ? "construction" : planned ? "planned" : "built"}
                  data-selected={selectedCode === building.code}
                  data-dimmed={dimmed}
                  aria-pressed={selectedCode === building.code}
                  aria-label={`${definition.name}, ${construction ? `travaux vers le niveau ${construction.targetLevel}` : planned ? "à construire" : `niveau ${building.level}`}`}
                  onMouseEnter={() => onSelect(building.code)}
                  onFocus={() => onSelect(building.code)}
                  onClick={() => onOpen(building.code)}
                >
                  <span className={styles.label}>
                    <strong>{building.shortName}</strong>
                    <span className={styles.level} aria-hidden="true">
                      <span>{"★".repeat(building.level)}</span>
                      <span className={styles.emptyStars}>
                        {"☆".repeat(Math.max(0, maximumLevel - building.level))}
                      </span>
                      <small>{construction ? `→ Niv. ${construction.targetLevel}` : planned ? "À construire" : `Niv. ${building.level}`}</small>
                    </span>
                    {construction ? (
                      <span className={styles.constructionStatus}>
                        <span>En travaux</span>
                        <span
                          className={styles.countdown}
                          title={`Livraison en saison ${construction.completionGameYear}, J${construction.completionDayNumber}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <circle cx="8" cy="9" r="5.5" />
                            <path d="M8 5.5V9l2 1M6 1h4M8 1v2M12.3 4.7l1.2-1.2" />
                          </svg>
                          <span>{construction.remainingDays > 0 ? `${construction.remainingDays} j de jeu` : "Livraison imminente"}</span>
                        </span>
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className={styles.mapTools}>
        <span>Explorer le quartier</span>
        <div className={styles.zoomButtons}>
          <button
            type="button"
            aria-label="Réduire le zoom du quartier"
            disabled={zoom <= 1}
            onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
          >−</button>
          <output aria-label="Zoom">{Math.round(zoom * 100)} %</output>
          <button
            type="button"
            aria-label="Agrandir le quartier"
            disabled={zoom >= 1.75}
            onClick={() => setZoom((value) => Math.min(1.75, value + 0.25))}
          >+</button>
        </div>
      </div>
    </div>
  );
}
