import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import raw from "@/data/collector-album-pilot.json";
import intro from "@/data/collector-album-intro-pilot.json";
import {createCycloStickersPreview} from "@/lib/game/cyclo-stickers-release";
import {createAlbumPilotState,type CollectorAlbumSnapshot} from "@/lib/game/collector-album";
import {CollectorAlbum} from "./collector-album";
import {CollectorAlbumCover} from "./collector-album-cover";
import {CollectorAlbumBoosters} from "./collector-album-boosters";
import {CycloStickersIntroduction} from "./cyclo-stickers-introduction";
import {CollectorCardFace} from "./collector-card-face";
import format from "./collector-card-format.module.css";
import {AlbumBoosterArtwork} from "./collector-album-artwork";
import {QUADRENNIAL_GAMES_EMBLEM} from "@/lib/game/quadrennial-games";
const snapshot=createCycloStickersPreview(raw as CollectorAlbumSnapshot,intro);
const state=createAlbumPilotState(4,snapshot.cards);
const onAction=()=>{};

describe("Cyclo-Stickers private S4 presentation",()=>{
  it("prints the official Games emblem on both S4 formats, without changing the legacy edition",()=>{
    const cover=renderToStaticMarkup(<CollectorAlbumCover season={4} count={0} total={69} gamesEdition/>);
    const pack=renderToStaticMarkup(<AlbumBoosterArtwork sourceSeason={4} gamesEdition/>);
    for(const html of [cover,pack]) {
      expect(html).toContain(`href="${QUADRENNIAL_GAMES_EMBLEM}"`);
      expect(html).toContain("data-album-games-emblem");
      expect(html).toContain("Emblème des Jeux quadriennaux");
      expect(html).toContain("L’ÉQUIPIER SANS TÊTE");
    }
    expect(renderToStaticMarkup(<CollectorAlbumCover season={3} count={0} total={50}/>)).not.toContain(QUADRENNIAL_GAMES_EMBLEM);
    expect(renderToStaticMarkup(<AlbumBoosterArtwork sourceSeason={3}/>)).not.toContain(QUADRENNIAL_GAMES_EMBLEM);
  });
  it("prints the S4 cover while clearly retaining S3 test data",()=>{
    const html=renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId="offline-only"/>);
    expect(html).toContain("Album de Cyclo-Stickers");expect(html).toContain("<strong>S4</strong>");
    expect(html).toContain("Ouverture prévue en S5");expect(html).toContain("cartes et notes de test issues de S3");
    expect(html).toContain("/ 69");
    expect(html).not.toMatch(/ultra.holo/i);
    const cover=renderToStaticMarkup(<CollectorAlbumCover season={4} count={0} total={69} gamesEdition/>);
    expect(cover).toContain("la légende de l’Équipier sans tête");
  });
  it("prints every opening sticker within the book, never in a separate toolbar tab",()=>{
    const html=[0,2].map(leaf=>renderToStaticMarkup(<CycloStickersIntroduction snapshot={snapshot} state={{...state,pasted:snapshot.cards.slice(50).map(card=>card.number)}} ready onAction={onAction} leaf={leaf}/>)).join("");
    expect([...html.matchAll(/data-intro-sticker="(\d+)"/g)].map(m=>Number(m[1]))).toEqual(Array.from({length:19},(_,i)=>i+51));
    expect(html).toContain("Mathieu Laurent");expect(html).toContain("Zaven Davtyan");
    expect(html).toContain("Kaffa Origins");expect(html).toContain("L’Équipier sans tête");
    expect(html).toContain("champion-jersey-v1.webp");
    expect(html).not.toMatch(/ultra.holo/i);
    expect(html.match(/data-album-slot="/g)).toHaveLength(19);
    const page=renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId="offline-only" initialIntroduction/>);
    expect(page).toContain('data-profile="introduction"');
    expect(page).toContain("Feuille suivante");
    expect(page).not.toContain("Les champions · Intro");
    expect(page).toContain(">Boosters ");
    for(const card of snapshot.cards) {
      const cardHtml=renderToStaticMarkup(<CollectorCardFace card={card} season={3}/>);
      expect(cardHtml).toContain(format.card);
      expect(cardHtml).toContain("data-album-card");
    }
  });
  it("keeps S4 on closed packs but does not mislabel the test statistics as final S4",()=>{
    const html=renderToStaticMarkup(<CollectorAlbumBoosters snapshot={snapshot} state={state} ready onAction={onAction} onViewAlbum={()=>{}}/>);
    expect(html).toContain("ÉDITION <b>S4</b>");expect(html).toContain("CARTES DE TEST");
    expect(html).toContain("les notes restent celles de S3");
    expect(html).not.toMatch(/ultra.holo/i);
  });
});
