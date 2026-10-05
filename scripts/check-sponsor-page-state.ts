/**
 * Run the normal sponsor-page workflow for one explicitly selected player.
 * --prepare-offers acknowledges its normal writes (next-season enrollment,
 * missing offers/objectives). No fixtures, reroll, signing or budget grant.
 */
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { getSponsoringStateForAuthUser } from "../services/sponsoring-workflow";

async function main() {
  const args = process.argv.slice(2);
  const username = args[0];
  const countryIndex = args.indexOf("--require-country");
  const country = countryIndex >= 0 ? args[countryIndex + 1]?.toUpperCase() : null;
  if (!username || !args.includes("--prepare-offers")) {
    throw new Error("Usage: check-sponsor-page-state.ts USERNAME --prepare-offers [--require-country RW]");
  }
  const supabase = createSupabaseAdminClient();
  const { data: director, error } = await supabase.from("sporting_directors")
    .select("auth_user_id,username").eq("username", username).eq("status", "active")
    .single<{ auth_user_id: string; username: string }>();
  if (error || !director) throw new Error(error?.message ?? "Player not found");
  const state = await getSponsoringStateForAuthUser(director.auth_user_id);
  const future = "future" in state ? state.future : null;
  if (future?.kind === "unavailable") throw new Error("Future sponsor preparation remains unavailable");
  const offers = future?.kind === "offers" ? future.offers : [];
  if (country && !offers.some(offer => offer.sponsor.countryCode === country)) {
    throw new Error(`No open sponsor offer from ${country}`);
  }
  console.log(JSON.stringify({
    player: director.username,
    state: state.kind,
    future: future?.kind ?? null,
    offers: offers.map(offer => ({ name: offer.sponsor.name, country: offer.sponsor.countryCode, status: offer.status })),
  }));
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Sponsor-page check failed"); process.exitCode = 1; });
