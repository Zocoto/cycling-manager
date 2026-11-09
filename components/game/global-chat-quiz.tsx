"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "@/components/ui/app-link";
import { getSportingDirectorProfileHref } from "@/lib/game/sporting-director-profile";
import {
  GLOBAL_CHAT_QUIZ_RESULT_VISIBILITY_MS,
  type GlobalChatQuizRound,
} from "@/lib/game/global-chat-quiz";

export function GlobalChatQuiz({ round, portraitUrl, onReply }: {
  round: GlobalChatQuizRound;
  portraitUrl: string;
  onReply: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);
  const endsAt = Date.parse(round.endsAt);
  const resultExpiresAt = endsAt + GLOBAL_CHAT_QUIZ_RESULT_VISIBILITY_MS;
  const open = round.status === "open" && now < endsAt;
  const deadline = open ? endsAt : resultExpiresAt;

  useEffect(() => {
    if (dismissed || deadline <= now) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [deadline, dismissed, now]);

  if (dismissed || now >= resultExpiresAt) return null;

  return (
    <section
      aria-label="Quizz’o Stratège"
      data-global-chat-quiz={open ? "open" : round.status === "won" ? "won" : "expired"}
      className="mx-3 mt-2 flex shrink-0 items-center gap-2.5 rounded-xl border border-[#E6AD77]/50 bg-[#192B37] px-2.5 py-2 text-[#FFF1DE] sm:mx-6 sm:gap-3 sm:px-3"
    >
      <Image src="/images/chat/quizz-o-stratege.svg" alt="" width={40} height={40} unoptimized className="size-8 shrink-0 rounded-full object-contain sm:size-10" />
      <Image src={portraitUrl} alt={open ? "Portrait du coureur à deviner" : ""} width={56} height={56} unoptimized className="size-11 shrink-0 rounded-md border border-[#E6AD77]/50 bg-[#FFF1DE] object-cover sm:size-14" />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#FFC995] sm:text-[10px]" data-i18n-skip>Quizz’o Stratège</p>
        {open ? (
          <>
            <p className="text-sm font-black leading-tight">Top ! Je suis, je suis…</p>
            <p className="mt-0.5 text-[11px] font-semibold leading-tight text-[#E2E9E8]">Écris son prénom et son nom dans le chat.</p>
          </>
        ) : (
          <>
            {round.status === "won" && round.winnerSportingDirectorId && round.winnerUsername ? (
              <p className="text-sm font-black leading-snug break-words">
                <span>Oui ! Oui ! Oui !</span>{" "}
                <Link href={getSportingDirectorProfileHref(round.winnerSportingDirectorId)} prefetch={false} className="text-[#FFC995] underline decoration-[#FFC995]/70 underline-offset-2 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFC995]">
                  @{round.winnerUsername}
                </Link>{", "}
                <span>tu remportes un booster Cyclo-Stickers !</span>
              </p>
            ) : <p className="text-sm font-black leading-tight">Temps écoulé.</p>}
            {round.answerName ? (
              <p className="mt-0.5 text-[11px] leading-tight text-[#E2E9E8]">
                <span>C’était</span>{" "}
                {round.answerRiderId ? (
                  <Link href={`/jeu/coureurs/${encodeURIComponent(round.answerRiderId)}`} prefetch={false} className="font-black text-[#FFC995] underline underline-offset-2 hover:text-white" data-i18n-skip>{round.answerName}</Link>
                ) : <strong data-i18n-skip>{round.answerName}</strong>}.
              </p>
            ) : null}
          </>
        )}
      </div>
      {open ? (
        <button type="button" onClick={onReply} className="min-h-11 shrink-0 rounded-lg bg-[#FFC995] px-2.5 text-xs font-black text-[#192B37] transition hover:bg-[#FFE0C2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFC995] sm:px-3">Répondre</button>
      ) : (
        <button type="button" onClick={() => setDismissed(true)} className="grid size-11 shrink-0 place-items-center rounded-lg text-lg font-black text-[#FFE0C2] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#FFC995]" aria-label="Masquer le résultat du quiz">×</button>
      )}
    </section>
  );
}

export function GlobalChatQuizQuestion({ round, portraitUrl, timeLabel }: {
  round: GlobalChatQuizRound;
  portraitUrl: string;
  timeLabel?: string;
}) {
  const open = round.status === "open";
  const answer = !open && round.answerName;

  return (
    <article
      aria-label="Quizz’o Stratège"
      data-global-chat-quiz-question={round.status}
      className="flex scroll-mt-4 items-start gap-3"
    >
      <Image
        src="/images/chat/quizz-o-stratege.svg"
        alt=""
        width={48}
        height={48}
        unoptimized
        className="size-12 shrink-0 rounded-full border border-[#D9C2F3] bg-[#F3EBFC] shadow-sm sm:size-14"
      />
      <div className="min-w-0 max-w-[min(42rem,calc(100%_-_4.25rem))] rounded-2xl rounded-tl-sm border border-[#D9C2F3] bg-[#F3EBFC] px-4 py-3 text-[#3E2457] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="text-[11px] font-black text-[#6B3C91]" data-i18n-skip>Quizz’o Stratège</span>
          {timeLabel ? <time dateTime={round.startsAt} className="text-[9px] font-bold text-[#6D4A80]">{timeLabel}</time> : null}
        </div>
        <div className="mt-2 flex items-start gap-2.5 sm:gap-3">
          <Image
            src={portraitUrl}
            alt={open ? "Portrait du coureur à deviner" : ""}
            width={56}
            height={56}
            unoptimized
            className="size-11 shrink-0 rounded-md border border-[#D9C2F3] bg-white object-cover sm:size-14"
          />
          <div className="min-w-0 break-words">
            <p className="text-sm font-semibold leading-5">Top ! Je suis, je suis…</p>
            {open ? (
              <p className="mt-0.5 text-[11px] font-semibold leading-tight">Écris son prénom et son nom dans le chat.</p>
            ) : (
              <div className="mt-1 space-y-0.5 text-[11px] leading-tight">
                {round.status === "won" && round.winnerSportingDirectorId && round.winnerUsername ? (
                  <p>
                    <span>Oui ! Oui ! Oui !</span>{" "}
                    <Link href={getSportingDirectorProfileHref(round.winnerSportingDirectorId)} prefetch={false} className="font-black underline underline-offset-2 hover:text-[#6B3C91]">
                      @{round.winnerUsername}
                    </Link>{", "}
                    <span>tu remportes un booster Cyclo-Stickers !</span>
                  </p>
                ) : <p className="font-bold">Temps écoulé.</p>}
                {answer ? (
                  <p>
                    <span>C’était</span>{" "}
                    {round.answerRiderId ? (
                      <Link href={`/jeu/coureurs/${encodeURIComponent(round.answerRiderId)}`} prefetch={false} className="font-black underline underline-offset-2 hover:text-[#6B3C91]" data-i18n-skip>{answer}</Link>
                    ) : <strong data-i18n-skip>{answer}</strong>}.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
