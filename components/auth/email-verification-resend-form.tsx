"use client";

import { useActionState } from "react";

import { resendSignupConfirmation } from "@/app/(public)/verification-email/actions";
import {
  initialVerificationEmailState,
} from "@/app/(public)/verification-email/verification-email-state";

export function EmailVerificationResendForm({
  initialEmail = "",
  tone = "dark",
}: {
  initialEmail?: string;
  tone?: "dark" | "light";
}) {
  const [state, formAction, pending] = useActionState(
    resendSignupConfirmation,
    initialVerificationEmailState,
  );
  const succeeded = state.status === "success";
  const isDark = tone === "dark";

  return (
    <div
      className={`rounded-xl border p-4 ${
        isDark
          ? "border-white/15 bg-white/5"
          : "border-[#315B3E]/15 bg-[#F4FAF7]"
      }`}
    >
      <p
        className={`text-sm font-black ${
          isDark ? "text-[#FFFDF4]" : "text-[#183F37]"
        }`}
      >
        Vous n’avez rien reçu ?
      </p>
      <p
        className={`mt-1 text-xs font-semibold leading-5 ${
          isDark ? "text-[#BFD1C6]" : "text-[#60756E]"
        }`}
      >
        Le lien reste valable une heure. Un renvoi est possible après
        un délai minimal d’une minute.
      </p>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold leading-5 ${
            state.status === "success"
              ? "bg-[#42CDA8]/15 text-[#176951]"
              : isDark
                ? "bg-[#F2C94C]/10 text-[#F7D96B]"
                : "bg-[#FFF3C4] text-[#715A00]"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      {!succeeded ? (
        <form action={formAction} className="mt-4">
          <label
            htmlFor={`verification-email-${tone}`}
            className={`text-xs font-black ${
              isDark ? "text-[#D6DFD2]" : "text-[#315B3E]"
            }`}
          >
            Adresse e-mail du compte
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id={`verification-email-${tone}`}
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={initialEmail}
              disabled={pending}
              aria-invalid={Boolean(
                state.fieldErrors.email?.length,
              )}
              className={`min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-sm font-semibold outline-none transition focus:border-[#42CDA8] focus:ring-2 focus:ring-[#42CDA8]/20 disabled:opacity-60 ${
                isDark
                  ? "border-white/20 bg-[#071A17]/70 text-white"
                  : "border-[#315B3E]/20 bg-white text-[#183F37]"
              }`}
            />
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 shrink-0 rounded-lg bg-[#F2C94C] px-4 text-xs font-black uppercase tracking-[0.08em] text-[#071A17] transition hover:bg-[#FFD968] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Envoi…" : "Renvoyer"}
            </button>
          </div>
          {state.fieldErrors.email?.map((error) => (
            <p
              key={error}
              className={`mt-2 text-xs font-bold ${
                isDark ? "text-[#F7D96B]" : "text-red-700"
              }`}
            >
              {error}
            </p>
          ))}
        </form>
      ) : null}
    </div>
  );
}
