"use client";

import { useActionState, type ReactNode } from "react";

import {
  submitFederationCandidacyAction,
  voteFederationPresidentAction,
} from "@/app/jeu/federations/governance-actions";
import { initialFederationGovernanceActionState } from "@/lib/game/federation-action-states";
import type {
  FederationElectionCandidate,
  FederationElectionPhase,
  FederationGovernanceOverview,
} from "@/services/federation-governance";

const PHASES: Array<{
  id: FederationElectionPhase;
  label: string;
  timing: string;
}> = [
  { id: "applications", label: "Candidatures", timing: "J21–J24" },
  { id: "voting", label: "Vote des équipes", timing: "J25–J28" },
  { id: "finalized", label: "Prise de fonction", timing: "J1" },
];

export function FederationElectionPanel({
  countryCode,
  overview,
}: {
  countryCode: string;
  overview: FederationGovernanceOverview;
}) {
  const [candidacyState, candidacyAction, candidacyPending] = useActionState(
    submitFederationCandidacyAction,
    initialFederationGovernanceActionState,
  );
  const [voteState, voteAction, votePending] = useActionState(
    voteFederationPresidentAction,
    initialFederationGovernanceActionState,
  );
  const effectivePhase =
    overview.phase === "automatic" ? "finalized" : overview.phase;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
      <div className="grid gap-6 bg-[var(--federation-primary)] p-6 text-white sm:p-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-accent)]">
            Présidence fédérale · mandat S{overview.termStartGameYear}–S
            {overview.termEndGameYear}
          </p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">
            {getElectionTitle(overview)}
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
            Une seule voix est accordée à chaque équipe présente sur la liste
            figée à J21. Sans élu, l’administration automatique prend le relais
            et aucune échéance sportive n’est bloquée.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <ElectionMetric label="Électeurs" value={`${overview.eligibleTeamCount}`} />
          <ElectionMetric label="Candidats" value={`${overview.candidates.length}`} />
          <ElectionMetric
            label="Participation"
            value={
              overview.phase === "voting" ||
              overview.phase === "finalized" ||
              overview.phase === "automatic"
                ? `${overview.voteCount}/${overview.eligibleTeamCount}`
                : "—"
            }
          />
        </div>
      </div>

      <div className="grid gap-2 border-b border-[#315B3E]/10 bg-[#F8FBF9] p-4 sm:grid-cols-3 sm:p-5">
        {PHASES.map((phase, index) => {
          const activeIndex = PHASES.findIndex(
            (candidate) => candidate.id === effectivePhase,
          );
          const complete = activeIndex > index;
          const active = activeIndex === index;
          return (
            <div
              key={phase.id}
              className={`rounded-xl border px-4 py-3 ${
                active
                  ? "border-[var(--federation-secondary)]/45 bg-[#E5F4ED]"
                  : complete
                    ? "border-[#315B3E]/10 bg-white"
                    : "border-transparent bg-[#EEF3F1]"
              }`}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                {phase.timing}
              </p>
              <p className="mt-1 text-sm font-black text-[#183F37]">
                {complete ? "✓ " : ""}
                {phase.label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {overview.phase === "scheduled" ? (
          <ElectionNotice tone="neutral">
            L’appel à candidatures s’ouvrira automatiquement à J21. La liste
            des équipes électrices sera figée à cet instant.
          </ElectionNotice>
        ) : null}

        {overview.phase === "applications" ? (
          <ApplicationsPhase
            countryCode={countryCode}
            overview={overview}
            state={candidacyState}
            action={candidacyAction}
            pending={candidacyPending}
          />
        ) : null}

        {overview.phase === "voting" ? (
          <VotingPhase
            countryCode={countryCode}
            overview={overview}
            state={voteState}
            action={voteAction}
            pending={votePending}
          />
        ) : null}

        {overview.phase === "finalized" ? (
          <ElectionNotice tone="success">
            {overview.presidentName
              ? `${overview.presidentName} a été élu et prendra ses fonctions pour deux saisons.`
              : "Le résultat est enregistré. Le mandat débutera à J1."}
          </ElectionNotice>
        ) : null}

        {overview.phase === "automatic" ? (
          <ElectionNotice tone="neutral">
            Aucun candidat n’a réuni de voix. La fédération reste administrée
            automatiquement pour ce mandat.
          </ElectionNotice>
        ) : null}
      </div>
    </section>
  );
}

function ApplicationsPhase({
  countryCode,
  overview,
  state,
  action,
  pending,
}: {
  countryCode: string;
  overview: FederationGovernanceOverview;
  state: typeof initialFederationGovernanceActionState;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
      <div>
        <h3 className="text-2xl font-black text-[#183F37]">
          Candidatures enregistrées
        </h3>
        <div className="mt-4 space-y-3">
          {overview.candidates.length > 0 ? (
            overview.candidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))
          ) : (
            <ElectionNotice tone="neutral">
              Aucune candidature déposée pour le moment.
            </ElectionNotice>
          )}
        </div>
      </div>

      <form action={action} className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
        <input type="hidden" name="countryCode" value={countryCode} />
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--federation-secondary)]">
          {overview.viewerCandidateId
            ? "Mettre à jour votre candidature"
            : "Présenter votre candidature"}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
          Votre profession de foi est publique et restera attachée à ce scrutin.
        </p>
        <textarea
          name="manifesto"
          required
          minLength={40}
          maxLength={800}
          disabled={!overview.canApply || pending}
          placeholder="Présentez en quelques lignes votre projet pour la fédération…"
          className="mt-4 min-h-40 w-full resize-y rounded-xl border border-[#315B3E]/18 bg-white p-4 text-sm font-semibold leading-6 text-[#183F37] outline-none focus:border-[var(--federation-secondary)] disabled:cursor-not-allowed disabled:bg-[#EEF3F1]"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold text-[#60756E]">
            40 à 800 caractères · clôture J24
          </span>
          <button
            type="submit"
            disabled={!overview.canApply || pending}
            className="min-h-11 rounded-xl bg-[var(--federation-primary)] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#9AA9A3]"
          >
            {pending ? "Enregistrement…" : overview.viewerCandidateId ? "Mettre à jour" : "Déposer"}
          </button>
        </div>
        {!overview.viewerIsEligible ? (
          <ActionFeedback status="error" message="Votre équipe ne figure pas sur la liste électorale figée à J21." />
        ) : (
          <ActionFeedback status={state.status} message={state.message} />
        )}
      </form>
    </div>
  );
}

function VotingPhase({
  countryCode,
  overview,
  state,
  action,
  pending,
}: {
  countryCode: string;
  overview: FederationGovernanceOverview;
  state: typeof initialFederationGovernanceActionState;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  if (overview.candidates.length === 0) {
    return (
      <ElectionNotice tone="neutral">
        Aucune candidature n’a été déposée. Le mode automatique sera confirmé à
        J1 de la prochaine saison.
      </ElectionNotice>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="countryCode" value={countryCode} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-[#183F37]">
            Choisir le prochain président
          </h3>
          <p className="mt-2 text-sm font-semibold text-[#60756E]">
            Le choix reste secret jusqu’à la clôture. Vous pouvez le modifier
            jusqu’à la fin de J28.
          </p>
        </div>
        <button
          type="submit"
          disabled={!overview.canVote || pending}
          className="min-h-11 rounded-xl bg-[var(--federation-primary)] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#9AA9A3]"
        >
          {pending
            ? "Enregistrement…"
            : overview.viewerVotedCandidateId
              ? "Modifier mon vote"
              : "Enregistrer mon vote"}
        </button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {overview.candidates.map((candidate) => (
          <label
            key={candidate.id}
            className="flex cursor-pointer gap-4 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5 transition has-checked:border-[var(--federation-secondary)]/55 has-checked:bg-[#E5F4ED]"
          >
            <input
              type="radio"
              name="candidateId"
              value={candidate.id}
              defaultChecked={overview.viewerVotedCandidateId === candidate.id}
              disabled={!overview.canVote || pending}
              required
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--federation-secondary)]"
            />
            <span className="min-w-0">
              <span className="block font-black text-[#183F37]">
                {candidate.directorName}
              </span>
              <span className="mt-1 block text-xs font-bold text-[var(--federation-secondary)]">
                {candidate.teamName}
              </span>
              <span className="mt-3 block text-sm font-semibold leading-6 text-[#60756E]">
                {candidate.manifesto}
              </span>
            </span>
          </label>
        ))}
      </div>
      {!overview.viewerIsEligible ? (
        <ActionFeedback status="error" message="Votre équipe ne dispose pas d’une voix sur ce scrutin." />
      ) : (
        <ActionFeedback status={state.status} message={state.message} />
      )}
    </form>
  );
}

function CandidateCard({ candidate }: { candidate: FederationElectionCandidate }) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-[#183F37]">{candidate.directorName}</p>
          <p className="mt-1 text-xs font-bold text-[var(--federation-secondary)]">{candidate.teamName}</p>
        </div>
        {candidate.isViewer ? (
          <span className="rounded-full bg-[#DDF3E7] px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--federation-secondary)]">
            Votre candidature
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-[#60756E]">
        {candidate.manifesto}
      </p>
      {candidate.voteCount !== null ? (
        <p className="mt-4 text-xs font-black text-[#183F37]">
          {candidate.voteCount} voix
        </p>
      ) : null}
    </article>
  );
}

function ElectionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/15 bg-white/10 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#BFD1C6]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function ElectionNotice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "neutral" | "success";
}) {
  return (
    <p
      className={`rounded-2xl border p-5 text-sm font-bold leading-6 ${
        tone === "success"
          ? "border-[var(--federation-secondary)]/25 bg-[#E8F7F1] text-[var(--federation-secondary)]"
          : "border-[#315B3E]/12 bg-[#F2F8F5] text-[#60756E]"
      }`}
    >
      {children}
    </p>
  );
}

function ActionFeedback({
  status,
  message,
}: {
  status: "idle" | "success" | "error";
  message: string;
}) {
  if (!message) return null;
  return (
    <p
      role="status"
      className={`mt-4 rounded-xl px-4 py-3 text-xs font-black ${
        status === "success"
          ? "bg-[#DDF3E7] text-[var(--federation-secondary)]"
          : "bg-[#FBE3DE] text-[#9D3E37]"
      }`}
    >
      {message}
    </p>
  );
}

function getElectionTitle(overview: FederationGovernanceOverview): string {
  if (overview.phase === "applications") return "L’appel à candidatures est ouvert";
  if (overview.phase === "voting") return "Le scrutin est ouvert";
  if (overview.phase === "finalized") return "Le président est élu";
  if (overview.phase === "automatic") return "Administration automatique";
  return "Prochaine élection programmée";
}
