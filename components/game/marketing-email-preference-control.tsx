"use client";

import { useEffect, useRef, useState } from "react";

type PreferenceState = "idle" | "loading" | "ready" | "error";

export function MarketingEmailPreferenceControl({
  active,
  isEnglish = false,
}: {
  active: boolean;
  isEnglish?: boolean;
}) {
  const [state, setState] = useState<PreferenceState>("idle");
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!active || initializedRef.current) return;

    let cancelled = false;
    initializedRef.current = true;
    setState("loading");

    void fetch("/api/account/marketing-email-preference", {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          enabled?: boolean;
          error?: string;
        };
        if (!response.ok || typeof payload.enabled !== "boolean") {
          throw new Error(payload.error || "Préférence indisponible.");
        }
        if (cancelled) return;
        setEnabled(payload.enabled);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
        setMessage(
          isEnglish
            ? "This preference is temporarily unavailable."
            : "Cette préférence est temporairement indisponible.",
        );
      });

    return () => {
      cancelled = true;
      initializedRef.current = false;
    };
  }, [active, isEnglish]);

  async function updatePreference() {
    if (state !== "ready") return;

    const nextEnabled = !enabled;
    setState("loading");
    setMessage(null);

    try {
      const response = await fetch(
        "/api/account/marketing-email-preference",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: nextEnabled }),
        },
      );
      const payload = (await response.json()) as {
        enabled?: boolean;
        error?: string;
      };
      if (!response.ok || typeof payload.enabled !== "boolean") {
        throw new Error(payload.error || "Mise à jour impossible.");
      }

      setEnabled(payload.enabled);
      setState("ready");
      setMessage(
        payload.enabled
          ? isEnglish
            ? "News emails enabled."
            : "E-mails d’actualité activés."
          : isEnglish
            ? "News emails disabled."
            : "E-mails d’actualité désactivés.",
      );
    } catch {
      setState("error");
      setMessage(
        isEnglish
          ? "The preference could not be updated. Please try again."
          : "La préférence n’a pas pu être mise à jour. Réessayez.",
      );
    }
  }

  const busy = state === "loading";
  const available = state === "ready";
  const statusLabel =
    state === "idle" || state === "loading"
      ? isEnglish
        ? "Checking…"
        : "Vérification…"
      : state === "error"
        ? isEnglish
          ? "Unavailable"
          : "Indisponible"
        : enabled
          ? isEnglish
            ? "Enabled"
            : "Activés"
          : isEnglish
            ? "Disabled"
            : "Désactivés";
  const toggleLabel = enabled
    ? isEnglish
      ? "Unsubscribe from Cyclo Stratège news emails"
      : "Se désinscrire des e-mails d’actualité de Cyclo Stratège"
    : isEnglish
      ? "Subscribe to Cyclo Stratège news emails"
      : "S’inscrire aux e-mails d’actualité de Cyclo Stratège";

  return (
    <div
      data-user-menu-email-updates="true"
      className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-3"
    >
      <div className="flex items-center gap-3">
        <span
          className={
            "relative grid h-9 w-9 shrink-0 place-items-center rounded-lg " +
            (enabled
              ? "bg-[#176951] text-[#C8F3DD]"
              : "bg-[#1B463C] text-[#9BE0CA]")
          }
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-5 w-5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
            <path d="m4 6 6 4.5L16 6" />
          </svg>
          {enabled ? (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full border border-[#176951] bg-[#F2C94C]" />
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">
            {isEnglish ? "News emails" : "E-mails d’actualité"}
          </span>
          <span className="mt-0.5 block text-[10px] font-semibold text-[#B9CBC4]">
            {isEnglish
              ? "Major Cyclo Stratège updates"
              : "Nouveautés majeures de Cyclo Stratège"}
          </span>
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={toggleLabel}
          title={toggleLabel}
          disabled={!available || busy}
          onClick={() => void updatePreference()}
          className="group inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-white/12 bg-black/20 py-1 pl-2.5 pr-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] disabled:cursor-wait disabled:opacity-60"
        >
          <span>{statusLabel}</span>
          <span
            aria-hidden="true"
            className={
              "relative h-5 w-9 rounded-full transition " +
              (enabled ? "bg-[#42B99A]" : "bg-[#6F827B]")
            }
          >
            <span
              className={
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition " +
                (enabled ? "left-[1.125rem]" : "left-0.5")
              }
            />
          </span>
        </button>
      </div>

      {message ? (
        <p
          aria-live="polite"
          className={
            "mt-2 text-[10px] font-semibold leading-4 " +
            (state === "error" ? "text-[#F2B8BD]" : "text-[#B9CBC4]")
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
