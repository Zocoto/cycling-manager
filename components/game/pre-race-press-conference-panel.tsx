import Link from "@/components/ui/app-link";

import { submitPreRacePressConferenceAction } from "@/app/jeu/courses/[slug]/actions";
import {
  PRE_RACE_AMBITION_DETAILS,
  PRE_RACE_AMBITIONS,
  PRE_RACE_INTENT_LABELS,
  PRE_RACE_INTENTS,
  type PreRacePressConference,
} from "@/lib/game/pre-race-press";
import type { RaceRosterOption } from "@/services/race-calendar";

export function PreRacePressConferencePanel({
  editionId,
  raceSlug,
  selectedRiders,
  conferences,
  canPublish,
  loadError,
}: {
  editionId: string;
  raceSlug: string;
  selectedRiders: RaceRosterOption[];
  conferences: PreRacePressConference[];
  canPublish: boolean;
  loadError: boolean;
}) {
  const ownConference = conferences.find((conference) => conference.isOwn) ?? null;

  return (
    <section
      id="conference-presse"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#B99A4A]/35 bg-[#FFF8DF] shadow-sm"
    >
      <header className="border-b border-[#B99A4A]/25 bg-[linear-gradient(135deg,#173E36,#255D50)] px-5 py-5 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7DA73]">
          Événement d’avant-course
        </p>
        <h2 className="mt-2 font-serif text-xl font-black">
          Conférence de presse
        </h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-[#D6DFD2]">
          Annoncez votre leader et engagez votre réputation sur un objectif public.
        </p>
      </header>

      {loadError ? (
        <p className="px-5 py-5 text-sm font-bold text-[#9C234A]">
          La salle de presse est momentanément indisponible.
        </p>
      ) : ownConference ? (
        <PublishedConference conference={ownConference} />
      ) : canPublish && selectedRiders.length > 0 ? (
        <form action={submitPreRacePressConferenceAction} className="space-y-4 px-5 py-5">
          <input type="hidden" name="editionId" value={editionId} />
          <input type="hidden" name="slug" value={raceSlug} />
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#174C3E]">
              Leader annoncé
            </span>
            <select
              name="leaderRiderId"
              required
              defaultValue=""
              className="mt-2 min-h-11 w-full rounded-xl border border-[#B99A4A]/35 bg-white px-3 text-sm font-bold text-[#183F37]"
            >
              <option value="" disabled>Choisir dans la startlist</option>
              {selectedRiders.map((rider) => (
                <option key={rider.riderId} value={rider.riderId}>
                  {rider.firstName} {rider.lastName}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-xs font-black uppercase tracking-[0.14em] text-[#174C3E]">
              Objectif public
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {PRE_RACE_AMBITIONS.map((ambition) => {
                const detail = PRE_RACE_AMBITION_DETAILS[ambition];
                return (
                  <label key={ambition} className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#B99A4A]/25 bg-white/75 p-3">
                    <input type="radio" name="ambition" value={ambition} required className="mt-0.5 accent-[#176951]" />
                    <span>
                      <span className="block text-xs font-black text-[#183F37]">{detail.label}</span>
                      <span className="mt-0.5 block text-[10px] font-bold text-[#6F6650]">
                        {detail.target} · +{detail.success} / {detail.failure} réputation
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#174C3E]">
              Intention de course
            </span>
            <select name="raceIntent" required defaultValue="" className="mt-2 min-h-11 w-full rounded-xl border border-[#B99A4A]/35 bg-white px-3 text-sm font-bold text-[#183F37]">
              <option value="" disabled>Choisir une ligne sportive</option>
              {PRE_RACE_INTENTS.map((intent) => (
                <option key={intent} value={intent}>{PRE_RACE_INTENT_LABELS[intent]}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#174C3E]">
              Déclaration aux médias
            </span>
            <textarea
              name="publicStatement"
              required
              minLength={10}
              maxLength={500}
              rows={4}
              placeholder="Notre collectif arrive avec une ambition claire…"
              className="mt-2 w-full resize-y rounded-xl border border-[#B99A4A]/35 bg-white px-3 py-3 text-sm font-semibold leading-5 text-[#183F37] placeholder:text-[#8A816C]"
            />
          </label>
          <button type="submit" className="min-h-11 w-full rounded-xl bg-[#176951] px-4 text-sm font-black text-white transition hover:bg-[#0B4C3C]">
            Publier la conférence
          </button>
          <p className="text-[10px] font-bold leading-4 text-[#6F6650]">
            La déclaration est publique et définitive. La réputation est réglée automatiquement à l’arrivée.
          </p>
        </form>
      ) : (
        <p className="px-5 py-5 text-sm font-semibold leading-6 text-[#6F6650]">
          Validez d’abord une startlist complète pour ouvrir la conférence de presse.
        </p>
      )}

      {conferences.filter((conference) => !conference.isOwn).length > 0 ? (
        <details className="border-t border-[#B99A4A]/25 px-5 py-4">
          <summary className="cursor-pointer text-xs font-black text-[#174C3E]">
            Lire les déclarations adverses ({conferences.filter((conference) => !conference.isOwn).length})
          </summary>
          <div className="mt-4 space-y-3">
            {conferences.filter((conference) => !conference.isOwn).map((conference) => (
              <PublishedConference key={conference.id} conference={conference} compact />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function PublishedConference({
  conference,
  compact = false,
}: {
  conference: PreRacePressConference;
  compact?: boolean;
}) {
  const ambition = PRE_RACE_AMBITION_DETAILS[conference.ambition];
  return (
    <article className={compact ? "rounded-xl border border-[#B99A4A]/25 bg-white/75 p-4" : "px-5 py-5"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-[#183F37]">{conference.teamName}</p>
          <p className="text-[10px] font-bold text-[#6F6650]">{conference.directorName} · {PRE_RACE_INTENT_LABELS[conference.raceIntent]}</p>
        </div>
        <span className="rounded-full bg-[#176951]/10 px-2.5 py-1 text-[9px] font-black uppercase text-[#176951]">
          {ambition.label}
        </span>
      </div>
      <blockquote className="mt-3 border-l-2 border-[#C72F5E] pl-3 font-serif text-sm font-bold leading-5 text-[#183F37]">
        « {conference.publicStatement} »
      </blockquote>
      <p className="mt-3 text-[10px] font-bold text-[#6F6650]">
        Leader : <Link href={`/jeu/coureurs/${conference.leaderRiderId}`} className="text-[#176951] underline-offset-2 hover:underline">{conference.leaderName}</Link> · {ambition.target}
      </p>
      {conference.status === "settled" ? (
        <p className={`mt-2 text-xs font-black ${conference.targetMet ? "text-[#176951]" : "text-[#9C234A]"}`}>
          {conference.targetMet ? "Objectif tenu" : "Objectif manqué"}
          {conference.leaderFinalRank ? ` · ${conference.leaderFinalRank}e` : " · non classé"}
          {conference.reputationDelta !== null ? ` · ${conference.reputationDelta >= 0 ? "+" : ""}${conference.reputationDelta} réputation` : ""}
        </p>
      ) : conference.isOwn ? (
        <p className="mt-2 text-xs font-black text-[#B57B00]">Déclaration publiée · verdict à l’arrivée</p>
      ) : null}
    </article>
  );
}
