import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { cdbToSql, sqlToCdb } from "cdb-converter";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

import { createUniqueTeamCodes } from "@/lib/game/pcm-export/identifiers";
import { convertRiderRatings } from "@/lib/game/pcm-export/ratings";
import type {
  PcmExportResult,
  PcmExportSnapshot,
} from "@/lib/game/pcm-export/types";

const TEMPLATE_PATH = join(
  process.cwd(),
  "assets",
  "pcm",
  "OfficialRelease.template.cdb",
);
const EXPECTED_TEMPLATE_SHA256 =
  "f305b1700a797b46f4e0fc7cc19b4dce006119b4081db25b0b20b972839f1d14";

const COUNTRY_ALIASES: Record<string, string> = {
  ARE: "UAE",
  BGR: "BUL",
  CHE: "SWI",
  CHN: "CHI",
  CRI: "CRC",
  DEU: "GER",
  DNK: "DEN",
  GRC: "GRE",
  HRV: "CRO",
  KWT: "KUW",
  MDA: "MOL",
  MYS: "MAS",
  NLD: "NED",
  PRT: "POR",
  ROU: "ROM",
  SRB: "SER",
  SVN: "SLO",
  SWE: "SWD",
  URY: "URU",
  ZAF: "SAR",
  ZWE: "ZIM",
};

const CONTINENT_FALLBACKS: Record<string, string> = {
  africa: "KEN",
  asia: "KAZ",
  europe: "FRA",
  north_america: "USA",
  south_america: "COL",
  oceania: "AUS",
};

const RATING_COLUMNS = [
  "charac_i_mountain",
  "charac_i_hill",
  "charac_i_plain",
  "charac_i_timetrial",
  "charac_i_cobble",
  "charac_i_sprint",
  "charac_i_acceleration",
  "charac_i_downhilling",
  "charac_i_endurance",
  "charac_i_resistance",
  "charac_i_recuperation",
  "charac_i_baroudeur",
  "charac_i_prologue",
] as const;

const SPECTATOR_RIDER_COUNT = 10;
const SPECTATOR_PCM_RATING = 65;
const SPECTATOR_TEAM_ID = 243;

type SqlValue = string | number | Uint8Array | null;
type SqlRow = Record<string, SqlValue>;

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
let templatePromise: Promise<Uint8Array> | null = null;

export async function buildPcmDatabase(
  snapshot: PcmExportSnapshot,
  templateOverride?: Uint8Array,
): Promise<PcmExportResult> {
  if (snapshot.ratingPolicy.bonusesIncluded !== false) {
    throw new Error("L'export PCM doit utiliser exclusivement les notes natives.");
  }

  const [SQL, template] = await Promise.all([
    getSqlJs(),
    templateOverride ? Promise.resolve(templateOverride) : getTemplate(),
  ]);
  const templateSha256 = createHash("sha256").update(template).digest("hex");
  if (templateSha256 !== EXPECTED_TEMPLATE_SHA256) {
    throw new Error(
      "Le gabarit PCM26 officiel a ete modifie : export interrompu avant generation.",
    );
  }
  const db = cdbToSql(template, SQL, { preciseTypes: true });

  try {
    return buildDatabaseFromSnapshot(db, snapshot);
  } finally {
    db.close();
  }
}

async function getSqlJs() {
  sqlJsPromise ??= initSqlJs({
    locateFile: () =>
      join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
  });
  return sqlJsPromise;
}

async function getTemplate() {
  templatePromise ??= readFile(TEMPLATE_PATH);
  return templatePromise;
}

