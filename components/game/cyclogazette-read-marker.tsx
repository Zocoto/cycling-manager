"use client";

import { useEffect } from "react";

import { notifyCyclogazetteRead } from "@/lib/game/cyclogazette-read-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function CyclogazetteReadMarker({ editionId }: { editionId: string }) {
  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function markLatestEditionRead() {
      const { error } = await supabase.rpc("mark_cyclogazette_read", {
        p_edition_id: editionId,
      });
      if (active && !error) notifyCyclogazetteRead();
    }

    void markLatestEditionRead();
    return () => {
      active = false;
    };
  }, [editionId]);

  return null;
}
