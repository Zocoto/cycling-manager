"use client";

import { useEffect, useRef, useState } from "react";

import type { TeamInfrastructureCode } from "@/lib/game/infrastructure";
import type { InfrastructureDistrictBuilding, CampusSponsor } from "@/lib/game/infrastructure-district";

import styles from "./infrastructure-district-map.module.css";

export type CampusAnchor = {
  code: TeamInfrastructureCode;
  x: number;
  y: number;
  width: number;
  height: number;
};

type CampusControls = {
  resize: (width: number, height: number) => void;
  setState: (selectedCode: TeamInfrastructureCode, filter: "all" | "built" | "planned") => void;
  dispose: () => void;
};

export function InfrastructureCampusCanvas({
  buildings,
  selectedCode,
  filter,
  sponsor,
  onLayout,
}: {
  buildings: readonly InfrastructureDistrictBuilding[];
  selectedCode: TeamInfrastructureCode;
  filter: "all" | "built" | "planned";
  sponsor: CampusSponsor | null;
  onLayout: (anchors: CampusAnchor[]) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<CampusControls | null>(null);
  const latestStateRef = useRef({ selectedCode, filter });
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    latestStateRef.current = { selectedCode, filter };
    controlsRef.current?.setState(selectedCode, filter);
  }, [selectedCode, filter]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let cancelled = false;
    let controls: CampusControls | null = null;
    let observer: ResizeObserver | null = null;

    function failCampus() {
      observer?.disconnect();
      controls?.dispose();
      controls = null;
      controlsRef.current = null;
      if (!cancelled) {
        onLayout([]);
        setStatus("failed");
      }
    }

    function resizeCampus() {
      if (!controls || !host) return false;
      try {
        controls.resize(host.clientWidth, host.clientHeight);
        return true;
      } catch (error) {
        console.error("[infrastructure-district] resize failed", error);
        failCampus();
        return false;
      }
    }

    function contextLost(event: Event) {
      event.preventDefault();
      if (!cancelled) setStatus("loading");
    }

    function contextRestored() {
      if (cancelled || !controls) return;
      try {
        if (!resizeCampus()) return;
        controls.setState(latestStateRef.current.selectedCode, latestStateRef.current.filter);
        setStatus("ready");
      } catch (error) {
        console.error("[infrastructure-district] context restore failed", error);
        failCampus();
      }
    }

    async function prepareCampus() {
      try {
        const { createCampusScene } = await import("./campus-scene.js");
        if (cancelled) return;
        controls = createCampusScene(canvas!, buildings, onLayout, sponsor) as CampusControls;
        controlsRef.current = controls;
        canvas!.addEventListener("webglcontextlost", contextLost);
        canvas!.addEventListener("webglcontextrestored", contextRestored);
        if (!resizeCampus()) return;
        controls.setState(latestStateRef.current.selectedCode, latestStateRef.current.filter);
        observer = new ResizeObserver(resizeCampus);
        observer.observe(host!);
        setStatus("ready");
      } catch (error) {
        console.error("[infrastructure-district] scene preparation failed", error);
        failCampus();
      }
    }

    void prepareCampus();

    return () => {
      cancelled = true;
      observer?.disconnect();
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      controls?.dispose();
      controlsRef.current = null;
    };
  }, [buildings, onLayout, sponsor]);

  return (
    <div ref={hostRef} className={styles.canvasHost}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        role="img"
        aria-label={`Quartier cycliste en volumes isométriques : ${buildings.length} infrastructures reliées par des rues et des jardins. ${sponsor ? `Habillage ${sponsor.name}, arche d’entrée au nom du sponsor et logos sur certains bâtiments construits.` : "Ambiance neutre."}`}
      />
      {status !== "ready" ? (
        <div className={styles.canvasStatus} role="status">
          {status === "loading"
            ? "Préparation du quartier…"
            : "La vue du quartier n’est pas disponible dans ce navigateur. Les bâtiments restent accessibles dans la liste."}
        </div>
      ) : null}
    </div>
  );
}
