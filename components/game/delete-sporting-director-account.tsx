"use client";

import {
  type MouseEvent,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  deleteSportingDirectorAccount,
  type AccountDeletionState,
} from "@/app/jeu/directeur-sportif/actions";
import { ACCOUNT_DELETION_CONFIRMATION } from "@/lib/account-deletion";

const INITIAL_STATE: AccountDeletionState = {
  status: "idle",
  message: null,
};

export function DeleteSportingDirectorAccount({
  displayName,
  teamName,
}: {
  displayName: string;
  teamName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] =
    useState("");
  const [state, formAction, pending] =
    useActionState(
      deleteSportingDirectorAccount,
      INITIAL_STATE
    );
  const inputRef = useRef<HTMLInputElement>(null);
  const isConfirmed =
    confirmation === ACCOUNT_DELETION_CONFIRMATION;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isOpen, pending]);

  function closeOnBackdrop(
    event: MouseEvent<HTMLDivElement>
  ) {
    if (
      event.target === event.currentTarget &&
      !pending
    ) {
      setIsOpen(false);
    }
  }

  return (
    <section className="rounded-2xl border border-red-300/70 bg-red-50 p-6 shadow-[0_18px_45px_rgba(127,29,29,0.08)] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-red-700">
            Zone dangereuse
          </p>
          <h2 className="mt-2 text-2xl font-black text-red-950">
            Supprimer mon compte
          </h2>
          <p className="mt-3 leading-7 text-red-900/75">
            Cette action supprime définitivement votre Directeur Sportif et son équipe. Elle ne peut pas être annulée.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
        >
          Supprimer mon compte
        </button>
      </div>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onMouseDown={closeOnBackdrop}
          className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-[#071A17]/80 p-4 backdrop-blur-sm"
        >
          <article className="relative w-full max-w-2xl rounded-2xl border border-red-200 bg-white p-6 text-[#082A2A] shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={pending}
              aria-label="Fermer la confirmation"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-[#EAF5F3] text-xl font-black text-[#0B302B] transition hover:bg-[#D7EEE8] disabled:cursor-wait disabled:opacity-50"
            >
              ×
            </button>

            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700">
              Confirmation définitive
            </p>
            <h2
              id="delete-account-title"
              className="mt-3 pr-12 text-2xl font-black text-red-950 sm:text-3xl"
            >
              Supprimer la carrière de {displayName} ?
            </h2>

            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-black text-red-950">
                Seront définitivement supprimés :
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-semibold leading-6 text-red-900/80">
                <li>le compte de connexion et le profil du Directeur Sportif ;</li>
                <li>{teamName}, ses contrats et ses inscriptions aux courses ;</li>
                <li>les offres et objectifs de sponsoring propres à cette carrière.</li>
              </ul>

              <p className="mt-5 text-sm font-black text-emerald-900">
                Seront conservés :
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-semibold leading-6 text-emerald-900/80">
                <li>les coureurs, qui deviendront agents libres ;</li>
                <li>le sponsor, qui redeviendra disponible pour les autres équipes.</li>
              </ul>
            </div>

            <form action={formAction} className="mt-6">
              <label
                htmlFor="account-deletion-confirmation"
                className="block text-sm font-black text-[#0B302B]"
              >
                Saisissez {" "}
                <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-800">
                  {ACCOUNT_DELETION_CONFIRMATION}
                </span>{" "}
                pour confirmer
              </label>
              <input
                ref={inputRef}
                id="account-deletion-confirmation"
                name="confirmation"
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(event.target.value)
                }
                autoComplete="off"
                spellCheck={false}
                disabled={pending}
                className="mt-3 min-h-12 w-full rounded-xl border border-[#315B3E]/25 bg-white px-4 py-3 font-mono font-black text-[#0B302B] outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200 disabled:cursor-wait disabled:bg-slate-100"
              />

              {state.status === "error" &&
              state.message ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-900"
                >
                  {state.message}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={pending}
                  className="min-h-12 rounded-xl border border-[#315B3E]/25 px-5 py-3 text-sm font-black text-[#315B3E] transition hover:bg-[#EAF5F3] disabled:cursor-wait disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!isConfirmed || pending}
                  className="min-h-12 rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending
                    ? "Suppression en cours…"
                    : "Supprimer définitivement"}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}
    </section>
  );
}
