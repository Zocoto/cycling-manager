"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { FederationLounge } from "@/components/game/federation-lounge";
import Link from "@/components/ui/app-link";
import { getFederationNationTheme } from "@/lib/game/federation-nation-theme";
import type { FederationChatHubPayload } from "@/lib/game/federation-chat";

export function FederationMessagingPanel({ active }: { active: boolean }) {
  const [payload, setPayload] = useState<FederationChatHubPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active || payload || !loading) return;

    const controller = new AbortController();

    void fetch("/jeu/chat/federation", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as
          | FederationChatHubPayload
          | { error?: string };
        if (!response.ok || !("context" in result)) {
          throw new Error(
            "error" in result && result.error
              ? result.error
              : "Le salon fédéral est indisponible.",
          );
        }
        setPayload(result);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(
          failure instanceof Error
            ? failure.message
            : "Le salon fédéral est indisponible.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [active, loading, payload]);

  const nationTheme = useMemo(
    () => getFederationNationTheme(payload?.context.countryCode ?? ""),
    [payload?.context.countryCode],
  );

  if (loading && !payload) {
    return (
      <div
        className={`${active ? "grid" : "hidden"} min-h-0 flex-1 place-items-center bg-[#F3F8F5] px-6 text-center`}
      >
        <div>
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-4 border-[#176951]/20 border-t-[#176951]" />
          <p className="mt-4 text-sm font-black text-[#183F37]">
            Ouverture du vestiaire fédéral…
          </p>
        </div>
      </div>
    );
  }

  if (!payload || error) {
    return (
      <div
        className={`${active ? "grid" : "hidden"} min-h-0 flex-1 place-items-center bg-[#F3F8F5] px-6 text-center`}
      >
        <div className="max-w-md rounded-[1.75rem] border border-[#315B3E]/12 bg-white p-7 shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#EAF7F1] text-2xl">
            🏳
          </span>
          <p className="mt-4 text-base font-black text-[#183F37]">
            Salon fédéral indisponible
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
            {error ?? "Votre fédération n’a pas pu être identifiée."}
          </p>
          <button
            type="button"
            onClick={() => {
              setPayload(null);
              setError(null);
              setLoading(true);
            }}
            className="mt-5 rounded-xl bg-[#176951] px-4 py-2.5 text-xs font-black text-white"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${active ? "block" : "hidden"} min-h-0 flex-1`}
      style={
        {
          "--federation-primary": nationTheme.primary,
          "--federation-secondary": nationTheme.secondary,
          "--federation-accent": nationTheme.accent,
        } as CSSProperties
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-[#315B3E]/10 bg-white px-4 py-2 text-right sm:px-6">
          <Link
            href={`/jeu/federations/${payload.context.countryCode.toLowerCase()}?onglet=lounge`}
            className="text-[10px] font-black uppercase tracking-[0.1em] text-[#176951] hover:underline"
          >
            Ouvrir la fédération ↗
          </Link>
        </div>
        <div className="min-h-0 flex-1">
          <FederationLounge
            countryId={payload.context.countryId}
            countryCode={payload.context.countryCode}
            countryName={payload.context.countryName}
            currentTeamId={payload.context.teamId}
            initialMessages={payload.messages}
            initialHasMore={payload.hasMore}
            embedded
          />
        </div>
      </div>
    </div>
  );
}
