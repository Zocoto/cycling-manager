import "server-only";

import type { Database } from "sql.js";
import workshopGraphics from "@/data/pcm-workshop-graphics.json";
import type {
  CountryRow,
  PcmCountryAddition,
  PcmCountryFlag,
  PcmExportSnapshot,
} from "@/lib/game/pcm-export/types";
import { PCM_CHAMPIONSHIP_MASKS } from "@/lib/game/pcm-export/types";

// PCM uses sporting constants, not always ISO alpha-3. Never create a second
// Latvia/Bermuda/Switzerland etc. under their ISO code.
export const PCM_COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  ARE: "UAE", BGR: "BUL", BMU: "BER", CHE: "SWI", CHN: "CHI", CRI: "CRC",
  DEU: "GER", DNK: "DEN", GRC: "GRE", HRV: "CRO", KWT: "KUW", LVA: "LAT",
  MDA: "MOL", MYS: "MAS", NLD: "NED", OMN: "OMA", PRT: "POR", ROU: "ROM",
  SRB: "SER", SVN: "SLO", SWE: "SWD", URY: "URU", XKX: "KOS", ZAF: "SAR",
  ZWE: "ZIM",
};

// These exact keys are installed in Cyclostratège's four native GUI atlases.
// Do not derive them from translated names/ICU: labels can change across runtimes.
const FLAG_NAMES: Readonly<Record<string, string>> = {
  AFG: "Afghanistan", BDI: "Burundi", BGD: "Bangladesh", BRB: "Barbados",
  BTN: "Bhutan", BWA: "Botswana", CAF: "Central-African-Republic",
  COG: "Congo---Brazzaville", CPV: "Cape-Verde", DJI: "Djibouti", FJI: "Fiji",
  GIN: "Guinea", GMB: "Gambia", GNB: "Guinea-Bissau", GNQ: "Equatorial-Guinea",
  HTI: "Haiti", JOR: "Jordan", LBN: "Lebanon", LBR: "Liberia", LBY: "Libya",
  MDG: "Madagascar", MDV: "Maldives", MMR: "Myanmar-(Burma)", MOZ: "Mozambique",
  MRT: "Mauritania", MWI: "Malawi", NER: "Niger", NIC: "Nicaragua", NPL: "Nepal",
  PNG: "Papua-New-Guinea", PRK: "North-Korea", SDN: "Sudan",
  SLB: "Solomon-Islands", SLE: "Sierra-Leone", SLV: "El-Salvador", SOM: "Somalia",
  SSD: "South-Sudan", SUR: "Suriname", SWZ: "Eswatini", TCD: "Chad", TGO: "Togo",
  TJK: "Tajikistan", TKM: "Turkmenistan", TZA: "Tanzania", VUT: "Vanuatu",
  WSM: "Samoa", YEM: "Yemen", ZMB: "Zambia",
};

const WORKSHOP_FLAG_KEYS = new Set<string>(workshopGraphics.flagKeys);
const SOUTH_AMERICA = new Set(["FLK", "GUF", "SUR"]);
const NORTHERN_AMERICA = new Set(["GRL", "SPM"]);
const NORTH_AFRICA = new Set(["ESH", "LBY", "SDN"]);
const SOUTH_ASIA = new Set(["AFG", "BGD", "BTN", "MDV", "NPL"]);
const WEST_ASIA = new Set(["JOR", "LBN", "YEM"]);

const LANGUAGE_LOCALES: Readonly<Record<string, string>> = {
  gene_sz_english: "en", gene_sz_french: "fr", gene_sz_spanish: "es",
  gene_sz_italian: "it", gene_sz_dutch: "nl", gene_sz_german: "de",
  gene_sz_danish: "da", gene_sz_norvegian: "no", gene_sz_portuguese: "pt",
};
type SqlRow = Record<string, string | number | Uint8Array | null>;