function buildDatabaseFromSnapshot(
  db: Database,
  snapshot: PcmExportSnapshot,
): PcmExportResult {
  const sourceStageCount = Number(
    queryValue(db, "SELECT COUNT(*) FROM STA_stage"),
  );
  const existingCsRows = Number(
    queryValue(db, "SELECT COUNT(*) FROM DYN_team WHERE CONSTANT LIKE 'CS_%'"),
  );
  if (existingCsRows !== 0) {
    throw new Error("Le gabarit PCM contient deja des equipes Cyclostratege.");
  }

  const countriesById = new Map(
    snapshot.countries.map((row) => [row.id, row]),
  );
  const divisionsById = new Map(
    snapshot.divisions.map((row) => [row.id, row]),
  );
  const teamsById = new Map(snapshot.teams.map((row) => [row.id, row]));
  const seasonsById = new Map(snapshot.seasons.map((row) => [row.id, row]));
  const contractsByRider = new Map(
    snapshot.contracts.map((row) => [row.rider_id, row]),
  );
  const ratingsByRider = new Map(
    snapshot.ratings.map((row) => [row.rider_id, row]),
  );

  const pcmCountries = queryRows(
    db,
    "SELECT IDcountry, CONSTANT, gene_sz_flag FROM STA_country ORDER BY IDcountry",
  );
  const pcmCountryByConstant = new Map(
    pcmCountries.map((row) => [String(row.CONSTANT).toUpperCase(), row]),
  );
  const pcmRegions = queryRows(
    db,
    "SELECT IDregion, fkIDcountry FROM STA_region ORDER BY IDregion",
  );
  const firstRegionByCountry = new Map<number, number>();
  for (const region of pcmRegions) {
    const countryId = Number(region.fkIDcountry);
    if (!firstRegionByCountry.has(countryId)) {
      firstRegionByCountry.set(countryId, Number(region.IDregion));
    }
  }

  const countryFallbacks = new Map<
    string,
    { sourceCode: string; sourceName: string; pcmCode: string }
  >();
  const resolveCountry = (countryId: string) => {
    const source = countriesById.get(countryId);
    if (!source) throw new Error(`Pays CS inconnu : ${countryId}`);

    const sourceCode = source.iso_alpha3.toUpperCase();
    const requestedCode = COUNTRY_ALIASES[sourceCode] ?? sourceCode;
    let pcmCountry = pcmCountryByConstant.get(requestedCode);

    if (!pcmCountry) {
      const fallbackCode =
        CONTINENT_FALLBACKS[source.continent_code] ?? "FRA";
      pcmCountry = pcmCountryByConstant.get(fallbackCode);
      if (!pcmCountry) {
        throw new Error(`Pays de repli PCM introuvable : ${fallbackCode}`);
      }
      countryFallbacks.set(sourceCode, {
        sourceCode,
        sourceName: source.name,
        pcmCode: fallbackCode,
      });
    }

    const pcmCountryId = Number(pcmCountry.IDcountry);
    const regionId = firstRegionByCountry.get(pcmCountryId);
    if (!regionId) {
      throw new Error(`Region PCM absente pour le pays ${sourceCode}.`);
    }

    return {
      countryId: pcmCountryId,
      regionId,
      pcmCode: String(pcmCountry.CONSTANT),
    };
  };

  const teamTemplate = requireTemplateRow(db, "DYN_team", "IDteam", 1);
  const sponsorTemplate = requireTemplateRow(
    db,
    "DYN_sponsor",
    "IDsponsor",
    1,
  );
  const teamSponsorTemplate = requireTemplateRow(
    db,
    "DYN_team_sponsor",
    "IDteam_sponsor",
    1,
  );
  const teamHistoryTemplate = requireTemplateRow(
    db,
    "DYN_team_history",
    "IDteam_history",
    1,
    true,
  );
  const cyclistTemplate = requireTemplateRow(
    db,
    "DYN_cyclist",
    "IDcyclist",
    797,
  );
  const contractTemplate = requireTemplateRow(
    db,
    "DYN_contract_cyclist",
    "IDcontract_cyclist",
    1,
  );
  const firstGeneratedTeamSponsorId = nextId(
    db,
    "DYN_team_sponsor",
    "IDteam_sponsor",
  );
  const firstGeneratedCyclistId = nextId(db, "DYN_cyclist", "IDcyclist");
  const firstGeneratedContractId = nextId(
    db,
    "DYN_contract_cyclist",
    "IDcontract_cyclist",
  );
  const teamMappings = new Map<
    string,
    { pcmTeamId: number; divisionId: number }
  >();
  const divisionCounts: Record<"10" | "11" | "12", number> = {
    "10": 0,
    "11": 0,
    "12": 0,
  };

  db.run("BEGIN");
  try {
    purgeOfficialProfessionalRoster(db);

    let nextSponsorId = nextId(db, "DYN_sponsor", "IDsponsor");
    let nextTeamSponsorId = firstGeneratedTeamSponsorId;
    let nextTeamHistoryId = nextId(
      db,
      "DYN_team_history",
      "IDteam_history",
    );
    let nextCyclistId = firstGeneratedCyclistId;
    let nextContractId = firstGeneratedContractId;
    const reservedTeamCodes = queryRows(
      db,
      "SELECT jersey_sz_abbreviation FROM DYN_team",
    ).map((row) => row.jersey_sz_abbreviation);
    reservedTeamCodes.push("cys");
    const teamCodes = createUniqueTeamCodes(
      snapshot.teamSeasons,
      reservedTeamCodes,
    );
    const spectatorCountry = pcmCountryByConstant.get("FRA");
    if (!spectatorCountry) {
      throw new Error("Le pays FRA est absent du gabarit PCM.");
    }
    const spectatorCountryId = Number(spectatorCountry.IDcountry);
    const spectatorRegionId = firstRegionByCountry.get(spectatorCountryId);
    if (!spectatorRegionId) {
      throw new Error("La region francaise est absente du gabarit PCM.");
    }
    const spectatorTeamId = SPECTATOR_TEAM_ID;
    const spectatorSponsorId = nextSponsorId++;

    insertRow(db, "DYN_team", {
      ...teamTemplate,
      IDteam: spectatorTeamId,
      gene_sz_shortname: "Cyclostratege",
      gene_sz_name: "Cyclostratège",
      jersey_sz_abbreviation: "cys",
      abbreviation: "CYS",
      gene_b_licensed: 1,
      fkIDcountry: spectatorCountryId,
      gene_sz_suffixeMail: "cyclostratege.fr",
      gene_sz_manager_general: "Mode spectateur",
      fkIDdivision: 12,
      fkIDnextdivision: 0,
      fkIDprevdivision: 0,
      fkIDrace: 0,
      prerace_i_team: 0,
      gene_b_selected: 0,
      CONSTANT: "CS_SPECTATOR",
      gene_b_default_picking: 0,
      value_ilist_race_like: "()",
      value_ilist_race_dislike: "()",
      value_i_budget: 0,
      gene_sz_color: "123d34",
      gene_sz_secondary_color: "9be0ca",
    });
    insertRow(db, "DYN_sponsor", {
      ...sponsorTemplate,
      IDsponsor: spectatorSponsorId,
      gene_sz_name: "Cyclostratège",
      jersey_sz_abbreviation: "cys",
      abbreviation: "CYS",
      fkIDregion: spectatorRegionId,
      fkIDworld_range: 1,
      gene_sz_color: "123d34",
      gene_sz_secondary_color: "9be0ca",
      value_ilist_important_race: "()",
      value_b_generate: 0,
    });
    insertRow(db, "DYN_team_sponsor", {
      ...teamSponsorTemplate,
      IDteam_sponsor: nextTeamSponsorId++,
      fkIDteam: spectatorTeamId,
      fkIDsponsor: spectatorSponsorId,
      value_i_contract_year_start: 2026,
      value_i_contract_year_end: 2035,
      value_i_pos_curr: 0,
      value_i_pos_next: 0,
      value_i_budget: 0,
      value_i_budget_next: 0,
    });
    insertRow(db, "DYN_team_history", {
      ...teamHistoryTemplate,
      IDteam_history: nextTeamHistoryId++,
      fkIDteam: spectatorTeamId,
      fkIDdivision: 12,
      value_i_year: 2025,
      value_sz_name: "Cyclostratège",
      value_f_evaluation: 0,
      value_f_moyage: 0,
      value_i_nb_cyclist: SPECTATOR_RIDER_COUNT,
      value_i_nb_victory: 0,
      value_i_ranking: 0,
    });
    divisionCounts["12"] += 1;

    const sortedTeamSeasons = [...snapshot.teamSeasons].sort((left, right) =>
      left.display_name.localeCompare(right.display_name, "fr"),
    );

    for (const teamSeason of sortedTeamSeasons) {
      const team = teamsById.get(teamSeason.team_id);
      if (!team) {
        throw new Error(`Equipe permanente absente : ${teamSeason.team_id}`);
      }

      const code = teamCodes.get(teamSeason.team_id);
      if (!code) {
        throw new Error(`Code PCM absent : ${teamSeason.display_name}`);
      }

      const divisionId = getTeamDivision(
        teamSeason.division_id,
        divisionsById,
      );
      const country = resolveCountry(
        teamSeason.registration_country_id || team.home_country_id,
      );
      const teamId = Number(team.pcm_export_id);
      const sponsorId = nextSponsorId++;
      const primaryColor = cleanHex(
        team.amateur_jersey_primary_color,
        "176951",
      );
      const secondaryColor = cleanHex(
        team.amateur_jersey_secondary_color,
        "fffdf4",
      );

      insertRow(db, "DYN_team", {
        ...teamTemplate,
        IDteam: teamId,
        gene_sz_shortname: String(
          teamSeason.short_name || teamSeason.display_name,
        ).slice(0, 40),
        gene_sz_name: teamSeason.display_name.slice(0, 70),
        jersey_sz_abbreviation: code,
        abbreviation: code.toUpperCase(),
        gene_b_licensed: 1,
        fkIDcountry: country.countryId,
        gene_sz_suffixeMail: "cyclostratege.fr",
        gene_sz_manager_general: "Cyclo Stratege",
        fkIDdivision: divisionId,
        fkIDnextdivision: 0,
        fkIDprevdivision: 0,
        fkIDrace: 0,
        prerace_i_team: 0,
        gene_b_selected: 0,
        CONSTANT: `CS_${code.toUpperCase()}`,
        gene_b_default_picking: 1,
        value_ilist_race_like: "()",
        value_ilist_race_dislike: "()",
        value_i_budget: Math.max(
          0,
          Math.round(Number(teamSeason.operating_budget) || 0),
        ),
        gene_sz_color: primaryColor,
        gene_sz_secondary_color: secondaryColor,
      });

      insertRow(db, "DYN_sponsor", {
        ...sponsorTemplate,
        IDsponsor: sponsorId,
        gene_sz_name: teamSeason.display_name.slice(0, 70),
        jersey_sz_abbreviation: code,
        abbreviation: code.toUpperCase(),
        fkIDregion: country.regionId,
        fkIDworld_range: divisionId === 10 ? 4 : divisionId === 11 ? 3 : 2,
        gene_sz_color: primaryColor,
        gene_sz_secondary_color: secondaryColor,
        value_ilist_important_race: "()",
        value_b_generate: 0,
      });

      insertRow(db, "DYN_team_sponsor", {
        ...teamSponsorTemplate,
        IDteam_sponsor: nextTeamSponsorId++,
        fkIDteam: teamId,
        fkIDsponsor: sponsorId,
        value_i_contract_year_start: 2026,
        value_i_contract_year_end: 2035,
        value_i_pos_curr: 0,
        value_i_pos_next: 0,
        value_i_budget: 0,
        value_i_budget_next: 0,
      });

      insertRow(db, "DYN_team_history", {
        ...teamHistoryTemplate,
        IDteam_history: nextTeamHistoryId++,
        fkIDteam: teamId,
        fkIDdivision: divisionId,
        value_i_year: 2025,
        value_sz_name: teamSeason.display_name.slice(0, 70),
        value_f_evaluation: 0,
        value_f_moyage: 0,
        value_i_nb_cyclist: snapshot.contracts.filter(
          (contract) => contract.team_id === teamSeason.team_id,
        ).length,
        value_i_nb_victory: 0,
        value_i_ranking: Number(teamSeason.final_rank) || 0,
      });

      teamMappings.set(teamSeason.team_id, {
        pcmTeamId: teamId,
        divisionId,
      });
      divisionCounts[String(divisionId) as "10" | "11" | "12"] += 1;
    }

    const sortedRiders = [...snapshot.riders].sort(
      (left, right) =>
        left.last_name.localeCompare(right.last_name, "fr") ||
        left.first_name.localeCompare(right.first_name, "fr") ||
        left.id.localeCompare(right.id),
    );

    for (const rider of sortedRiders) {
      const contract = contractsByRider.get(rider.id);
      const rating = ratingsByRider.get(rider.id);
      if (!contract || !rating) {
        throw new Error(`Donnees incompletes pour le coureur ${rider.id}.`);
      }

      const mappedTeam = teamMappings.get(contract.team_id);
      if (!mappedTeam) {
        throw new Error(`Equipe non exportee pour le coureur ${rider.id}.`);
      }

      const nationality = resolveCountry(rider.country_id);
      const converted = convertRiderRatings(
        rating,
        snapshot.ratingPolicy.scale,
      );
      const currentAbility = average(Object.values(converted));
      const riderId = nextCyclistId++;
      const contractId = nextContractId++;
      const birthYear = 2026 - Number(rating.age);
      const tourRating = toPcmProfileLevel(
        average([
          converted.charac_i_mountain,
          converted.charac_i_hill,
          converted.charac_i_timetrial,
          converted.charac_i_recuperation,
          converted.charac_i_endurance,
        ]),
      );
      const classicRating = toPcmProfileLevel(
        average([
          converted.charac_i_hill,
          converted.charac_i_cobble,
          converted.charac_i_plain,
          converted.charac_i_resistance,
          converted.charac_i_acceleration,
        ]),
      );

      const cyclistRow: SqlRow = {
        ...cyclistTemplate,
        IDcyclist: riderId,
        gene_sz_lastname: rider.last_name,
        gene_sz_firstname: rider.first_name,
        gene_sz_firstlastname: rider.last_name,
        fkIDteam: mappedTeam.pcmTeamId,
        fkIDregion: nationality.regionId,
        fkIDcontract: 0,
        fkIDprevcontract: 0,
        fkIDnextcontract: 0,
        gene_sz_photo: "",
        gene_i_birthdate: birthYear * 10_000 + 101,
        gene_f_popularity: 0,
        gene_f_popularity_max: 0,
        value_i_rank_voted: 0,
        value_f_potentiel: toPcmPotential(rider.potential_steps),
        value_f_current_ability: currentAbility,
        current_f_stage_score: 0,
        fkIDrace: 0,
        fkIDlaststage: 0,
        fkIDcyclist_state: 3,
        fkIDtype_rider: inferRiderType(converted),
        fkIDinjury: 0,
        gene_i_size: Math.round(Number(rider.height_cm) || 178),
        gene_i_weight: Math.round(Number(rider.weight_kg) || 68),
        prerace_i_cyclist: 0,
        race_b_withdrawal: 0,
        ...converted,
        charac_i_tour: tourRating,
        charac_i_classic: classicRating,
        fitness_i_handicap: 0,
        gene_b_will_retire: 0,
        gene_i_dossard: 0,
        gene_i_champion_bit: 0,
        gene_b_nominated: 0,
        CONSTANT: `CS_${rider.id.replaceAll("-", "").slice(0, 20).toUpperCase()}`,
        gene_sz_soundname: "",
        fkIDstate_roster: 0,
        gene_b_inshortlist: 0,
        gene_i_date_last_breakaway: 0,
        gene_i_date_last_punchers: 0,
        gene_ilist_fkIDfavorite_races: "()",
        gene_i_nb_total_victory: 0,
        gene_i_nb_tdf: 0,
        gene_i_nb_giro: 0,
        gene_i_nb_vuelta: 0,
        gene_i_nb_sanremo: 0,
        gene_i_nb_flandres: 0,
        gene_i_nb_roubaix: 0,
        gene_i_nb_liege: 0,
        gene_i_nb_lombardia: 0,
      };

      for (const [key, value] of Object.entries(converted)) {
        const limitColumn = key.replace("charac_i_", "limit_i_");
        if (limitColumn in cyclistRow) cyclistRow[limitColumn] = value;
      }
      insertRow(db, "DYN_cyclist", cyclistRow);

      const startSeason = seasonsById.get(contract.start_season_id);
      const endSeason = seasonsById.get(contract.end_season_id);
      insertRow(db, "DYN_contract_cyclist", {
        ...contractTemplate,
        IDcontract_cyclist: contractId,
        fkIDcyclist: riderId,
        fkIDteam: mappedTeam.pcmTeamId,
        fkIDprevteam: mappedTeam.pcmTeamId,
        finan_i_period_wage: Math.max(
          0,
          Math.round((Number(contract.salary_per_season) || 0) / 12),
        ),
        iYearBegin:
          2026 +
          ((startSeason?.game_year ?? snapshot.activeSeason.game_year) -
            snapshot.activeSeason.game_year),
        iYearEnd:
          2026 +
          ((endSeason?.game_year ?? snapshot.activeSeason.game_year) -
            snapshot.activeSeason.game_year),
        gene_b_active_contract: 1,
        iRole: -1,
        gene_i_hierarchy: 0,
        gene_bitfield_group: 0,
      });
    }

    const spectatorRatings = Object.fromEntries(
      RATING_COLUMNS.map((column) => [column, SPECTATOR_PCM_RATING]),
    ) as SqlRow;
    const spectatorLimits = Object.fromEntries(
      RATING_COLUMNS.map((column) => [
        column.replace("charac_i_", "limit_i_"),
        SPECTATOR_PCM_RATING,
      ]),
    ) as SqlRow;

    for (let index = 1; index <= SPECTATOR_RIDER_COUNT; index += 1) {
      const riderId = nextCyclistId++;
      const contractId = nextContractId++;
      insertRow(db, "DYN_cyclist", {
        ...cyclistTemplate,
        IDcyclist: riderId,
        gene_sz_lastname: String(index),
        gene_sz_firstname: "Simulo",
        gene_sz_firstlastname: String(index),
        fkIDteam: spectatorTeamId,
        fkIDregion: spectatorRegionId,
        fkIDcontract: 0,
        fkIDprevcontract: 0,
        fkIDnextcontract: 0,
        gene_sz_photo: "",
        gene_i_birthdate: 20020101,
        gene_f_popularity: 0,
        gene_f_popularity_max: 0,
        value_i_rank_voted: 0,
        value_f_potentiel: 1,
        value_f_current_ability: SPECTATOR_PCM_RATING,
        current_f_stage_score: 0,
        fkIDrace: 0,
        fkIDlaststage: 0,
        fkIDcyclist_state: 3,
        fkIDtype_rider: 7,
        fkIDinjury: 0,
        gene_i_size: 178,
        gene_i_weight: 68,
        prerace_i_cyclist: 0,
        race_b_withdrawal: 0,
        ...spectatorRatings,
        ...spectatorLimits,
        charac_i_tour: 0,
        charac_i_classic: 0,
        fitness_i_handicap: 0,
        gene_b_will_retire: 0,
        gene_i_dossard: 0,
        gene_i_champion_bit: 0,
        gene_b_nominated: 0,
        CONSTANT: `CS_SIMULO_${String(index).padStart(2, "0")}`,
        gene_sz_soundname: "",
        fkIDstate_roster: 0,
        gene_b_inshortlist: 0,
        gene_i_date_last_breakaway: 0,
        gene_i_date_last_punchers: 0,
        gene_ilist_fkIDfavorite_races: "()",
        gene_i_nb_total_victory: 0,
        gene_i_nb_tdf: 0,
        gene_i_nb_giro: 0,
        gene_i_nb_vuelta: 0,
        gene_i_nb_sanremo: 0,
        gene_i_nb_flandres: 0,
        gene_i_nb_roubaix: 0,
        gene_i_nb_liege: 0,
        gene_i_nb_lombardia: 0,
      });
      insertRow(db, "DYN_contract_cyclist", {
        ...contractTemplate,
        IDcontract_cyclist: contractId,
        fkIDcyclist: riderId,
        fkIDteam: spectatorTeamId,
        fkIDprevteam: spectatorTeamId,
        finan_i_period_wage: 0,
        iYearBegin: 2026,
        iYearEnd: 2035,
        gene_b_active_contract: 1,
        iRole: -1,
        gene_i_hierarchy: 0,
        gene_bitfield_group: 0,
      });
    }

    validateGeneratedRows(
      db,
      snapshot,
      teamMappings,
      spectatorTeamId,
      sourceStageCount,
    );
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }

  const output = new Uint8Array(sqlToCdb(db));
  const outputSha256 = createHash("sha256").update(output).digest("hex");
  const generatedAt = new Date().toISOString();
  const filename = "OfficialRelease.cdb";
  const exportedRiders = queryRows(
    db,
    "SELECT * FROM DYN_cyclist WHERE CONSTANT LIKE 'CS_%'",
  );
  const exportedRatings = exportedRiders.flatMap((rider) =>
    RATING_COLUMNS.map((column) => Number(rider[column])),
  );

  return {
    cdb: output,
    metadata: {
      generatedAt,
      season: snapshot.activeSeason.game_year,
      snapshotSha256: snapshot.sha256,
      outputSha256,
      filename,
      bytes: output.byteLength,
      counts: {
        teams: snapshot.counts.teams + 1,
        riders: snapshot.counts.riders + SPECTATOR_RIDER_COUNT,
        sponsors: snapshot.counts.teams + 1,
        contracts: snapshot.counts.contracts + SPECTATOR_RIDER_COUNT,
      },
      divisionCounts,
      ratingScale: snapshot.ratingPolicy.scale,
      ratingRange: {
        minimum: Math.min(...exportedRatings),
        maximum: Math.max(...exportedRatings),
      },
      countryFallbacks: [...countryFallbacks.values()].sort((left, right) =>
        left.sourceCode.localeCompare(right.sourceCode),
      ),
      scope: {
        nativeRatingsOnly: true,
        bonusesIncluded: false,
        graphicalAssetsIncluded: false,
        existingPcmContentPreserved: false,
        originalProfessionalTeamsRemoved: true,
        spectatorTeamIncluded: true,
      },
    },
  };
}

