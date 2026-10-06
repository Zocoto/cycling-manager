import "server-only";

import type { Database } from "sql.js";
import type { CountryRow, PcmCountryAddition, PcmExportSnapshot } from "@/lib/game/pcm-export/types";

// PCM uses sporting constants, not always ISO alpha-3. Never create a second
// Latvia/Bermuda/Switzerland etc. under their ISO code.
export const PCM_COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  ARE: "UAE", BGR: "BUL", BMU: "BER", CHE: "SWI", CHN: "CHI", CRI: "CRC",
  DEU: "GER", DNK: "DEN", GRC: "GRE", HRV: "CRO", KWT: "KUW", LVA: "LAT",
  MDA: "MOL", MYS: "MAS", NLD: "NED", PRT: "POR", ROU: "ROM", SRB: "SER",
  SVN: "SLO", SWE: "SWD", URY: "URU", ZAF: "SAR", ZWE: "ZIM",
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
  OMN: "Oman", PNG: "Papua-New-Guinea", PRK: "North-Korea", SDN: "Sudan",
  SLB: "Solomon-Islands", SLE: "Sierra-Leone", SLV: "El-Salvador", SOM: "Somalia",
  SSD: "South-Sudan", SUR: "Suriname", SWZ: "Eswatini", TCD: "Chad", TGO: "Togo",
  TJK: "Tajikistan", TKM: "Turkmenistan", TZA: "Tanzania", VUT: "Vanuatu",
  WSM: "Samoa", YEM: "Yemen", ZMB: "Zambia",
};

const LANGUAGE_LOCALES: Readonly<Record<string, string>> = {
  gene_sz_english: "en", gene_sz_french: "fr", gene_sz_spanish: "es",
  gene_sz_italian: "it", gene_sz_dutch: "nl", gene_sz_german: "de",
  gene_sz_danish: "da", gene_sz_norvegian: "no", gene_sz_portuguese: "pt",
};
type SqlRow = Record<string, string | number | Uint8Array | null>;

export function configurePcmNationalities(db: Database, local: Database, snapshot: PcmExportSnapshot) {
  const sourceById = new Map(snapshot.countries.map(c => [c.id, c]));
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
    ...snapshot.teamSeasons.map(t => t.registration_country_id || snapshot.teams.find(p => p.id === t.team_id)?.home_country_id),
  ]);
  const requiredCountries = [...requiredIds].map(id => {
    const country = id ? sourceById.get(id) : undefined;
    if (!country) throw new Error(`Pays Cyclostratège inconnu : ${id}`);
    return country;
  }).sort((a, b) => a.iso_alpha3.localeCompare(b.iso_alpha3));
  const localizationTemplate = rows(local, "SELECT * FROM LOC LIMIT 1")[0];
  if (!localizationTemplate) throw new Error("Le catalogue de noms PCM est absent.");
  let nextLocalizationId = Number(rows(local, "SELECT MAX(IDloc) AS id FROM LOC")[0].id) + 1;
  const countryAdditions: PcmCountryAddition[] = [];

  for (const source of requiredCountries) {
    const sourceCode = source.iso_alpha3.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(sourceCode)) throw new Error(`Code de pays invalide : ${sourceCode}`);
    const pcmCode = PCM_COUNTRY_ALIASES[sourceCode] ?? sourceCode;
    if (byCode.has(pcmCode)) continue;
    if (!source.iso_alpha2 || !/^[A-Z]{2}$/.test(source.iso_alpha2)) {
      throw new Error(`Code ISO alpha-2 absent ou invalide pour ${source.name}.`);
    }
    // A donor supplies only technical defaults. The new country retains its
    // own identity: no rider/team is ever assigned the donor nationality.
    const donorCode = countryDonor(source);
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
      nameRow[column] = new Intl.DisplayNames([locale], { type: "region" }).of(source.iso_alpha2) ?? source.name;
    }
    nameRow.gene_sz_french = source.name;
    insert(local, "LOC", nameRow);
    const flagName = FLAG_NAMES[pcmCode] ?? String(nameRow.gene_sz_english).replaceAll(" ", "-");
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
      gene_b_europa: source.continent_code === "europe" ? 1 : 0,
    };
    insert(db, "STA_region", region);
    regionsByCountry.set(countryId, region);
    countryAdditions.push({ sourceCode, sourceName: source.name, pcmCode, countryId, regionId, localizationId, flagName });
  }

  // Native PCM's Saudi flag key is case-sensitive.
  db.run("UPDATE STA_country SET gene_sz_flag = 'Saudi-Arabia' WHERE CONSTANT = 'SAU' AND gene_sz_flag = 'Saudi-arabia'");
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
  return { resolveCountry, countryAdditions, pcmCountryByConstant: byCode, firstRegionByCountry: new Map([...regionsByCountry].map(([id, r]) => [id, Number(r.IDregion)])) };
}

export function getPcmNationalChampionBits(snapshot: PcmExportSnapshot) {
  const riders = new Map(snapshot.riders.map(r => [r.id, r]));
  const bits = new Map<string, number>();
  for (const title of snapshot.nationalChampionshipTitles ?? []) {
    const rider = riders.get(title.rider_id);
    if (!rider) continue;
    if (rider.country_id !== title.country_id) {
      throw new Error(`Titre national incohérent avec le pays de ${rider.first_name} ${rider.last_name}.`);
    }
    if (title.championship_type !== "road" && title.championship_type !== "time_trial") {
      throw new Error("Discipline de titre national PCM invalide.");
    }
    // PCM26: national road = 128, national TT = 64 (not the legacy 32 bit).
    bits.set(rider.id, (bits.get(rider.id) ?? 0) | (title.championship_type === "road" ? 128 : 64));
  }
  const values = [...bits.values()];
  return { bits, counts: {
    riders: bits.size, road: values.filter(v => v & 128).length,
    timeTrial: values.filter(v => v & 64).length, both: values.filter(v => v === 192).length,
  } };
}

function countryDonor(source: CountryRow) {
  switch (source.continent_code) {
    case "africa": return "KEN";
    case "asia": return "KAZ";
    case "europe": return "FRA";
    case "oceania": return "AUS";
    case "south_america": return "COL";
    case "north_america": return "USA";
    case "america": return source.iso_alpha3 === "SUR" ? "COL" : "USA";
    default: throw new Error(`Continent inconnu pour ${source.name}.`);
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