export function configurePcmNationalities(
  db: Database,
  local: Database,
  snapshot: Pick<PcmExportSnapshot, "countries" | "riders" | "teams" | "teamSeasons">,
) {
  const sourceById = new Map(snapshot.countries.map(c => [c.id, c]));
  const teamsById = new Map(snapshot.teams.map(t => [t.id, t]));
  const countryRows = rows(db, "SELECT * FROM STA_country ORDER BY IDcountry");
  const byCode = new Map(countryRows.map(c => [String(c.CONSTANT).toUpperCase(), c]));
  const usedIds = new Set(countryRows.map(c => Number(c.IDcountry)));
  const regionRows = rows(db, "SELECT * FROM STA_region ORDER BY IDregion");
  const usedRegions = new Set(regionRows.map(r => Number(r.IDregion)));
  const regionsByCountry = new Map<number, SqlRow>();
  for (const region of regionRows) if (!regionsByCountry.has(Number(region.fkIDcountry))) {
    regionsByCountry.set(Number(region.fkIDcountry), region);
  }
  const requiredIds = new Set([
    ...snapshot.riders.map(r => r.country_id),
    ...snapshot.teamSeasons.map(t => t.registration_country_id || teamsById.get(t.team_id)?.home_country_id),
  ]);
  const requiredCountries = [...requiredIds].map(id => {
    const country = id ? sourceById.get(id) : undefined;
    if (!country) throw new Error(`Pays Cyclostratège inconnu : ${id}`);
    return country;
  }).map(source => {
    const sourceCode = source.iso_alpha3.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(sourceCode)) throw new Error(`Code de pays invalide : ${sourceCode}`);
    return { source, sourceCode, pcmCode: PCM_COUNTRY_ALIASES[sourceCode] ?? sourceCode };
  }).sort((a, b) => a.sourceCode.localeCompare(b.sourceCode));
  const localizationTemplate = rows(local, "SELECT * FROM LOC LIMIT 1")[0];
  if (!localizationTemplate) throw new Error("Le catalogue de noms PCM est absent.");
  let nextLocalizationId = Number(rows(local, "SELECT MAX(IDloc) AS id FROM LOC")[0].id) + 1;
  const localizedCountries = new Map(
    rows(local, "SELECT IDloc, gene_sz_english, gene_sz_french FROM LOC")
      .map(row => [Number(row.IDloc), row]),
  );
  const requiredPcmCodes = new Set<string>();
  const countryAdditions: PcmCountryAddition[] = [];

  for (const { source, sourceCode, pcmCode } of requiredCountries) {
    if (requiredPcmCodes.has(pcmCode)) {
      throw new Error(`Identité de pays PCM en double : ${sourceCode} → ${pcmCode}.`);
    }
    requiredPcmCodes.add(pcmCode);
    if (byCode.has(pcmCode)) continue;
    const isoAlpha2 = source.iso_alpha2?.trim().toUpperCase();
    if (!isoAlpha2 || !/^[A-Z]{2}$/.test(isoAlpha2)) {
      throw new Error(`Code ISO alpha-2 absent ou invalide pour ${source.name}.`);
    }
    // A donor supplies only technical defaults. The new country retains its
    // own identity: no rider/team is ever assigned the donor nationality.
    const donorCode = countryDonor(source.continent_code, sourceCode, source.name);
    const donor = byCode.get(donorCode);
    const regionTemplate = donor && regionsByCountry.get(Number(donor.IDcountry));
    if (!donor || !regionTemplate) throw new Error(`Gabarit de pays PCM absent : ${donorCode}`);
    let countryId = 2;
    while (usedIds.has(countryId)) countryId++;
    if (countryId > 255) throw new Error("La limite des 255 identifiants de pays PCM est atteinte.");
    usedIds.add(countryId);
    const localizationId = nextLocalizationId++;
    const nameRow: SqlRow = { ...localizationTemplate, IDloc: localizationId, CONSTANT: pcmCode };
    for (const [column, locale] of Object.entries(LANGUAGE_LOCALES)) {
      nameRow[column] = new Intl.DisplayNames([locale], { type: "region", fallback: "none" })
        .of(isoAlpha2) ?? source.name;
    }
    nameRow.gene_sz_french = source.name;
    insert(local, "LOC", nameRow);
    localizedCountries.set(localizationId, nameRow);
    // Keep a predictable asset key even before a country has a cooked PCM sprite.
    const flagName = FLAG_NAMES[pcmCode] ?? pcmCode;
    const country: SqlRow = {
      ...donor, IDcountry: countryId, CONSTANT: pcmCode, fkIDnational_team: 0,
      gene_ilist_neighbours: "()", gene_sz_flag: flagName, gene_strID_country_name: localizationId,
    };
    for (const column of Object.keys(country)) if (/^gene_i_num_cyclist_/.test(column)) country[column] = 0;
    insert(db, "STA_country", country);
    byCode.set(pcmCode, country);
    let regionId = countryId * 100 + 1;
    while (usedRegions.has(regionId)) regionId++;
    usedRegions.add(regionId);
    const region: SqlRow = {
      ...regionTemplate, IDregion: regionId, CONSTANT: pcmCode,
      gene_strID_name: localizationId, fkIDcountry: countryId,
      gene_b_europa: donor.fkIDcontinent === 1 ? 1 : 0,
    };
    insert(db, "STA_region", region);
    regionsByCountry.set(countryId, region);
    countryAdditions.push({ sourceCode, sourceName: source.name, pcmCode, countryId, regionId, localizationId, flagName });
  }

  // Native PCM's Saudi flag key is case-sensitive.
  db.run("UPDATE STA_country SET gene_sz_flag = 'Saudi-Arabia' WHERE CONSTANT = 'SAU' AND gene_sz_flag = 'Saudi-arabia'");
  const saudiArabia = byCode.get("SAU");
  if (saudiArabia?.gene_sz_flag === "Saudi-arabia") saudiArabia.gene_sz_flag = "Saudi-Arabia";
  const resolveCountry = (id: string) => {
    const source = sourceById.get(id);
    if (!source) throw new Error(`Pays Cyclostratège inconnu : ${id}`);
    const sourceCode = source.iso_alpha3.trim().toUpperCase();
    const pcmCode = PCM_COUNTRY_ALIASES[sourceCode] ?? sourceCode;
    const country = byCode.get(pcmCode);
    const region = country && regionsByCountry.get(Number(country.IDcountry));
    if (!country || !region) throw new Error(`Pays ou région PCM absent : ${source.name}`);
    return { countryId: Number(country.IDcountry), regionId: Number(region.IDregion), pcmCode };
  };
  requiredPcmCodes.add("FRA"); // Pays de l'équipe de simulation.
  const addedPcmCodes = new Set(countryAdditions.map(country => country.pcmCode));
  const countryFlags: PcmCountryFlag[] = [...requiredPcmCodes].sort().map(pcmCode => {
    const country = byCode.get(pcmCode);
    const region = country && regionsByCountry.get(Number(country.IDcountry));
    const countryName = country && localizedCountries.get(Number(country.gene_strID_country_name));
    const regionName = region && localizedCountries.get(Number(region.gene_strID_name));
    if (!countryName?.gene_sz_english || !countryName.gene_sz_french || !regionName?.gene_sz_english || !regionName.gene_sz_french) {
      throw new Error(`Pays ou région sans traduction PCM : ${pcmCode}.`);
    }
    const flagName = String(country?.gene_sz_flag ?? "");
    return {
      pcmCode,
      flagName,
      source: WORKSHOP_FLAG_KEYS.has(flagName)
        ? addedPcmCodes.has(pcmCode) ? "workshop" : "native"
        : "missing",
    };
  });
  return {
    resolveCountry,
    countryAdditions,
    countryFlags,
    pcmCountryByConstant: byCode,
    firstRegionByCountry: new Map([...regionsByCountry].map(([id, region]) => [id, Number(region.IDregion)])),
  };
}