/**
 * The PCM database contains a technical fallback team (`LOOSER_TEAM`) used by
 * free staff and internal game flows. It is not a real-world selectable team,
 * so it must remain while the official professional roster is removed.
 */
function purgeOfficialProfessionalRoster(db: Database) {
  const fallbackTeamId = Number(
    queryValue(
      db,
      "SELECT IDteam FROM DYN_team WHERE CONSTANT = 'LOOSER_TEAM' LIMIT 1",
    ),
  );
  if (!Number.isInteger(fallbackTeamId) || fallbackTeamId <= 0) {
    throw new Error(
      "L'equipe technique interne de PCM est absente : purge interrompue.",
    );
  }

  const tablesToClear = [
    "DYN_brand_contract",
    "DYN_career_precontract_cyclist",
    "DYN_contract_cyclist",
    "DYN_contract_cyclist_offer",
    "DYN_cyclist_fitness",
    "DYN_cyclist_fitpeak_history",
    "DYN_cyclist_history",
    "DYN_cyclist_impact_moral",
    "DYN_cyclist_national_selection",
    "DYN_cyclist_objective",
    "DYN_cyclist_peak_detail",
    "DYN_cyclist_progression",
    "DYN_cyclist_satisfaction",
    "DYN_cyclist_season",
    "DYN_investment_cyclist",
    "DYN_invitation_cyclist",
    "DYN_palmares",
    "DYN_palmares_cyclist",
    "DYN_palmares_team",
    "DYN_procyclist",
    "DYN_procyclist_charac_history",
    "DYN_procyclist_contract_offer",
    "DYN_procyclist_skilltree",
    "DYN_procyclist_teammate",
    "DYN_ranking_race_points",
    "DYN_result_season_team",
    "DYN_team_history",
    "DYN_team_race",
    "DYN_team_sponsor",
    "DYN_transfer_available_cyclist",
    "DYN_transfer_team_wish",
    "DYN_u23_link",
    "DYN_ui_planner_cyclist_sort",
    "STA_records",
    "STA_roster_listraces",
  ];

  for (const table of tablesToClear) {
    clearTableIfPresent(db, table);
  }

  db.run("DELETE FROM DYN_cyclist");
  db.run("DELETE FROM DYN_team WHERE IDteam <> ?", [fallbackTeamId]);
  db.run("UPDATE DYN_coach SET fkIDteam = ?", [fallbackTeamId]);
  db.run("UPDATE DYN_physician SET fkIDteam = ?", [fallbackTeamId]);
  db.run("UPDATE DYN_scout SET fkIDteam = ?", [fallbackTeamId]);
  db.run("UPDATE STA_race SET gene_ilist_fkIDteam = '()'");
}

