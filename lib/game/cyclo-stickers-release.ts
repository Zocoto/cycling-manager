import { createContinentalChampionRiderJersey, createQuadrennialChampionRiderJersey, createWorldChampionRiderJersey, type ContinentalChampionshipCode } from "@/lib/rider-jersey";
import type { CollectorAlbumSnapshot, CollectorCard } from "./collector-album";

export const CYCLO_STICKERS_RELEASE = { name: "Album de Cyclo-Stickers", sourceSeason: 4, launchSeason: 5, publicReady: false } as const;
export function canLaunchCycloStickers(activeSeason: number, frozenSeason: number | null, persistentInventoryReady: boolean, publicApproved: boolean = CYCLO_STICKERS_RELEASE.publicReady) {
  return publicApproved && activeSeason >= 5 && frozenSeason === 4 && persistentInventoryReady;
}

type IntroSource = {
  season: { game_year: number; status: string };
  teams: { team_id: string; display_name: string; points: number; final_rank: number }[];
  champions: { rider_id: string; championship_type: string; first_name: string; last_name: string; country: string; iso_alpha2: string; age: number; avatar_profile_key: string | null; avatar_seed: string | number | null; mountain: number; hills: number; flat: number; time_trial: number; cobbles: number; sprint: number; acceleration: number; downhill: number; endurance: number; resistance: number; recovery: number; breakaway: number; prologue: number }[];
};
const continents: [ContinentalChampionshipCode,string][] = [["africa","Afrique"],["america","Amérique"],["asia","Asie"],["europe","Europe"],["oceania","Océanie"]];

/** S3 cards stay unchanged. The S4 cover is explicitly a rehearsal for S5. */
export function createCycloStickersPreview(snapshot: CollectorAlbumSnapshot, source: IntroSource): CollectorAlbumSnapshot {
  if (snapshot.sourceSeason !== 3 || snapshot.cards.length !== 50 || source.season.game_year !== 3 || source.season.status !== "completed" || source.teams.length !== 5) throw new Error("Invalid private preview source");
  const sample = snapshot.cards[0];
  const extras: CollectorCard[] = [];
  const add = (card: Partial<CollectorCard>) => extras.push({ ...sample, rank: 0, points: 0, victories: 0, honours: [], worldTitles: [], profile: "Vignette d’introduction", ...card, number: 51 + extras.length, id: `intro:${card.id}` });
  source.teams.forEach((team,index) => {
    const rider = snapshot.cards.find(card => card.teamName === team.display_name);
    if (!rider) throw new Error(`Missing frozen team jersey: ${team.display_name}`);
    add({ id: `team:${team.team_id}`, kind: "team", rarityOverride: "silver", name: team.display_name, jersey: rider.jersey, teamName: team.display_name, stickerTitle: `Top 5 UCI · ${index+1}${index===0?"er":"e"}`, points: team.points });
  });
  const champion = (type: string, title: string, kind: "continental" | "world" | "games", jersey: CollectorCard["jersey"]) => {
    const actual = source.champions.find(champion => champion.championship_type === type);
    const visual = snapshot.cards[(extras.length*7)%50];
    const identity: Partial<CollectorCard> = actual ? {
      name: `${actual.first_name} ${actual.last_name}`, country: actual.country, countryCode: actual.iso_alpha2, age: actual.age,
      avatarProfileKey: actual.avatar_profile_key, avatarSeed: actual.avatar_seed,
      ratings: { mountain: actual.mountain, hills: actual.hills, flat: actual.flat, timeTrial: actual.time_trial, cobbles: actual.cobbles, sprint: actual.sprint, acceleration: actual.acceleration, downhill: actual.downhill, endurance: actual.endurance, resistance: actual.resistance, recovery: actual.recovery, breakaway: actual.breakaway, prologue: actual.prologue },
    } : { name: "Spécimen de collection", specimen: true, country: "", countryCode: "", avatarProfileKey: visual.avatarProfileKey, avatarSeed: visual.avatarSeed, age: visual.age };
    add({ ...identity, id: type, kind, jersey, stickerTitle: title, teamName: title, rarityOverride: kind === "games" ? "holographic" : kind === "world" ? "gold" : "silver" });
  };
  for (const [continentCode,label] of continents) for (const championshipType of ["road","time_trial"] as const) champion(`continental_${continentCode}_${championshipType}`, `Champion continental · ${label} · ${championshipType==="road"?"Route":"CLM"}`, "continental", createContinentalChampionRiderJersey({continentCode,championshipType}));
  for (const championshipType of ["road","time_trial"] as const) champion(`world_${championshipType}`, `Champion du monde · ${championshipType==="road"?"Route":"CLM"}`, "world", createWorldChampionRiderJersey({championshipType}));
  champion("quadrennial_road", "Champion des Jeux · Route", "games", createQuadrennialChampionRiderJersey({championshipType:"road"}));
  add({ id: "legend:headless-s4", kind: "legend", name: "L’Équipier sans tête", stickerTitle: "Les nuits du peloton", teamName: "Halloween · Saison 4", country: "", countryCode: "", rarityOverride: "holographic" });
  return { ...snapshot, edition: "cyclo-stickers-s4-preview-s3-v1", presentationSeason: 4, launchSeason: 5, gamesEdition: true, cards: [...snapshot.cards,...extras] };
}

/** Fail closed: a live S4 ranking or any demonstration specimen is not a final edition. */
export function assertCycloStickersFinalSnapshot(snapshot: CollectorAlbumSnapshot, sourceSeasonStatus: string) {
  const riders = snapshot.cards.filter(card => !card.kind);
  if (sourceSeasonStatus !== "completed" || snapshot.sourceSeason !== 4 || snapshot.ratingsFrozenFromSeason !== 4 || snapshot.collectionSeason !== 5 || snapshot.cards.length !== 69 || riders.length !== 50 ||
    snapshot.presentationSeason !== 4 || snapshot.launchSeason !== 5 ||
    new Set(snapshot.cards.map(card=>card.id)).size !== 69 || snapshot.cards.some((card,index)=>card.specimen || card.number!==index+1) ||
    riders.some((card,index)=>card.rank!==index+1 || card.number!==index+1) ||
    snapshot.cards.filter(card=>card.kind==="team").length!==5 || snapshot.cards.filter(card=>card.kind==="continental").length!==10 || snapshot.cards.filter(card=>card.kind==="world").length!==2 || snapshot.cards.filter(card=>card.kind==="games").length!==1 || snapshot.cards.filter(card=>card.kind==="legend"&&card.id==="intro:legend:headless-s4").length!==1 ||
    snapshot.cards.some(card=>card.kind==="world"&&card.jersey.status!=="world-champion" || card.kind==="continental"&&card.jersey.status!=="continental-champion" || card.kind==="games"&&(card.jersey.status!=="quadrennial-champion"||card.jersey.championshipType!=="road"))) throw new Error("Final S4 snapshot incomplete or not frozen");
  const titles=snapshot.cards.filter(card=>card.kind==="continental"||card.kind==="world").map(card=>`${card.kind}:${card.jersey.continentCode??"world"}:${card.jersey.championshipType}`);
  if(new Set(titles).size!==12) throw new Error("Duplicate championship slot");
}
