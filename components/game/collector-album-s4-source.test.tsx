import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import realS4 from "@/data/collector-album-s4-preview.json";
import legacyS3 from "@/data/collector-album-pilot.json";
import { createAlbumPilotState, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { createCycloStickersFinalSnapshot } from "@/lib/game/cyclo-stickers-final-snapshot";
import { createFinalCycloStickersSourceFixture } from "@/lib/game/cyclo-stickers-final-snapshot.fixture";
import { getAlbumProfileCards } from "@/lib/game/collector-album-layout";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import { CollectorAlbum } from "./collector-album";
import { AlbumBoosterArtwork } from "./collector-album-artwork";
import { CollectorAlbumBoosters } from "./collector-album-boosters";
import { CollectorAlbumAchievements } from "./collector-album-achievements";
import { CollectorCardBack, CollectorCardFace } from "./collector-card-face";
import { CycloStickersIntroduction } from "./cyclo-stickers-introduction";

const snapshot = realS4 as CollectorAlbumSnapshot;
const active = snapshot;
const onAction = () => {};
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");

describe("genuine S4 card presentation", () => {
  it("uses a distinct S4 source, ranking and ratings rather than rebadging the S3 pilot", () => {
    expect(snapshot.sourceSeasonId).not.toBe(legacyS3.sourceSeasonId);
    expect(snapshot.edition).not.toBe(legacyS3.edition);
    expect(snapshot.cards.slice(0, 50).map(card => card.id)).not.toEqual(legacyS3.cards.map(card => card.id));
    const sharedRiders = snapshot.cards.slice(0, 50).filter(card => legacyS3.cards.some(old => old.id === card.id));
    expect(sharedRiders.length).toBeGreaterThan(0);
    expect(sharedRiders.some(card => RIDER_RATING_AXES.some(({ key }) => card.ratings[key] !== legacyS3.cards.find(old => old.id === card.id)!.ratings[key]))).toBe(true);
    for (const card of snapshot.cards.filter(card => !card.kind || card.kind === "team")) {
      if (card.jersey.imagePath) expect(card.jersey.imagePath).toMatch(/^\/images\/collector-albums\/s4\/[a-f0-9]{64}\./);
    }
  });

  it("prints all 72 S4 identities and the 53 riders’ native ratings without substituting prototype cards", () => {
    const before = JSON.stringify(snapshot);
    expect(snapshot.sourceSeason).toBe(4);
    expect(snapshot.ratingsFrozenFromSeason).toBe(4);
    expect(snapshot.sourceSeasonStatus).toBe("active");
    expect(snapshot.cards).toHaveLength(72);
    expect(snapshot.cards.filter(card=>!card.kind)).toHaveLength(53);
    for (const card of snapshot.cards) {
      const html = renderToStaticMarkup(<CollectorCardFace card={card} season={snapshot.sourceSeason} provisional />);
      expect(html).toContain(escapeHtml(card.name));
      expect(html).not.toContain("S3");
      expect(html).not.toContain("données de test");
      expect(html).not.toContain("Spécimen");
      if (!card.kind || (card.kind !== "team" && card.kind !== "legend")) {
        for (const [key, label] of [["mountain", "MO"], ["hills", "VAL"], ["flat", "PLA"], ["timeTrial", "CLM"], ["cobbles", "PAV"], ["sprint", "SPR"]] as const) {
          expect(html).toContain(`<dt>${label}</dt><dd>${card.ratings[key]}</dd>`);
        }
      }
      if (!card.kind) {
        expect(html).toContain("ÉDITION S4");
        expect(html).toContain("UCI S4");
        const back = renderToStaticMarkup(<CollectorCardBack card={card} season={snapshot.sourceSeason} provisional />);
        expect(back).toContain("SAISON 4");
        expect(back).toContain("Résultats et notes relevés en saison 4");
        expect(back.match(/<li>/g)?.length ?? 0).toBe(card.honours.length);
        for (const honour of card.honours) expect(back).toContain(escapeHtml(honour.raceName));
      }
    }
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("keeps final UCI order inside chapters derived from frozen S4 profiles", () => {
    for (const profile of new Set(snapshot.cards.filter(card=>!card.kind).map(card => card.profileKey))) {
      const cards = getAlbumProfileCards(snapshot.cards, profile);
      expect(cards.map(card => card.number)).toEqual(snapshot.cards.filter(card => !card.kind && card.profileKey === profile).map(card => card.number));
      expect(cards.map(card => card.rank)).toEqual([...cards.map(card => card.rank)].sort((a, b) => a - b));
    }
  });

  it("labels active S4 captures as provisional rather than final or S3 test data", () => {
    const state = createAlbumPilotState(active.collectionSeason, active.cards);
    const cover = renderToStaticMarkup(<CollectorAlbum snapshot={active} storageOwnerId="s4-source-check" />);
    const intro = renderToStaticMarkup(<CycloStickersIntroduction snapshot={active} state={state} ready onAction={onAction} />);
    const boosters = renderToStaticMarkup(<CollectorAlbumBoosters snapshot={active} state={state} ready onAction={onAction} onViewAlbum={() => {}} />);
    for (const html of [cover, intro, boosters]) {
      expect(html).not.toContain("S3");
      expect(html).toContain("provisoire");
    }
    expect(boosters).toContain("NOTES S4");
    expect(boosters).not.toContain("CARTES DE TEST");
    const back = renderToStaticMarkup(<CollectorCardBack card={active.cards[0]} season={active.sourceSeason} provisional />);
    expect(back).toContain("Résultats et notes relevés en saison 4");
    expect(back).not.toContain("figés en fin de saison");
    const wrapper = renderToStaticMarkup(<AlbumBoosterArtwork sourceSeason={4} gamesEdition provisional />);
    expect(wrapper).toContain("NOTES S4");
    expect(wrapper).not.toContain("NOTES FIGÉES");
    const final = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
    expect(renderToStaticMarkup(<CollectorCardBack card={final.cards[0]} season={final.sourceSeason} />)).toContain("Résultats et notes figés en fin de saison 4");
  });

  it("requires all 72 cards in the completion caption", () => {
    const html = renderToStaticMarkup(<CollectorAlbumAchievements snapshot={snapshot} state={createAlbumPilotState(5, snapshot.cards)} ready onAction={onAction} />);
    expect(html).toContain("Les 72 vignettes à leur place");
    expect(html).not.toContain("Les 69 vignettes");
    expect(html).not.toContain("Ce profil est absent");
  });

  it("shows appended Baroudeurs in their rider chapter without adding them to the 19 introduction cards", () => {
    const baroudeurs=snapshot.cards.filter(card=>!card.kind&&card.profileKey==="breakaway");
    expect(baroudeurs.map(card=>card.number)).toEqual([70,71,72]);
    const state=createAlbumPilotState(5,snapshot.cards);
    state.pasted=snapshot.cards.map(card=>card.number);
    const html=[0,2].map(leaf=>renderToStaticMarkup(<CycloStickersIntroduction snapshot={snapshot} state={state} ready onAction={onAction} leaf={leaf}/>)).join("");
    expect(html).toContain("19 / 19 vignettes collées");
    expect(html).not.toContain("22 / 19");
    expect([...html.matchAll(/data-intro-sticker="(\d+)"/g)].map(match=>Number(match[1]))).toEqual(Array.from({length:19},(_,index)=>index+51));
    const view=renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId="s4-baroudeurs" initialProfile="breakaway" runtime={{state,ready:true,ownerName:"Collectionneur S4",boosterCount:0,tradeCount:0,notice:"",onAction:()=>{},boosters:null,achievements:null,trades:()=>null}}/>);
    for(const card of baroudeurs) expect(view).toContain(escapeHtml(card.name));
    expect([...view.matchAll(/data-album-slot="(\d+)"/g)].map(match=>Number(match[1]))).toEqual([70,71,72]);
  });
});