function clearTableIfPresent(db: Database, table: string) {
  const exists = Number(
    queryValue(
      db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table],
    ),
  );
  if (exists === 1) db.run(`DELETE FROM ${escapeIdentifier(table)}`);
}

function validateGeneratedRows(
  db: Database,
  snapshot: PcmExportSnapshot,
  teamMappings: Map<string, { pcmTeamId: number; divisionId: number }>,
  spectatorTeamId: number,
  sourceStageCount: number,
) {
  const exportedTeams = queryRows(
    db,
    "SELECT * FROM DYN_team WHERE CONSTANT LIKE 'CS_%'",
  );
  const exportedRiders = queryRows(
    db,
    "SELECT * FROM DYN_cyclist WHERE CONSTANT LIKE 'CS_%'",
  );
  const teamIds = new Set(
    [...teamMappings.values()].map((mapping) => mapping.pcmTeamId),
  );
  teamIds.add(spectatorTeamId);

  if (exportedTeams.length !== snapshot.counts.teams + 1) {
    throw new Error("Le controle PCM a detecte un nombre d'equipes incoherent.");
  }
  if (
    exportedRiders.length !==
    snapshot.counts.riders + SPECTATOR_RIDER_COUNT
  ) {
    throw new Error("Le controle PCM a detecte un nombre de coureurs incoherent.");
  }
  if (
    Number(
      queryValue(
        db,
        `SELECT COUNT(*) FROM DYN_team
         WHERE CONSTANT <> 'LOOSER_TEAM' AND CONSTANT NOT LIKE 'CS_%'`,
      ),
    ) !== 0
  ) {
    throw new Error("Le controle PCM a detecte une equipe professionnelle reelle.");
  }
  if (
    Number(
      queryValue(
        db,
        "SELECT COUNT(*) FROM DYN_cyclist WHERE CONSTANT NOT LIKE 'CS_%'",
      ),
    ) !== 0
  ) {
    throw new Error("Le controle PCM a detecte un coureur professionnel reel.");
  }
  if (
    Number(
      queryValue(
        db,
        "SELECT COUNT(*) FROM STA_race WHERE gene_ilist_fkIDteam <> '()'",
      ),
    ) !== 0
  ) {
    throw new Error("Le controle PCM a detecte une liste d'equipes officielle residuelle.");
  }
  if (
    Number(
      queryValue(
        db,
        "SELECT COUNT(*) FROM DYN_team WHERE IDteam = ? AND CONSTANT = 'CS_SPECTATOR' AND gene_b_licensed = 1",
        [spectatorTeamId],
      ),
    ) !== 1 ||
    Number(
      queryValue(
        db,
        `SELECT COUNT(*) FROM DYN_cyclist
         WHERE fkIDteam = ?
           AND gene_sz_firstname = 'Simulo'
           AND CONSTANT LIKE 'CS_SIMULO_%'
           AND ${RATING_COLUMNS.map(
             (column) => `${escapeIdentifier(column)} = ${SPECTATOR_PCM_RATING}`,
           ).join(" AND ")}`,
        [spectatorTeamId],
      ),
    ) !== SPECTATOR_RIDER_COUNT
  ) {
    throw new Error("Le controle PCM a detecte une equipe spectateur invalide.");
  }
  if (Number(queryValue(db, "SELECT COUNT(*) FROM STA_stage")) !== sourceStageCount) {
    throw new Error(
      "Le controle PCM a detecte une modification du catalogue des etapes.",
    );
  }

  const teamCodes = exportedTeams.map((row) =>
    String(row.jersey_sz_abbreviation),
  );
  if (new Set(teamCodes).size !== teamCodes.length) {
    throw new Error("Le controle PCM a detecte des codes d'equipe en doublon.");
  }

  for (const rider of exportedRiders) {
    if (!teamIds.has(Number(rider.fkIDteam))) {
      throw new Error(`Equipe orpheline pour le coureur PCM ${rider.IDcyclist}.`);
    }
    if (
      Number(rider.gene_i_size) < 140 ||
      Number(rider.gene_i_size) > 220 ||
      Number(rider.gene_i_weight) < 40 ||
      Number(rider.gene_i_weight) > 120
    ) {
      throw new Error(`Morphologie invalide pour le coureur PCM ${rider.IDcyclist}.`);
    }

    for (const column of RATING_COLUMNS) {
      const value = Number(rider[column]);
      if (
        value < snapshot.ratingPolicy.scale.pcmMinimum ||
        value > snapshot.ratingPolicy.scale.pcmMaximum
      ) {
        throw new Error(
          `Note PCM hors limites pour ${rider.IDcyclist} : ${column}=${value}.`,
        );
      }
    }
  }

  for (const team of exportedTeams) {
    if (Number(team.gene_b_licensed) !== 1) {
      throw new Error(`Equipe PCM non jouable : ${team.IDteam}.`);
    }
  }
}

