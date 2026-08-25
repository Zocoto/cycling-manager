"use client";

import { useState, useTransition } from "react";

import { submitPostRaceInterviewAction } from "@/app/jeu/resultats/interview-actions";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import type {
  PostRaceInterviewSnapshot,
  ZoneMixteEvent,
  ZoneMixteEventRisk,
} from "@/lib/game/post-race-interview";

export function PostRaceInterviewPanel({
  initialInterview,
}: {
  initialInterview: PostRaceInterviewSnapshot;
}) {
  const [interview, setInterview] = useState(initialInterview);
  const [answers, setAnswers] = useState(() =>
    initialInterview.questions.map(
      (question) =>
        initialInterview.answers.find(
          ({ questionId }) => questionId === question.id,
        )?.answer ?? "",
    ),
  );
  const [eventChoiceId, setEventChoiceId] = useState<string | null>(null);
  const [closingNote, setClosingNote] = useState(initialInterview.closingNote);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (interview.status === "submitted") {
    return (
      <section className="m-4 overflow-hidden rounded-2xl border border-[#B99A4A]/35 bg-[#FFF8DF] shadow-sm sm:m-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#B99A4A]/25 px-5 py-4 sm:px-6">
          <InterviewIdentity interview={interview} />
          <span className="rounded-full bg-[#176951] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
            Réaction transmise
          </span>
        </div>
        <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-3">
          {interview.answers.map((answer) => (
            <blockquote
              key={answer.questionId}
              className="border-l-2 border-[#C72F5E] pl-4"
            >
              <p className="text-xs font-bold leading-5 text-[#6F6650]">
                {answer.question}
              </p>
              <p
                data-i18n-skip
                className="mt-2 font-serif text-base font-bold leading-6 text-[#183F37]"
              >
                « {answer.answer} »
              </p>
            </blockquote>
          ))}
        </div>
        {interview.eventResolution ? (
          <div className="mx-5 mb-5 rounded-xl border border-[#176951]/20 bg-[#E8F5EE] px-4 py-3 text-sm font-bold text-[#174C3E] sm:mx-6">
            <span className="mr-2">Conséquence :</span>
            {interview.eventResolution.outcome.summary}
          </div>
        ) : null}
        <p className="border-t border-[#B99A4A]/20 px-5 py-3 text-xs font-bold text-[#6F6650] sm:px-6">
          Une sélection de vos propos pourra paraître dans la prochaine édition
          de La Cyclogazette à 20 h.
        </p>
      </section>
    );
  }

  const event = interview.context.zoneMixteEvent ?? null;
  const standardQuestionIndexes = interview.questions.flatMap(
    (question, index) => (question.category === "event" ? [] : [index]),
  );
  const canSubmit =
    standardQuestionIndexes.every(
      (index) => answers[index]?.trim().length >= 2,
    ) && (!event || eventChoiceId !== null);

  function submit() {
    if (!canSubmit || isPending) return;
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const freeAnswers = standardQuestionIndexes.map(
          (index) => answers[index] ?? "",
        );
        const updated = await submitPostRaceInterviewAction({
          interviewId: interview.id,
          answers: freeAnswers,
          closingNote,
          eventChoiceId,
        });
        setInterview(updated);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "L’interview n’a pas pu être enregistrée.",
        );
      }
    });
  }

  return (
    <section className="m-4 overflow-hidden rounded-2xl border border-[#B99A4A]/40 bg-[linear-gradient(135deg,#FFF8DF,#F7EBC4)] shadow-[0_12px_34px_rgba(80,60,20,0.12)] sm:m-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#B99A4A]/25 px-5 py-4 sm:px-6">
        <InterviewIdentity interview={interview} />
        <span className="inline-flex items-center gap-2 rounded-full border border-[#C72F5E]/25 bg-[#C72F5E]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#9C234A]">
          <MicrophoneIcon /> Zone mixte
        </span>
      </div>
      <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-3">
        {interview.questions.map((question, index) =>
          question.category === "event" && event ? (
            <ZoneMixteEventCard
              key={question.id}
              event={event}
              index={index}
              selectedChoiceId={eventChoiceId}
              onSelect={setEventChoiceId}
              disabled={isPending}
            />
          ) : (
            <label key={question.id} className="block">
              <span className="flex items-start gap-3 text-sm font-black leading-5 text-[#183F37]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#183F37] text-[10px] text-[#FFF8DF]">
                  {index + 1}
                </span>
                {question.text}
              </span>
              <textarea
                value={answers[index]}
                onChange={(changeEvent) => {
                  const next = [...answers];
                  next[index] = changeEvent.target.value;
                  setAnswers(next);
                }}
                maxLength={600}
                rows={4}
                placeholder="Votre réponse…"
                className="mt-3 w-full resize-y rounded-xl border border-[#B99A4A]/35 bg-white/75 px-3 py-3 text-sm font-semibold leading-5 text-[#183F37] outline-none transition placeholder:text-[#7E7764] focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/15"
              />
            </label>
          ),
        )}
      </div>
      <div className="border-t border-[#B99A4A]/25 px-5 py-5 sm:px-6">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-[#6F6650]">
            Le dernier mot du DS · facultatif
          </span>
          <textarea
            value={closingNote}
            onChange={(changeEvent) => setClosingNote(changeEvent.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Une déclaration libre pour les lecteurs de La Cyclogazette…"
            className="mt-2 w-full resize-y rounded-xl border border-[#B99A4A]/35 bg-white/75 px-3 py-3 text-sm font-semibold text-[#183F37] outline-none focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/15"
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[#6F6650]">
            Vos réponses et votre décision seront figées après validation.
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || isPending}
            className="inline-flex min-h-11 items-center rounded-xl bg-[#176951] px-5 text-sm font-black text-white transition hover:bg-[#0B4C3C] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isPending
              ? "Envoi à la rédaction…"
              : "Confier mes réponses à la rédaction"}
          </button>
        </div>
        {errorMessage ? (
          <p role="alert" className="mt-3 text-sm font-bold text-[#A32442]">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ZoneMixteEventCard({
  event,
  index,
  selectedChoiceId,
  onSelect,
  disabled,
}: {
  event: ZoneMixteEvent;
  index: number;
  selectedChoiceId: string | null;
  onSelect: (choiceId: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="min-w-0 rounded-2xl border-2 border-[#C72F5E]/25 bg-white/70 p-4 shadow-sm">
      <legend className="sr-only">Événement de zone mixte</legend>
      <div className="flex items-start gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#C72F5E] text-[10px] font-black text-white">
          {index + 1}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9C234A]">
              Événement {rarityLabel(event.rarity)}
            </span>
            <span className="rounded-full bg-[#C72F5E]/10 px-2 py-0.5 text-[9px] font-black uppercase text-[#9C234A]">
              Décision du DS
            </span>
          </div>
          <p className="mt-1 font-serif text-base font-black leading-5 text-[#183F37]">
            {event.title}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-[#6F6650]">
        {event.story}
      </p>
      <div className="mt-4 space-y-2.5">
        {event.choices.map((choice) => (
          <label
            key={choice.id}
            className={`block cursor-pointer rounded-xl border p-3 transition ${
              selectedChoiceId === choice.id
                ? "border-[#176951] bg-[#E5F4ED] ring-2 ring-[#176951]/15"
                : "border-[#B99A4A]/30 bg-white/80 hover:border-[#176951]/45"
            }`}
          >
            <span className="flex items-start gap-2.5">
              <input
                type="radio"
                name={`zone-mixte-${event.id}`}
                value={choice.id}
                checked={selectedChoiceId === choice.id}
                onChange={() => onSelect(choice.id)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 accent-[#176951]"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-xs font-black text-[#183F37]">
                  {choice.label}
                  <RiskBadge risk={choice.risk} />
                </span>
                <span className="mt-1 block text-[11px] font-semibold leading-4 text-[#6F6650]">
                  {choice.description}
                </span>
                <span className="mt-1.5 block text-[10px] font-black leading-4 text-[#176951]">
                  {choice.impactPreview}
                </span>
              </span>
            </span>
          </label>
        ))}
        <label
          className={`block cursor-pointer rounded-xl border p-3 transition ${
            selectedChoiceId === "skip"
              ? "border-[#6F6650] bg-[#F3EFE4] ring-2 ring-[#6F6650]/10"
              : "border-[#B99A4A]/25 bg-white/55 hover:border-[#6F6650]/40"
          }`}
        >
          <span className="flex items-start gap-2.5">
            <input
              type="radio"
              name={`zone-mixte-${event.id}`}
              value="skip"
              checked={selectedChoiceId === "skip"}
              onChange={() => onSelect("skip")}
              disabled={disabled}
              className="mt-0.5 h-4 w-4 accent-[#6F6650]"
            />
            <span>
              <span className="block text-xs font-black text-[#453F31]">
                Ne pas réagir
              </span>
              <span className="mt-1 block text-[11px] font-semibold text-[#6F6650]">
                L’organisation gère la situation. Aucun effet.
              </span>
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

function RiskBadge({ risk }: { risk: ZoneMixteEventRisk }) {
  const presentation = {
    safe: "Sûr",
    balanced: "Mesuré",
    bold: "Audacieux",
  }[risk];
  return (
    <span className="rounded-full border border-current/15 bg-white/60 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] text-[#7B6330]">
      {presentation}
    </span>
  );
}

function rarityLabel(rarity: ZoneMixteEvent["rarity"]) {
  if (rarity === "rare") return "rare";
  if (rarity === "notable") return "notable";
  return "commun";
}

function InterviewIdentity({
  interview,
}: {
  interview: PostRaceInterviewSnapshot;
}) {
  return (
    <div className="flex items-center gap-3">
      <SportingDirectorAvatar
        avatarKey={interview.context.directorAvatarKey}
        size="small"
        label={`Portrait de ${interview.context.directorName}`}
      />
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9C234A]">
          L’interview après-course
        </p>
        <p className="mt-0.5 font-serif text-lg font-black text-[#183F37]">
          La Cyclogazette tend le micro à {interview.context.directorName}
        </p>
      </div>
    </div>
  );
}

function MicrophoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <rect x="7" y="2" width="6" height="10" rx="3" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3M7 18h6" />
    </svg>
  );
}
