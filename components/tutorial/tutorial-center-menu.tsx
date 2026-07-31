"use client";

import Link from "@/components/ui/app-link";
import { useEffect, useId, useRef, useState } from "react";

import { useTutorial } from "@/components/tutorial/tutorial-provider";
import { ONBOARDING_TUTORIAL_KEY } from "@/lib/tutorial/onboarding";
import {
  CRITERIUM_DISCOVERY_KEY,
  CRITERIUM_DISCOVERY_RESULTS_ROUTE,
} from "@/lib/tutorial/criterium-discovery";
import { EQUIPMENT_TUTORIAL_KEY } from "@/lib/tutorial/equipment";
import { INFRASTRUCTURE_TUTORIAL_KEY } from "@/lib/tutorial/infrastructure";
import { MEDICAL_CENTER_TUTORIAL_KEY } from "@/lib/tutorial/medical-center";
import { getTutorialCenterEntryPresentation } from "@/lib/tutorial/tutorial-center";
import { ROSTER_TUTORIAL_KEY } from "@/lib/tutorial/roster";
import { TRAINING_TUTORIAL_KEY } from "@/lib/tutorial/training";
import { STAFF_TUTORIAL_KEY } from "@/lib/tutorial/staff";
import { TRANSFER_TUTORIAL_KEY } from "@/lib/tutorial/transfers";
import { YOUTH_DEVELOPMENT_TUTORIAL_KEY } from "@/lib/tutorial/youth-development";
import type { TutorialProgressRow } from "@/types/tutorial";