function requireTemplateRow(
  db: Database,
  table: string,
  idColumn: string,
  id: number,
  allowEmptyTable = false,
) {
  const row = queryRows(
    db,
    `SELECT * FROM ${escapeIdentifier(table)} WHERE ${escapeIdentifier(idColumn)} = ?`,
    [id],
  )[0];
  if (row) return row;
  const fallbackRow = queryRows(
    db,
    `SELECT * FROM ${escapeIdentifier(table)} ORDER BY ${escapeIdentifier(idColumn)} LIMIT 1`,
  )[0];
  if (fallbackRow) return fallbackRow;
  if (allowEmptyTable) return {};
  throw new Error(`Ligne gabarit absente dans ${table}.`);
}

function nextId(db: Database, table: string, idColumn: string) {
  return (
    Number(
      queryValue(
        db,
        `SELECT MAX(${escapeIdentifier(idColumn)}) FROM ${escapeIdentifier(table)}`,
      ),
    ) + 1
  );
}

function queryRows(db: Database, sql: string, parameters: SqlValue[] = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(parameters);
    const rows: SqlRow[] = [];
    while (statement.step()) rows.push(statement.getAsObject() as SqlRow);
    return rows;
  } finally {
    statement.free();
  }
}

function queryValue(db: Database, sql: string, parameters: SqlValue[] = []) {
  return Object.values(queryRows(db, sql, parameters)[0] ?? {})[0];
}

