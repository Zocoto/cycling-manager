"use client";

import Link from "@/components/ui/app-link";
import { useEffect, useId, useRef, useState } from "react";

import { useTutorial } from "@/components/tutorial/tutorial-provider";
import { ONBOARDING_TUTORIAL_KEY } from "@/lib/tutorial/onboarding";
import {
  CRITERIUM_DISCOVERY_KEY,
  CRITERIUM_DISCOVERY_RESULTS_ROUTE,
} from "@/lib/tutorial/criterium-discovery";
import { getTutorialCenterEntryPresentation } from "@/lib/tutorial/tutorial-center";
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

  const basePresentation = getTutorialCenterEntryPresentation(
    baseProgress?.status ?? null,
  );
  const criteriumPresentation = getTutorialCenterEntryPresentation(
    criteriumProgress?.status ?? null,
  );

  const tutorialIsActive = Boolean(activeTutorial);
  const disabled = tutorialIsActive || isPending;

  const completedEssentialCount = [baseProgress, criteriumProgress].filter(
    (progress) => progress?.status === "completed",
  ).length;

  useEffect(() => {
    if (!open) return;

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

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={
          tutorialIsActive
            ? "Un didacticiel est déjà en cours"
            : "Ouvrir le centre des didacticiels"
        }
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="relative inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#D6DFD2]/20 bg-white/[0.035] px-2.5 text-[11px] font-extrabold text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:bg-white/[0.07] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className="grid h-5 w-5 place-items-center rounded-full border border-current text-[11px] font-black leading-none"
        >
          ?
        </span>
        <span className="sm:hidden">Tutos</span>
        <span className="hidden sm:inline">Didacticiels</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className={[
            "h-3.5 w-3.5 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
        {basePresentation.needsAttention ||
        criteriumProgress?.status === "in_progress" ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#071A17] bg-[#F2C94C]"
          />
        ) : null}
      </button>

      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${panelId}-title`}
          className="absolute right-0 top-full z-[140] mt-2 w-[min(410px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#FFFDF4] text-[#183F37] shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
        >
          <header className="border-b border-[#315B3E]/10 bg-[#E9F5F0] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
                  Bibliothèque de formation
                </p>
                <h2
                  id={`${panelId}-title`}
                  className="mt-1 text-lg font-black text-[#0B302B]"
                >
                  Centre des didacticiels
                </h2>
              </div>
              <span className="rounded-full bg-[#176951] px-2.5 py-1 text-[10px] font-black text-white">
                {completedEssentialCount} / 2 essentiels
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
              Découvrez les fondamentaux puis vivez une course dans les mêmes
              conditions d’affichage que les épreuves officielles.
            </p>
          </header>

          <div className="max-h-[min(620px,calc(100vh-100px))] overflow-y-auto p-4">
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

            <div className="mt-4 rounded-xl border border-dashed border-[#315B3E]/20 bg-[#F5F9F7] px-4 py-3">
              <p className="text-xs font-bold leading-5 text-[#60756E]">
                Terminez les deux formations essentielles pour rendre disponible
                l’objectif « Finaliser le didacticiel ».
              </p>
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
    <article className="rounded-xl border border-[#278B70]/20 bg-white p-4 shadow-sm">
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
    <article className="rounded-xl border border-[#F2C94C]/55 bg-white p-4 shadow-sm">
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
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="font-black text-[#183F37]">{title}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">
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
