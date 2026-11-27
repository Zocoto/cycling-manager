// Offline, deterministic migration metadata. This script never reads credentials
// or invokes a service/database; approved existing logos and jerseys are reused.
import { readFileSync, writeFileSync } from "node:fs";
import { SPONSORS } from "../data/sponsors";

const migration = new URL("../supabase/migrations/20261127180000_use_canonical_secondary_sponsor_library.sql", import.meta.url);
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const names = new Set<string>();
const keys = new Set<string>();
const rows = [...SPONSORS].sort((a,b) => a.id.localeCompare(b.id)).map(sponsor => {
  const name = sponsor.name.trim().toLowerCase();
  if (!name || names.has(name) || keys.has(sponsor.id) || !/^[A-Z]{2}$/.test(sponsor.countryCode)
    || !/^#[0-9A-Fa-f]{6}$/.test(sponsor.colors.primary) || !/^#[0-9A-Fa-f]{6}$/.test(sponsor.colors.accent)
    || !sponsor.logoPath.startsWith("/images/sponsors/")) throw Error(`Invalid or duplicate library identity: ${sponsor.id}`);
  names.add(name); keys.add(sponsor.id);
  return `(${[sponsor.id,sponsor.name,sponsor.countryCode].map(quote).join(",")},${sponsor.prestige},${quote(sponsor.colors.primary)},${quote(sponsor.colors.accent)})`;
});
const snapshot = "-- BEGIN REVIEWED LIBRARY SNAPSHOT\n"
  + "insert into secondary_library_snapshot(catalog_key,name,country_code,prestige,primary_color,accent_color) values\n"
  + rows.join(",\n") + ";\n-- END REVIEWED LIBRARY SNAPSHOT";
const source = readFileSync(migration,"utf8").replaceAll("\r\n","\n");
if (!source.includes("-- BEGIN REVIEWED LIBRARY SNAPSHOT\n") || !source.includes("-- END REVIEWED LIBRARY SNAPSHOT")) throw Error("Missing reviewed snapshot markers");
const originalRpcMigration=readFileSync(new URL("../supabase/migrations/20261127130000_rebalance_secondary_sponsor_objectives.sql",import.meta.url),"utf8").replaceAll("\r\n","\n");
const rpcStart=originalRpcMigration.indexOf("create or replace function public.replace_secondary_sponsor_offers(");
const rpcEnd=originalRpcMigration.indexOf("\nrevoke all on function public.replace_secondary_sponsor_offers",rpcStart);
if (rpcStart<0 || rpcEnd<0) throw Error("Original secondary offer validator is unavailable");
const originalCompleteness="if (select count(*) from public.secondary_sponsor_offers where sporting_director_id=p_director_id\n"
  +"    and team_id=p_team_id and target_season_id=p_target_season_id and status='open' and generation_version>=2)=3 then return false; end if;";
const newCompleteness="if (select count(*) from public.secondary_sponsor_offers offer\n"
  +"    join public.secondary_sponsor_catalog sponsor on sponsor.id=offer.secondary_sponsor_id\n"
  +"    join public.sponsors source on source.id=sponsor.source_sponsor_id\n"
  +"    where offer.sporting_director_id=p_director_id and offer.team_id=p_team_id\n"
  +"      and offer.target_season_id=p_target_season_id and offer.status='open' and offer.generation_version>=3\n"
  +"      and sponsor.available_for_offers and source.status='active' and sponsor.country_id=source.country_id\n"
  +"      and source.id is distinct from private.secondary_sponsor_primary_source(p_team_id,p_target_season_id)\n"
  +"      and (select count(*) from public.secondary_sponsor_objectives objective where objective.offer_id=offer.id)\n"
  +"        >=case when sponsor.prestige>=5 then 5 when sponsor.prestige>=3 then 4 else 3 end)=3 then return false; end if;";
const originalRpc=originalRpcMigration.slice(rpcStart,rpcEnd);
if (!originalRpc.includes(originalCompleteness)) throw Error("Original completeness guard changed; review required");
const libraryRpc=originalRpc.replace("public.replace_secondary_sponsor_offers(","private.replace_secondary_sponsor_offers_uncapped(").replace(originalCompleteness,newCompleteness);
const rpcSnapshot="-- BEGIN REVIEWED LIBRARY COMPLETENESS GUARD\n"+libraryRpc+"\n-- END REVIEWED LIBRARY COMPLETENESS GUARD";
const next = source.replace(/-- BEGIN REVIEWED LIBRARY SNAPSHOT\n[\s\S]*?-- END REVIEWED LIBRARY SNAPSHOT/,()=>snapshot)
  .replace(/-- BEGIN REVIEWED LIBRARY COMPLETENESS GUARD\n[\s\S]*?-- END REVIEWED LIBRARY COMPLETENESS GUARD/,()=>rpcSnapshot);
if (process.argv.includes("--check")) {
  if (source !== next) throw Error("Secondary sponsor library snapshot differs from the existing sponsor library");
} else writeFileSync(migration,next,"utf8");
console.log(JSON.stringify({offline:true,sponsors:rows.length,countries:new Set(SPONSORS.map(s=>s.countryCode)).size,checked:process.argv.includes("--check")}));
