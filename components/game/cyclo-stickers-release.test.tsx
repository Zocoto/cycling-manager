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
const snapshot=createCycloStickersPreview(raw as CollectorAlbumSnapshot,intro);
const state=createAlbumPilotState(4,snapshot.cards);
const onAction=()=>{};

describe("Cyclo-Stickers private S4 presentation",()=>{
  it("prints the S4 cover while clearly retaining S3 test data",()=>{
    const html=renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId="offline-only"/>);
    expect(html).toContain("Album de Cyclo-Stickers");expect(html).toContain("<strong>S4</strong>");
    expect(html).toContain("Ouverture prévue en S5");expect(html).toContain("cartes et notes de test issues de S3");
    expect(html).toContain("/ 68");
    expect(html).not.toMatch(/ultra.holo/i);
    const cover=renderToStaticMarkup(<CollectorAlbumCover season={4} count={0} total={68} gamesEdition/>);
    expect(cover).toContain("souvenir cycliste de la saison 4");
  });
  it("shows all 18 numbered collectible intro slots, with genuine distinctive jerseys",()=>{
    const html=renderToStaticMarkup(<CycloStickersIntroduction snapshot={snapshot} state={state} ready onAction={onAction}/>);
    expect([...html.matchAll(/data-intro-sticker="(\d+)"/g)].map(m=>Number(m[1]))).toEqual(Array.from({length:18},(_,i)=>i+51));
    expect(html).toContain("Mathieu Laurent");expect(html).toContain("Zaven Davtyan");
    expect(html).toContain("Kaffa Origins");expect(html).toContain("Le champion des Jeux");
    expect(html).toContain("champion-jersey-v1.webp");
    expect(html).not.toMatch(/ultra.holo/i);
    expect(html.match(/>Coller ce sticker<\/button>/g)).toHaveLength(18);
  });
  it("keeps S4 on closed packs but does not mislabel the test statistics as final S4",()=>{
    const html=renderToStaticMarkup(<CollectorAlbumBoosters snapshot={snapshot} state={state} ready onAction={onAction} onViewAlbum={()=>{}}/>);
    expect(html).toContain("ÉDITION <b>S4</b>");expect(html).toContain("CARTES DE TEST");
    expect(html).toContain("les notes restent celles de S3");
    expect(html).not.toMatch(/ultra.holo/i);
  });
});
