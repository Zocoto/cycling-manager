import { useId } from "react";
import styles from "./collector-album-retro.module.css";
import { CycloStickersGamesArtwork } from "./cyclo-stickers-games-artwork";
import games from "./cyclo-stickers-games.module.css";

/** Deliberately drawn as flat spot-colour printing, not generated bitmap artwork. */
export function VintageCyclingArtwork({ className = "" }: {className?: string}) {
  const id = useId().replaceAll(":", "");
  return <svg viewBox="0 0 640 390" className={className} role="img" aria-label="Illustration cycliste rétro : deux coureurs sur une route de montagne">
    <defs><pattern id={`${id}-dots`} width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#233e4a" opacity=".24" /></pattern></defs>
    <path d="M0 0H640V390H0Z" fill="#e8dcb3" />
    <circle cx="489" cy="92" r="73" fill="#dfaa47" />
    <path d="M0 234 154 61 235 163 338 23 512 228 563 140 640 226V329H0Z" fill="#607f7b" />
    <path d="m94 128 60-67 45 56-46-21Zm191-30 53-75 65 77-68-39Z" fill="#eee4c6" />
    <path d="M0 275 144 189 265 249 407 149 640 267V355H0Z" fill="#aec0a1" />
    <path d="M0 319 640 241V390H0Z" fill="#293f48" />
    <path d="m0 374 640-78" stroke="#d8b265" strokeWidth="3" strokeDasharray="46 30" />
    <path d="M0 233 154 61 235 163 338 23 512 228 563 140 640 226V275L0 330Z" fill={`url(#${id}-dots)`} />
    <g transform="translate(340 120) scale(.65)" opacity=".86"><PrintedCyclist jersey="#e9cf76" shorts="#294652" skin="#c28a5f" /></g>
    <g transform="translate(53 111)"><PrintedCyclist jersey="#b44634" shorts="#213c49" skin="#c98e65" /></g>
    <path d="M0 384 640 306" stroke="#f5ead1" strokeWidth="2" />
    <path d="M25 28h70m-70 7h44M535 337h78m-54 7h54" stroke="#233e4a" strokeWidth="2" opacity=".6" />
  </svg>;
}

function PrintedCyclist({jersey, shorts, skin}: {jersey:string; shorts:string; skin:string}) {
  return <g strokeLinecap="round" strokeLinejoin="round">
    <g fill="none" stroke="#f5ead1" strokeWidth="3"><circle cx="64" cy="188" r="55" /><circle cx="253" cy="188" r="55" />{[0,30,60,90,120,150].map(a=><g key={a}><path d="M9 188h110" transform={`rotate(${a} 64 188)`} strokeWidth=".8" /><path d="M198 188h110" transform={`rotate(${a} 253 188)`} strokeWidth=".8" /></g>)}</g>
    <g fill="none" stroke="#1c3540" strokeWidth="7"><circle cx="64" cy="188" r="57" /><circle cx="253" cy="188" r="57" /></g>
    <path d="m64 188 55-100 35 100H64l75-69h91l-76 69m76-69 23 69m-23-69-8-27" fill="none" stroke="#e1c16b" strokeWidth="6" />
    <path d="m120 89-6-14m-18-1h35m90 18h29q16 0 11 17l-7 6" fill="none" stroke="#1c3540" strokeWidth="6" />
    <circle cx="154" cy="188" r="12" fill="#d4b05d" stroke="#1c3540" strokeWidth="2" />
    <path d="m154 188 24 17h19" fill="none" stroke="#e1d9bd" strokeWidth="4" />
    <path d="m124 82 36 47-13 54m-34-96-18 54 49 43" fill="none" stroke={skin} strokeWidth="15" />
    <path d="m124 82 29 37-22 16-31-40m13-13-10 35-23-10 12-34" fill={shorts} />
    <path d="m144 183 27 6-2 10-32-5m8-15 10 20 24 4-3 9-34-7-9-17" fill="#eee5c8" stroke="#1c3540" strokeWidth="2" />
    <path d="M106 77c9-25 26-43 58-40l40 27-18 31-39-18-23 15Z" fill={jersey} stroke="#243c44" strokeWidth="2" />
    <path d="m142 48 39 18-7 13-45-19" fill="#eee5c8" />
    <path d="m188 80 17 26 42-7m-70-32 26 25 43-5" fill="none" stroke={skin} strokeWidth="10" />
    <path d="m184 58 15 13-8 14-19-12" fill={jersey} />
    <path d="m187 45 9-15 18 7-12 21Z" fill={skin} />
    <path d="M195 15c20-6 35 10 29 25l-9 11-17-8-7-16Z" fill={skin} />
    <path d="M191 26c0-21 34-22 40-2l-4 8-19-7-18 6m31-5 22 7-17 4" fill="#f1e2b6" stroke="#263e47" strokeWidth="2" />
    <path d="m199 22 22 4m-24 7 3 5m17-3 6 2M122 93l5 16m20-62-18 20" stroke="#263e47" strokeWidth="2" fill="none" />
    <path d="m133 77-13 9-12-7m38 6 15 8" stroke="#e1c16b" strokeWidth="2" fill="none" />
  </g>;
}

