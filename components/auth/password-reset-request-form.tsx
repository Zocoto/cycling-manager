"use client";

import { useActionState, useState } from "react";

import { requestPasswordReset } from "../../app/(public)/mot-de-passe-oublie/actions";
import {
  initialResetRequestState,
  type ResetRequestField,
} from "../../app/(public)/mot-de-passe-oublie/reset-request-state";

export function PasswordResetRequestForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialResetRequestState
  );

  const [dismissedFields, setDismissedFields] = useState<
    ResetRequestField[]
  >([]);

  const requestSucceeded = state.status === "success";

  const emailErrors =
    pending || dismissedFields.includes("email")
      ? undefined
      : state.fieldErrors.email;

  const shouldShowStateMessage =
    Boolean(state.message) &&
    !pending &&
    (state.status === "success" ||
      !state.fieldErrors.email?.length ||
      Boolean(emailErrors?.length));

  function dismissEmailError() {
    setDismissedFields(["email"]);
  }

  return (
    <div>
      {shouldShowStateMessage ? (
        <div
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            state.status === "success"
              ? "mb-6 rounded-xl border border-[#42CDA8]/45 bg-[#42CDA8]/12 px-4 py-4"
              : "mb-6 rounded-xl border border-[#F2C94C]/45 bg-[#F2C94C]/10 px-4 py-4"
          }
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={
                state.status === "success"
                  ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#42CDA8] font-black text-[#07302A]"
                  : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2C94C] font-black text-[#071A17]"
              }
            >
              {state.status === "success" ? "✓" : "!"}
            </span>

            <div>
              <p
                className={
                  state.status === "success"
                    ? "text-sm font-bold text-[#7FE0C0]"
                    : "text-sm font-bold text-[#F2C94C]"
                }
              >
                {state.status === "success"
                  ? "Demande envoyée"
                  : "Demande impossible"}
              </p>

              <p className="mt-1 text-sm leading-6 text-[#D6DFD2]">
                {state.message}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <form
        action={formAction}
        onSubmit={() => setDismissedFields([])}
        className="space-y-5"
      >
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-bold text-[#FFFDF4]"
          >
            Adresse e-mail
          </label>

          <input
            id="email"
            name="email"
            type="email"
            placeholder="directeur@cyclostratege.fr"
            autoComplete="email"
            required
            disabled={pending || requestSucceeded}
            aria-invalid={Boolean(emailErrors?.length)}
            aria-describedby={
              emailErrors?.length ? "email-error" : undefined
            }
            onChange={dismissEmailError}
            className="mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-[#071A17]/70 px-4 text-[#FFFDF4] outline-none transition placeholder:text-[#78947D] focus:border-[#42CDA8] focus:ring-2 focus:ring-[#42CDA8]/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[#F2C94C] aria-invalid:ring-2 aria-invalid:ring-[#F2C94C]/20"
          />

          {emailErrors?.length ? (
            <div id="email-error">
              {emailErrors.map((error) => (
                <p
                  key={error}
                  className="mt-2 text-sm font-semibold text-[#F7D96B]"
                >
                  {error}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending || requestSucceeded}
          className="min-h-12 w-full rounded-lg bg-[#F2C94C] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B302B] disabled:cursor-not-allowed disabled:bg-[#315B3E] disabled:text-[#9AB0A2] disabled:shadow-none"
        >
          {requestSucceeded
            ? "E-mail demandé"
            : pending
              ? "Envoi en cours..."
              : "Recevoir le lien"}
        </button>
      </form>
    </div>
  );
}