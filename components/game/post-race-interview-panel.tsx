"use client";

import { useState, useTransition } from "react";

import { submitPostRaceInterviewAction } from "@/app/jeu/resultats/interview-actions";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import type { PostRaceInterviewSnapshot } from "@/lib/game/post-race-interview";

export function PostRaceInterviewPanel({ initialInterview }: { initialInterview: PostRaceInterviewSnapshot }) {
  const [interview, setInterview] = useState(initialInterview);
  const [answers, setAnswers] = useState(() => initialInterview.questions.map((question) => initialInterview.answers.find(({ questionId }) => questionId === question.id)?.answer ?? ""));
  const [closingNote, setClosingNote] = useState(initialInterview.closingNote);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (interview.status === "submitted") {
    return (
      <section className="m-4 overflow-hidden rounded-2xl border border-[#B99A4A]/35 bg-[#FFF8DF] shadow-sm sm:m-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#B99A4A]/25 px-5 py-4 sm:px-6">
          <InterviewIdentity interview={interview} />
          <span className="rounded-full bg-[#176951] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">Réaction transmise</span>
        </div>
        <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-3">
          {interview.answers.map((answer) => (
            <blockquote key={answer.questionId} className="border-l-2 border-[#C72F5E] pl-4">
              <p className="text-xs font-bold leading-5 text-[#6F6650]">{answer.question}</p>
              <p className="mt-2 font-serif text-base font-bold leading-6 text-[#183F37]">« {answer.answer} »</p>
            </blockquote>
          ))}
        </div>
        <p className="border-t border-[#B99A4A]/20 px-5 py-3 text-xs font-bold text-[#6F6650] sm:px-6">
          Une sélection de vos propos pourra paraître dans la prochaine édition de La Cyclogazette à 20 h.
        </p>
      </section>
    );
  }

  const canSubmit = answers.every((answer) => answer.trim().length >= 2);

  function submit() {
    if (!canSubmit || isPending) return;
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const updated = await submitPostRaceInterviewAction({ interviewId: interview.id, answers, closingNote });
        setInterview(updated);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "L’interview n’a pas pu être enregistrée.");
      }
    });
  }

  return (
    <section className="m-4 overflow-hidden rounded-2xl border border-[#B99A4A]/40 bg-[linear-gradient(135deg,#FFF8DF,#F7EBC4)] shadow-[0_12px_34px_rgba(80,60,20,0.12)] sm:m-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#B99A4A]/25 px-5 py-4 sm:px-6">
        <InterviewIdentity interview={interview} />
        <span className="inline-flex items-center gap-2 rounded-full border border-[#C72F5E]/25 bg-[#C72F5E]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#9C234A]"><MicrophoneIcon /> Zone mixte</span>
      </div>
      <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-3">
        {interview.questions.map((question, index) => (
          <label key={question.id} className="block">
            <span className="flex items-start gap-3 text-sm font-black leading-5 text-[#183F37]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#183F37] text-[10px] text-[#FFF8DF]">{index + 1}</span>
              {question.text}
            </span>
            <textarea
              value={answers[index]}
              onChange={(event) => { const next = [...answers]; next[index] = event.target.value; setAnswers(next); }}
              maxLength={600}
              rows={4}
              placeholder="Votre réponse…"
              className="mt-3 w-full resize-y rounded-xl border border-[#B99A4A]/35 bg-white/75 px-3 py-3 text-sm font-semibold leading-5 text-[#183F37] outline-none transition placeholder:text-[#7E7764] focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/15"
            />
          </label>
        ))}
      </div>
      <div className="border-t border-[#B99A4A]/25 px-5 py-5 sm:px-6">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-[#6F6650]">Le dernier mot du DS · facultatif</span>
          <textarea
            value={closingNote}
            onChange={(event) => setClosingNote(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Une déclaration libre pour les lecteurs de La Cyclogazette…"
            className="mt-2 w-full resize-y rounded-xl border border-[#B99A4A]/35 bg-white/75 px-3 py-3 text-sm font-semibold text-[#183F37] outline-none focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/15"
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[#6F6650]">Vos réponses seront figées après validation.</p>
          <button type="button" onClick={submit} disabled={!canSubmit || isPending} className="inline-flex min-h-11 items-center rounded-xl bg-[#176951] px-5 text-sm font-black text-white transition hover:bg-[#0B4C3C] disabled:cursor-not-allowed disabled:opacity-45">
            {isPending ? "Envoi à la rédaction…" : "Confier mes réponses à la rédaction"}
          </button>
        </div>
        {errorMessage ? <p role="alert" className="mt-3 text-sm font-bold text-[#A32442]">{errorMessage}</p> : null}
      </div>
    </section>
  );
}

function InterviewIdentity({ interview }: { interview: PostRaceInterviewSnapshot }) {
  return (
    <div className="flex items-center gap-3">
      <SportingDirectorAvatar avatarKey={interview.context.directorAvatarKey} size="small" label={`Portrait de ${interview.context.directorName}`} />
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9C234A]">L’interview après-course</p>
        <p className="mt-0.5 font-serif text-lg font-black text-[#183F37]">La Cyclogazette tend le micro à {interview.context.directorName}</p>
      </div>
    </div>
  );
}

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="7" y="2" width="6" height="10" rx="3" /><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3M7 18h6" />
    </svg>
  );
}
