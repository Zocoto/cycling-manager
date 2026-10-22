import { useId } from "react";
import { HalloweenNightRide } from "@/components/halloween/halloween-night-ride";
import { QUADRENNIAL_GAMES_EMBLEM } from "@/lib/game/quadrennial-games";

/** Reuse the game's approved character, as a souvenir printed on the S4 edition. */
export function CycloStickersGamesArtwork({className=""}:{className?:string}) {
  const id=useId().replaceAll(":","");
  return <svg viewBox="0 0 640 440" className={className} role="img" aria-label="Saison 4 : la légende de l’Équipier sans tête et les Jeux quadriennaux">
    <defs><pattern id={`${id}-grain`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".6" fill="#e9d9b5" opacity=".18"/></pattern></defs>
    <path d="M0 0h640v440H0Z" fill="#25232d"/>
    <svg x="0" y="36" width="640" height="351" viewBox="0 0 620 340"><HalloweenNightRide decorative/></svg>
    <path d="M0 0h640v440H0Z" fill={`url(#${id}-grain)`}/>
    <g data-album-games-emblem>
      <rect x="34" y="50" width="238" height="82" fill="#f7edcf" stroke="#d5ac6c" strokeWidth="2"/>
      <rect x="39" y="55" width="228" height="72" fill="none" stroke="#9c8059" strokeWidth=".7"/>
      <image href={QUADRENNIAL_GAMES_EMBLEM} x="46" y="56" width="214" height="72" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Emblème des Jeux quadriennaux"/>
    </g>
    <path d="M18 18h604v404H18Z" fill="none" stroke="#d5ac6c" opacity=".6"/>
    <text x="320" y="41" fill="#e8d5ad" fontFamily="Georgia,serif" fontSize="17" fontStyle="italic" textAnchor="middle">Les nuits du peloton</text>
    <text x="320" y="411" fill="#e8d5ad" fontFamily="'Courier New',monospace" fontSize="11" letterSpacing="2" textAnchor="middle">L’ÉQUIPIER SANS TÊTE · SAISON 4</text>
  </svg>;
}
