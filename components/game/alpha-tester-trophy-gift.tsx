"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { claimAlphaTesterTrophyAction } from "@/app/jeu/objectifs/actions";
import { initialClaimAlphaTesterTrophyState } from "@/app/jeu/objectifs/alpha-tester-trophy-state";
import { AlphaTesterTrophyMark } from "@/components/game/alpha-tester-trophy-mark";
import Link from "@/components/ui/app-link";
import type { ClaimableTrophyReward } from "@/lib/game/trophy-gallery";

export function AlphaTesterTrophyGift({
  reward,
}: {
  reward: ClaimableTrophyReward;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    claimAlphaTesterTrophyAction,
    initialClaimAlphaTesterTrophyState
  );
  const revealed = state.status === "success";

  function closeReveal() {
    router.refresh();
  }

  return (
    <>
      <article
        id="trophee-alpha-tester"
        className="relative mb-8 overflow-hidden rounded-[1.75rem] border border-[#48D9C0]/35 bg-[linear-gradient(135deg,rgba(52,42,100,0.62),rgba(10,55,49,0.9))] p-5 shadow-[0_18px_55px_rgba(72,217,192,0.14)] sm:p-7"
      >
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-16 h-52 w-52 rounded-full border-[28px] border-[#48D9C0]/8"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-36 w-full shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 sm:w-40">
            <GiftBoxIcon />
          </div>

          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-full border border-[#48D9C0]/35 bg-[#48D9C0]/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#D7FFF8]">
              Nouveau trophée
            </span>
            <h3 className="mt-3 text-2xl font-black text-white">
              Un cadeau vous attend
            </h3>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#BFD8CF]">
              Ouvrez cette récompense exclusive de la phase Alpha pour découvrir
              la distinction qui rejoindra votre galerie.
            </p>

            {state.status === "error" ? (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-[#FF9B9B]/30 bg-[#6E1E2B]/35 px-4 py-3 text-sm font-bold text-[#FFD7DC]"
              >
                {state.message}
              </p>
            ) : null}

            <form action={formAction} className="mt-5">
              <OpenGiftButton />
            </form>
          </div>
        </div>
      </article>

      {revealed ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="alpha-tester-reveal-title"
          className="fixed inset-0 z-[280] flex items-center justify-center bg-[#041411]/85 p-4 backdrop-blur-md"
        >
          <div className="relative max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-[#48D9C0]/35 bg-[linear-gradient(145deg,#091F1C,#172F39_58%,#2A2351)] p-6 text-center text-white shadow-[0_35px_120px_rgba(0,0,0,0.55)] sm:p-9">
            <div
              aria-hidden="true"
              className="absolute inset-x-20 top-16 h-48 rounded-full bg-[#48D9C0]/16 blur-3xl"
            />
            <div className="relative mx-auto flex h-52 w-52 items-center justify-center rounded-full border border-white/10 bg-black/20">
              <AlphaTesterTrophyMark className="h-48 w-48" />
            </div>

            <p className="relative mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#48D9C0]">
              Trophée débloqué
            </p>
            <h2
              id="alpha-tester-reveal-title"
              className="relative mt-2 text-4xl font-black sm:text-5xl"
            >
              {reward.title}
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-sm font-semibold leading-7 text-[#C6DBD3]">
              {reward.description}
            </p>

            <div className="relative mt-7 grid gap-3 sm:grid-cols-2">
              <Link
                href="/jeu/directeur-sportif#distinction-avatar"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#48D9C0] px-5 text-xs font-black uppercase tracking-[0.12em] text-[#071A17] transition hover:bg-[#7DEAD8]"
              >
                Configurer mon liseré
              </Link>
              <button
                type="button"
                onClick={closeReveal}
                className="min-h-12 rounded-xl border border-white/15 bg-white/8 px-5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/14"
              >
                Voir dans ma galerie
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function OpenGiftButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#48D9C0] px-6 text-xs font-black uppercase tracking-[0.13em] text-[#071A17] shadow-[0_12px_30px_rgba(72,217,192,0.2)] transition hover:-translate-y-0.5 hover:bg-[#7DEAD8] disabled:cursor-wait disabled:opacity-65"
    >
      {pending ? "Ouverture…" : "Ouvrir mon cadeau"}
    </button>
  );
}

function GiftBoxIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      className="h-28 w-28 text-[#48D9C0]"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="22" y="49" width="76" height="55" rx="9" fill="#102D28" />
      <path d="M17 39h86v18H17zM60 39v65" fill="#2A2351" />
      <path d="M60 39H43c-16 0-18-22-4-24 12-2 18 13 21 24ZM60 39h17c16 0 18-22 4-24-12-2-18 13-21 24Z" />
      <circle cx="60" cy="76" r="8" fill="#D7FFF8" stroke="none" />
      <path d="M60 68v16M52 76h16" stroke="#342A64" strokeWidth="3" />
    </svg>
  );
}