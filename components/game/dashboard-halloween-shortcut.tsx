import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export async function DashboardHalloweenShortcut() {
  let visible = false;
  try {
    // PostgreSQL evaluates "now": the banner and mutations share the same clock.
    const {data,error}=await createSupabaseAdminClient().from("halloween_editions").select("id").eq("id","halloween-2026").eq("enabled",true).lte("starts_at","now").gt("shop_ends_at","now").maybeSingle();
    visible=!error && !!data;
  } catch {return null;}
  if (!visible) return null;
  return <Link href="/jeu/halloween" prefetch={false} className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#CF985F]/50 bg-[#302833] px-5 py-4 text-[#F5E5C9] shadow-sm"><div><span className="text-xs font-bold uppercase tracking-widest text-[#E9AC6F]">Halloween · événement spécial</span><p className="mt-1 font-semibold">Le peloton de minuit vous attend.</p></div><span className="rounded-full bg-[#D97B3E] px-4 py-2 text-sm font-bold text-[#241D26]">Jeux & boutique →</span></Link>;
}