export function getPcmChampionBits(snapshot: PcmExportSnapshot) {
  const riders = new Map(snapshot.riders.map(r => [r.id, r]));
  const bits = new Map<string, number>();
  for (const title of snapshot.nationalChampionshipTitles ?? []) {
    const rider = riders.get(title.rider_id);
    if (!rider) continue;
    const mask = PCM_CHAMPIONSHIP_MASKS[title.championship_type];
    if (!mask) throw new Error("Type de titre PCM non pris en charge.");
    const national = title.championship_type === "road" || title.championship_type === "time_trial";
    if (national && rider.country_id !== title.country_id) {
      throw new Error(`Titre national incohérent avec le pays de ${rider.first_name} ${rider.last_name}.`);
    }
    bits.set(rider.id, (bits.get(rider.id) ?? 0) | mask);
  }
  const values = [...bits.values()];
  const nationalValues = values.filter(v => v & 192);
  const internationalCounts = {
    worldRoad: values.filter(v => v & 2048).length,
    worldTimeTrial: values.filter(v => v & 1024).length,
    europeanRoad: values.filter(v => v & 512).length,
    europeanTimeTrial: values.filter(v => v & 256).length,
  };
  // CDB stores this bit field as a signed 12-bit integer. Preserve combined
  // national/world flags and encode explicitly rather than relying on overflow.
  for (const [riderId, value] of bits) {
    bits.set(riderId, value >= 2048 ? value - 4096 : value);
  }
  return { bits, counts: {
    riders: nationalValues.length, road: nationalValues.filter(v => v & 128).length,
    timeTrial: nationalValues.filter(v => v & 64).length,
    both: nationalValues.filter(v => (v & 192) === 192).length,
  }, internationalCounts };
}

function countryDonor(continent: CountryRow["continent_code"], isoAlpha3: string, name: string) {
  switch (continent) {
    case "africa": return NORTH_AFRICA.has(isoAlpha3) ? "DZA" : "KEN";
    case "asia":
      if (SOUTH_ASIA.has(isoAlpha3)) return "IND";
      if (WEST_ASIA.has(isoAlpha3)) return "OMA";
      if (isoAlpha3 === "MMR") return "THA";
      if (isoAlpha3 === "PRK") return "KOR";
      return "KAZ";
    case "europe": return "CZE";
    case "oceania": return "AUS";
    case "south_america": return "BRA";
    case "north_america": return "USA";
    case "america":
      if (SOUTH_AMERICA.has(isoAlpha3)) return "BRA";
      if (NORTHERN_AMERICA.has(isoAlpha3)) return "CAN";
      // PCM groups Central America and the Caribbean in the same territory.
      return "CRC";
    default: throw new Error(`Continent inconnu pour ${name}.`);
  }
}
function rows(db: Database, sql: string): SqlRow[] {
  const result = db.exec(sql)[0];
  return result ? result.values.map(row => Object.fromEntries(result.columns.map((column, i) => [column, row[i]]))) : [];
}
function insert(db: Database, table: string, row: SqlRow) {
  const columns = Object.keys(row);
  db.run(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`, columns.map(c => row[c]));
}