export function TutorialCenterMenu() {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const { activeTutorial, getTutorialProgress, isPending, startTutorial } =
    useTutorial();

  const baseProgress = getTutorialProgress(ONBOARDING_TUTORIAL_KEY);
  const criteriumProgress = getTutorialProgress(CRITERIUM_DISCOVERY_KEY);
  const medicalCenterProgress = getTutorialProgress(
    MEDICAL_CENTER_TUTORIAL_KEY,
  );
  const rosterProgress = getTutorialProgress(ROSTER_TUTORIAL_KEY);
  const trainingProgress = getTutorialProgress(TRAINING_TUTORIAL_KEY);
  const staffProgress = getTutorialProgress(STAFF_TUTORIAL_KEY);
  const transferProgress = getTutorialProgress(TRANSFER_TUTORIAL_KEY);
  const equipmentProgress = getTutorialProgress(EQUIPMENT_TUTORIAL_KEY);
  const infrastructureProgress = getTutorialProgress(
    INFRASTRUCTURE_TUTORIAL_KEY,
  );
  const youthDevelopmentProgress = getTutorialProgress(
    YOUTH_DEVELOPMENT_TUTORIAL_KEY,
  );

  const basePresentation = getTutorialCenterEntryPresentation(
    baseProgress?.status ?? null,
  );
  const criteriumPresentation = getTutorialCenterEntryPresentation(
    criteriumProgress?.status ?? null,
  );
  const medicalCenterPresentation = getTutorialCenterEntryPresentation(
    medicalCenterProgress?.status ?? null,
  );
  const rosterPresentation = getTutorialCenterEntryPresentation(
    rosterProgress?.status ?? null,
  );
  const trainingPresentation = getTutorialCenterEntryPresentation(
    trainingProgress?.status ?? null,
  );
  const staffPresentation = getTutorialCenterEntryPresentation(
    staffProgress?.status ?? null,
  );
  const transferPresentation = getTutorialCenterEntryPresentation(
    transferProgress?.status ?? null,
  );
  const equipmentPresentation = getTutorialCenterEntryPresentation(
    equipmentProgress?.status ?? null,
  );
  const infrastructurePresentation = getTutorialCenterEntryPresentation(
    infrastructureProgress?.status ?? null,
  );
  const youthDevelopmentPresentation = getTutorialCenterEntryPresentation(
    youthDevelopmentProgress?.status ?? null,
  );

  const tutorialIsActive = Boolean(activeTutorial);
  const disabled = tutorialIsActive || isPending;

  const completedTutorialCount = [
    baseProgress,
    criteriumProgress,
    medicalCenterProgress,
    rosterProgress,
    trainingProgress,
    staffProgress,
    transferProgress,
    equipmentProgress,
    infrastructureProgress,
    youthDevelopmentProgress,
  ].filter((progress) => progress?.status === "completed").length;

  useEffect(() => {
    if (!open) return;

    const mobileViewport = window.matchMedia("(max-width: 639px)");
    const previousOverflow = document.documentElement.style.overflow;

    if (mobileViewport.matches) {
      document.documentElement.style.overflow = "hidden";
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function launchBaseTutorial() {
    const started = await startTutorial({
      tutorialKey: ONBOARDING_TUTORIAL_KEY,
      launchSource: basePresentation.launchSource,
      restartFromBeginning: basePresentation.restartFromBeginning,
    });

    if (started) {
      setOpen(false);
    }
  }

  async function launchCriteriumTutorial() {
    const started = await startTutorial({
      tutorialKey: CRITERIUM_DISCOVERY_KEY,
      launchSource: criteriumPresentation.launchSource,
      restartFromBeginning: criteriumPresentation.restartFromBeginning,
    });

    if (started) {
      setOpen(false);
    }
  }

  async function launchMedicalCenterTutorial() {
    const started = await startTutorial({
      tutorialKey: MEDICAL_CENTER_TUTORIAL_KEY,
      launchSource: medicalCenterPresentation.launchSource,
      restartFromBeginning: medicalCenterPresentation.restartFromBeginning,
    });

    if (started) {
      setOpen(false);
    }
  }

  async function launchRosterTutorial() {
    const started = await startTutorial({
      tutorialKey: ROSTER_TUTORIAL_KEY,
      launchSource: rosterPresentation.launchSource,
      restartFromBeginning: rosterPresentation.restartFromBeginning,
    });

    if (started) {
      setOpen(false);
    }
  }

  async function launchTrainingTutorial() {
    const started = await startTutorial({
      tutorialKey: TRAINING_TUTORIAL_KEY,
      launchSource: trainingPresentation.launchSource,
      restartFromBeginning: trainingPresentation.restartFromBeginning,
    });

    if (started) {
      setOpen(false);
    }
  }

  async function launchStaffTutorial() {
    const started = await startTutorial({
      tutorialKey: STAFF_TUTORIAL_KEY,
      launchSource: staffPresentation.launchSource,
      restartFromBeginning: staffPresentation.restartFromBeginning,
    });

    if (started) {
      setOpen(false);
    }
  }

  async function launchTransferTutorial() {
    const started = await startTutorial({
      tutorialKey: TRANSFER_TUTORIAL_KEY,
      launchSource: transferPresentation.launchSource,
      restartFromBeginning: transferPresentation.restartFromBeginning,
    });

    if (started) {
      setOpen(false);
    }
  }

  async function launchEquipmentTutorial() {
    const started = await startTutorial({
      tutorialKey: EQUIPMENT_TUTORIAL_KEY,
      launchSource: equipmentPresentation.launchSource,
      restartFromBeginning: equipmentPresentation.restartFromBeginning,
    });

    if (started) {
      setOpen(false);
    }
  }

  async function launchInfrastructureTutorial() {
    const started = await startTutorial({
      tutorialKey: INFRASTRUCTURE_TUTORIAL_KEY,
      launchSource: infrastructurePresentation.launchSource,
      restartFromBeginning: infrastructurePresentation.restartFromBeginning,
    });

    if (started) {
      setOpen(false);
    }
  }

  async function launchYouthDevelopmentTutorial() {
    const started = await startTutorial({
      tutorialKey: YOUTH_DEVELOPMENT_TUTORIAL_KEY,
      launchSource: youthDevelopmentPresentation.launchSource,
      restartFromBeginning: youthDevelopmentPresentation.restartFromBeginning,
    });

    if (started) {
      setOpen(false);
    }
  }
  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={
          tutorialIsActive
            ? "Un didacticiel est déjà en cours"
            : open
              ? "Fermer le centre des didacticiels"
              : "Ouvrir le centre des didacticiels"
        }
        title={
          tutorialIsActive
            ? "Un didacticiel est déjà en cours"
            : "Ouvrir le centre des didacticiels"
        }
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D6DFD2]/20 bg-white/[0.035] text-[11px] font-extrabold text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:bg-white/[0.07] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className="grid h-5 w-5 place-items-center rounded-full border border-current text-[11px] font-black leading-none"
        >
          ?
        </span>
        {basePresentation.needsAttention ||
        criteriumProgress?.status === "in_progress" ||
        medicalCenterProgress?.status === "in_progress" ||
        rosterProgress?.status === "in_progress" ||
        trainingProgress?.status === "in_progress" ||
        staffProgress?.status === "in_progress" ||
        transferProgress?.status === "in_progress" ||
        equipmentProgress?.status === "in_progress" ||
        infrastructureProgress?.status === "in_progress" ||
        youthDevelopmentProgress?.status === "in_progress" ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#071A17] bg-[#F2C94C]"
          />
        ) : null}
      </button>

      {open ? (
        <button
          type="button"
          aria-label="Fermer le centre des didacticiels"
          className="fixed inset-0 z-[130] bg-[#071A17]/45 backdrop-blur-[1px] sm:hidden"
          onClick={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
        />
      ) : null}

      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${panelId}-title`}
          className="fixed inset-x-3 bottom-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[140] flex max-h-[72vh] max-h-[min(72dvh,42rem)] flex-col overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#FFFDF4] text-[#183F37] shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-[min(410px,calc(100vw-24px))]"
        >
          <header className="shrink-0 border-b border-[#315B3E]/10 bg-[#E9F5F0] px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
                  Bibliothèque de formation
                </p>
                <h2
                  id={`${panelId}-title`}
                  className="mt-1 truncate text-base font-black text-[#0B302B] sm:text-lg"
                >
                  Centre des didacticiels
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-[#176951] px-2.5 py-1 text-[9px] font-black text-white sm:text-[10px]">
                  {completedTutorialCount} / 10 didacticiels
                </span>
                <button
                  type="button"
                  aria-label="Fermer le centre des didacticiels"
                  title="Fermer"
                  onClick={() => {
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-[#315B3E]/15 bg-white/70 text-lg font-black leading-none text-[#315B3E] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
                >
                  ×
                </button>
              </div>
            </div>
            <p className="mt-2 hidden text-xs font-semibold leading-5 text-[#60756E] sm:block">
              Découvrez les fondamentaux puis vivez une course dans les mêmes
              conditions d’affichage que les épreuves officielles.
            </p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:max-h-[min(620px,calc(100vh-100px))] sm:flex-none sm:p-4">
            <p className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#789087]">
              Formation essentielle
            </p>
            <div className="mt-2 grid gap-3">
              <TutorialEntry
                title="Tutoriel de base"
                description="Bureau, profil, fondation de l’équipe, effectif, calendrier et sponsoring."
                progress={baseProgress}
                statusLabel={basePresentation.statusLabel}
                actionLabel={basePresentation.actionLabel}
                pending={isPending}
                onAction={() => {
                  void launchBaseTutorial();
                }}
              />
              {criteriumProgress?.status === "completed" ? (
                <TutorialLinkEntry
                  title="Critérium de la découverte"
                  description="Inscrivez cinq coureurs, attribuez les rôles tactiques puis suivez la course dans le véritable replay Résultats / Live."
                  progress={criteriumProgress}
                  href={CRITERIUM_DISCOVERY_RESULTS_ROUTE}
                />
              ) : (
                <TutorialEntry
                  title="Critérium de la découverte"
                  description="Inscrivez cinq coureurs, attribuez les rôles tactiques puis suivez la course dans le véritable replay Résultats / Live."
                  progress={criteriumProgress}
                  statusLabel={criteriumPresentation.statusLabel}
                  actionLabel={criteriumPresentation.actionLabel}
                  pending={isPending}
                  onAction={() => {
                    void launchCriteriumTutorial();
                  }}
                />
              )}
            </div>
            <div className="mt-4 hidden rounded-xl border border-dashed border-[#315B3E]/20 bg-[#F5F9F7] px-4 py-3 sm:block">
              <p className="text-xs font-bold leading-5 text-[#60756E]">
                Terminez les deux formations essentielles puis tous les guides
                des rubriques pour obtenir l’objectif « Finaliser le
                didacticiel ».
              </p>
            </div>
            <p className="mt-5 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#789087]">
              Guides des rubriques
            </p>
            <div className="mt-2 grid gap-3">
              <TutorialEntry
                title="Gérer son effectif"
                description="Notes, contrats, expérience, potentiel, forme, planning, historique et équipement d’un coureur."
                progress={rosterProgress}
                statusLabel={rosterPresentation.statusLabel}
                actionLabel={rosterPresentation.actionLabel}
                pending={isPending}
                onAction={() => {
                  void launchRosterTutorial();
                }}
              />
              <TutorialEntry
                title="Entraînement et reconnaissance"
                description="Seuil de forme, programmes individuels, entraîneurs, rapports de progression et préparation d’une future course."
                progress={trainingProgress}
                statusLabel={trainingPresentation.statusLabel}
                actionLabel={trainingPresentation.actionLabel}
                pending={isPending}
                onAction={() => {
                  void launchTrainingTutorial();
                }}
              />
              <TutorialEntry
                title="Maîtriser le centre de soins"
                description="Blessures, protocoles, forme, nutrition, kinés et résumé de l’équipe médicale."
                progress={medicalCenterProgress}
                statusLabel={medicalCenterPresentation.statusLabel}
                actionLabel={medicalCenterPresentation.actionLabel}
                pending={isPending}
                onAction={() => {
                  void launchMedicalCenterTutorial();
                }}
              />
              <TutorialEntry
                title="Constituer son staff"
                description="Places liées au niveau du DS, marché mondial, filtres, métiers, effets uniques et staff actif."
                progress={staffProgress}
                statusLabel={staffPresentation.statusLabel}
                actionLabel={staffPresentation.actionLabel}
                pending={isPending}
                onAction={() => {
                  void launchStaffTutorial();
                }}
              />
              <TutorialEntry
                title="Maîtriser le Bureau des transferts"
                description="Enchères quotidiennes, ventes entre DS, agents libres, scouting, budget et règles de signature."
                progress={transferProgress}
                statusLabel={transferPresentation.statusLabel}
                actionLabel={transferPresentation.actionLabel}
                pending={isPending}
                onAction={() => {
                  void launchTransferTutorial();
                }}
              />
              <TutorialEntry
                title="Maîtriser le matériel"
                description="Boutique, filtres, bonus, équipementier, inventaire et gestion individuelle des équipements."
                progress={equipmentProgress}
                statusLabel={equipmentPresentation.statusLabel}
                actionLabel={equipmentPresentation.actionLabel}
                pending={isPending}
                onAction={() => {
                  void launchEquipmentTutorial();
                }}
              />
              <TutorialEntry
                title="Développer ses infrastructures"
                description="Bâtiments disponibles, chantiers, architectes et effet partagé des écoles internationales de cyclisme."
                progress={infrastructureProgress}
                statusLabel={infrastructurePresentation.statusLabel}
                actionLabel={infrastructurePresentation.actionLabel}
                pending={isPending}
                onAction={() => {
                  void launchInfrastructureTutorial();
                }}
              />
              <TutorialEntry
                title="Former les talents de demain"
                description="Carte mondiale, mission fictive, rapports, signature, école de cyclisme et entraînement junior."
                progress={youthDevelopmentProgress}
                statusLabel={youthDevelopmentPresentation.statusLabel}
                actionLabel={youthDevelopmentPresentation.actionLabel}
                pending={isPending}
                onAction={() => {
                  void launchYouthDevelopmentTutorial();
                }}
              />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TutorialEntry({
  title,
  description,
  progress,
  statusLabel,
  actionLabel,
  pending,
  onAction,
}: {
  title: string;
  description: string;
  progress: TutorialProgressRow | null;
  statusLabel: string;
  actionLabel: string;
  pending: boolean;
  onAction: () => void;
}) {
  return (
    <article className="rounded-xl border border-[#278B70]/20 bg-white p-3 shadow-sm sm:p-4">
      <EntryHeader
        title={title}
        description={description}
        progress={progress}
        statusLabel={statusLabel}
      />
      <button
        type="button"
        disabled={pending}
        onClick={onAction}
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[#176951] px-4 text-xs font-black text-white transition hover:bg-[#278B70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55"
      >
        {pending ? "Préparation…" : actionLabel}
      </button>
    </article>
  );
}

function TutorialLinkEntry({
  title,
  description,
  progress,
  href,
}: {
  title: string;
  description: string;
  progress: TutorialProgressRow | null;
  href: string;
}) {
  const statusLabel =
    progress?.status === "completed"
      ? "Terminé"
      : progress?.status === "in_progress"
        ? "Replay prêt"
        : "À découvrir";

  const actionLabel =
    progress?.status === "completed"
      ? "Revoir le replay"
      : progress?.current_route === CRITERIUM_DISCOVERY_RESULTS_ROUTE
        ? "Ouvrir le replay"
        : "Commencer depuis le calendrier";

  return (
    <article className="rounded-xl border border-[#F2C94C]/55 bg-white p-3 shadow-sm sm:p-4">
      <EntryHeader
        title={title}
        description={description}
        progress={progress}
        statusLabel={statusLabel}
      />
      <Link
        href={href}
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-4 text-center text-xs font-black text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A67C00] focus-visible:ring-offset-2"
      >
        {actionLabel}
      </Link>
    </article>
  );
}

function EntryHeader({
  title,
  description,
  progress,
  statusLabel,
}: {
  title: string;
  description: string;
  progress: TutorialProgressRow | null;
  statusLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-black leading-5 text-[#183F37] sm:text-base">
          {title}
        </h3>
        <p className="mt-1 hidden text-xs font-semibold leading-5 text-[#60756E] sm:block">
          {description}
        </p>
      </div>
      <span
        className={[
          "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black",
          progress?.status === "completed"
            ? "bg-[#DDF3E7] text-[#176951]"
            : progress?.status === "in_progress"
              ? "bg-[#FFF4D6] text-[#765A18]"
              : "bg-[#E9F5F0] text-[#278B70]",
        ].join(" ")}
      >
        {statusLabel}
      </span>
    </div>
  );
}