function insertRow(db: Database, table: string, row: SqlRow) {
  const columns = Object.keys(row);
  const sql = `INSERT INTO ${escapeIdentifier(table)} (${columns
    .map(escapeIdentifier)
    .join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
  const statement = db.prepare(sql);

  try {
    statement.run(columns.map((column) => row[column]));
  } finally {
    statement.free();
  }
}

function escapeIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function cleanHex(value: unknown, fallback: string) {
  const candidate = String(value ?? "")
    .replace(/^#/, "")
    .toLowerCase();
  return /^[0-9a-f]{6}$/.test(candidate) ? candidate : fallback;
}

function getTeamDivision(
  divisionId: string,
  divisionsById: Map<string, { code: string }>,
) {
  const code = divisionsById.get(divisionId)?.code;
  if (code === "world") return 10;
  if (code === "elite") return 11;
  return 12;
}

function inferRiderType(converted: Record<string, number>) {
  const scores = [
    [
      1,
      average([
        converted.charac_i_mountain,
        converted.charac_i_hill,
        converted.charac_i_timetrial,
        converted.charac_i_recuperation,
        converted.charac_i_endurance,
      ]),
    ],
    [
      2,
      average([
        converted.charac_i_mountain,
        converted.charac_i_mountain,
        converted.charac_i_hill,
        converted.charac_i_downhilling,
      ]),
    ],
    [
      3,
      average([
        converted.charac_i_timetrial,
        converted.charac_i_timetrial,
        converted.charac_i_prologue,
        converted.charac_i_plain,
      ]),
    ],
    [
      4,
      average([
        converted.charac_i_sprint,
        converted.charac_i_sprint,
        converted.charac_i_acceleration,
        converted.charac_i_plain,
      ]),
    ],
    [
      5,
      average([
        converted.charac_i_hill,
        converted.charac_i_hill,
        converted.charac_i_acceleration,
        converted.charac_i_resistance,
      ]),
    ],
    [
      6,
      average([
        converted.charac_i_cobble,
        converted.charac_i_cobble,
        converted.charac_i_plain,
        converted.charac_i_resistance,
      ]),
    ],
    [
      7,
      average([
        converted.charac_i_plain,
        converted.charac_i_plain,
        converted.charac_i_baroudeur,
        converted.charac_i_endurance,
      ]),
    ],
  ];

  return scores.sort((left, right) => right[1] - left[1])[0][0];
}

/**
 * PCM stores the Tour and Classics indicators as profile levels, not as
 * performance ratings. Zero means that the profile is not significant; the
 * remaining levels must stay in the native 1..5 range enforced by PCM26.
 */
function toPcmProfileLevel(score: number) {
  if (score < 70) return 0;
  return Math.min(5, Math.floor((score - 70) / 3) + 1);
}

/**
 * PCM26 accepts only half-star potential levels between 0.5 and 6.0. CS uses
 * eight progression steps, so the full CS range is projected onto the full
 * PCM range while retaining PCM's discrete half-star values.
 */
function toPcmPotential(value: number | null) {
  const steps = Math.max(1, Math.min(8, Math.round(Number(value) || 1)));
  const projected = 0.5 + ((steps - 1) * 5.5) / 7;
  return Math.round(projected * 2) / 2;
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
