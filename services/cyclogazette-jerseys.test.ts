import { describe, expect, it, vi } from "vitest";
import { loadCyclogazetteJerseyStories } from "./cyclogazette-jerseys";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

describe("chargement au bouclage des maillots", () => {
  it("utilise une lecture unique bornée par la date de l’édition et l’heure du bouclage", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    expect(await loadCyclogazetteJerseyStories(client, "2026-10-18", new Date("2026-10-18T18:03:00Z"))).toEqual([]);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_cyclogazette_jersey_changes", { p_issue_date: "2026-10-18", p_until: "2026-10-18T18:03:00.000Z" });
  });
  it("laisse le bouclage réessayer plutôt que perdre définitivement les annonces sur erreur", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ error: { message: "temporarily unavailable" } }) } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    await expect(loadCyclogazetteJerseyStories(client, "2026-10-18", new Date())).rejects.toThrow("temporarily unavailable");
  });
});
