"use client";

import { useEffect, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function FederationHostingResultViewMarker({
  editionId,
  isJunior = false,
}: {
  editionId: string;
  isJunior?: boolean;
}) {
  const view = useRef<{ key: string; pending: boolean; recorded: boolean } | null>(null);

  useEffect(() => {
    const resultKey = `${isJunior}:${editionId}`;
    if (view.current?.key !== resultKey) {
      view.current = { key: resultKey, pending: false, recorded: false };
    }
    const currentView = view.current;

    function recordVisibleResult() {
      if (document.visibilityState !== "visible" || currentView.pending || currentView.recorded) return;

      currentView.pending = true;
      void (async () => {
        try {
          const { data } = await createSupabaseBrowserClient().rpc("record_current_federation_hosting_result_view", {
            p_edition_id: editionId,
            p_is_junior: isJunior,
          });
          currentView.recorded = data === true;
        } catch {
          // Reader tracking must not interrupt access to race results.
        } finally {
          currentView.pending = false;
        }
      })();
    }

    document.addEventListener("visibilitychange", recordVisibleResult);
    recordVisibleResult();
    return () => document.removeEventListener("visibilitychange", recordVisibleResult);
  }, [editionId, isJunior]);

  return null;
}