export function AlbumBoosterArtwork({ sourceSeason, compact = false, gamesEdition = false, testSourceSeason }: {sourceSeason:number; compact?:boolean;gamesEdition?:boolean;testSourceSeason?:number}) {
  return <div className={`${styles.pack} ${compact ? styles.compactPack : ""} ${gamesEdition?games.gamesPack:""}`} aria-label={`Sachet fermé de deux cartes, édition saison ${sourceSeason}`}>
    <div className={styles.packCrimp} />
    <div className={styles.packPrint}><span className={styles.packPublisher}>CYCLO STRATÈGE · COLLECTION OFFICIELLE</span><strong className={styles.packSeason}>ÉDITION <b>S{sourceSeason}</b></strong><span className={`${styles.packTitle} ${gamesEdition?games.gamesPackTitle:""}`}>{gamesEdition?<>ALBUM DE<br/><em>CYCLO-STICKERS</em></>:<>LE GRAND<br /><em>PELOTON</em></>}</span>{gamesEdition?<CycloStickersGamesArtwork className={`${styles.packArtwork} ${games.gamesPackArt}`}/>:<VintageCyclingArtwork className={styles.packArtwork} />}<span className={styles.packCaption}>{gamesEdition?"LA SAISON DES JEUX":"LES CHAMPIONS DE LA SAISON"} {sourceSeason}</span><span className={styles.packBottom}>2 VIGNETTES · {testSourceSeason?"CARTES DE TEST":"NOTES FIGÉES"} S{testSourceSeason??sourceSeason} · TOP 50 UCI</span>{gamesEdition?<span className={games.gamesPackFoot}/>:null}</div>
    <div className={styles.packCrimp} />
  </div>;
}

export function CollectorAlbumTrophy({ season }: {season:number}) {
  return <svg viewBox="0 0 240 235" className={styles.trophyArtwork} role="img" aria-label={`Trophée Mémoire du peloton, saison ${season}`}>
    <path d="M49 98C4 96 8 33 58 45m133 53c45-2 41-65-9-53" fill="none" stroke="#9a6d29" strokeWidth="12" />
    <path d="M49 98C9 91 20 40 58 48m133 50c40-7 29-58-9-50" fill="none" stroke="#dfba62" strokeWidth="4" />
    <path d="M52 31h136l-13 64c-6 27-25 43-45 46v27h24v12H86v-12h24v-27c-20-3-39-19-45-46Z" fill="#d7af58" stroke="#8f6428" strokeWidth="3" />
    <path d="M66 40h22l12 84-20-16Zm62 0h41l-12 67-26 21Z" fill="#ecd08b" />
    <circle cx="120" cy="82" r="31" fill="#f5e6b9" stroke="#9c762e" strokeWidth="2" />
    <g fill="none" stroke="#8e692d" strokeWidth="2.4"><circle cx="105" cy="86" r="11" /><circle cx="138" cy="86" r="11" /><path d="m105 86 11-20 9 20h-20l15-14h13l5 14m-22-20h-5m17-6h5l1 10" /></g>
    <path d="M72 181h96v13H72Z" fill="#314b4e" /><path d="M59 194h122v29H59Z" fill="#233c43" /><path d="M68 201h104v16H68Z" fill="#c9a252" />
    <text x="120" y="212" fill="#253b3e" fontFamily="Georgia,serif" fontSize="10" textAnchor="middle">MÉMOIRE DU PELOTON · S{season}</text>
  </svg>;
}
