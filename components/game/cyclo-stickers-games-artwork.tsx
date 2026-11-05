import { useId } from "react";
import { HalloweenHeadlessRider } from "@/components/halloween/halloween-night-ride";
import { QUADRENNIAL_GAMES_EMBLEM } from "@/lib/game/quadrennial-games";

const GAMES_LANES = ["#4387b4", "#dfb957", "#202735", "#719575", "#c16b52"];

/** One spot-colour scene, shared by the S4 book and its foil wrappers. */
export function CycloStickersGamesArtwork({ className = "" }: { className?: string }) {
  const id = useId().replaceAll(":", "");
  return <svg viewBox="0 0 640 440" className={className} role="img" aria-label="La nuit des Jeux : l’Équipier sans tête porte la flamme sur un vélodrome aux cinq couleurs des Jeux quadriennaux" data-album-games-scene="night-velodrome">
    <defs>
      <pattern id={`${id}-grain`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".55" fill="#f3dfb5" opacity=".12" /></pattern>
      <radialGradient id={`${id}-flame-light`}><stop stopColor="#e7b46b" stopOpacity=".3" /><stop offset="1" stopColor="#e7b46b" stopOpacity="0" /></radialGradient>
      <clipPath id={`${id}-scene`}><path d="M18 18h604v371H18Z" /></clipPath>
    </defs>
    <path d="M0 0h640v440H0Z" fill="#202735" />
    <g clipPath={`url(#${id}-scene)`}>
      <circle cx="135" cy="108" r="66" fill="#3e3d49" />
      <circle cx="135" cy="108" r="48" fill="#e8d7b2" />
      <path d="M105 76q-24 43 17 74-56-20-29-62Z" fill="#d0bb98" />
      <g fill="#c7ae83"><circle cx="151" cy="86" r="5" /><circle cx="156" cy="123" r="8" /><circle cx="123" cy="129" r="3" /></g>
      <g fill="#d8c39f" opacity=".75"><circle cx="230" cy="63" r="1.5" /><circle cx="341" cy="43" r="1.5" /><circle cx="536" cy="64" r="1.5" /><circle cx="587" cy="100" r="1" /><path d="M280 104h8m-4-4v8M456 64h8m-4-4v8" fill="none" stroke="#d8c39f" /></g>
      <path d="M-10 242Q92 160 195 212t185-9q127-90 270 21v96H-10Z" fill="#353442" />
      <path d="M-10 277q116-64 226-20t234-19q105-39 200 12v97H-10Z" fill="#4b4149" />

      {/* The Games mark belongs to the lit stadium facade, rather than a label. */}
      <g data-album-games-stadium="">
        <path d="M340 231q112-112 263-14l-8 34H345Z" fill="#283443" />
        <path d="M333 223q126-113 277-8l-7 10q-142-94-267 9Z" fill="#c4a271" />
        <path d="M349 228q111-87 245-4" fill="none" stroke="#e3cc9d" strokeWidth="2" />
        {[365, 392, 420, 449, 478, 507, 536, 565, 589].map((x, index) => <path key={x} d={`M${x} ${211 - Math.sin(index / 8 * Math.PI) * 34}v25`} stroke="#8d7a64" strokeWidth="2" />)}
        <path d="M426 207q44-15 89-2" fill="none" stroke="#e5c38b" strokeWidth="1.5" />
        <image href={QUADRENNIAL_GAMES_EMBLEM} x="424" y="161" width="103" height="36" preserveAspectRatio="xMidYMid meet" opacity=".85" aria-hidden="true" data-album-games-emblem="stadium" />
        <path d="m348 215-19-84m248 76 13-90" stroke="#867666" strokeWidth="3" />
        <path d="m316 132 27-6m233-11 28 4" stroke="#ead5ac" strokeWidth="5" />
        <path d="m323 136-27 98h90Zm263-14-43 102 76-5Z" fill="#e5c990" opacity=".045" />
      </g>

      {/* The same banked track carries the rider and all five Games colours. */}
      <path d="M-33 342Q117 397 361 301t316-31v170H-33Z" fill="#9b735c" />
      <path d="M-33 356Q120 411 368 315t309-31v156H-33Z" fill="#72594f" />
      <path d="M-33 385Q132 433 383 341t294-26" fill="none" stroke="#e4c89a" strokeWidth="2" opacity=".75" />
      <g data-album-games-lanes="5" fill="none" strokeWidth="4">
        {GAMES_LANES.map((color, index) => <path key={color} d={`M-30 ${365 + index * 7}Q126 ${418 + index * 7} 374 ${323 + index * 7}T675 ${293 + index * 7}`} stroke={color} />)}
      </g>
      <path d="M-10 327q65-3 108-39" fill="none" stroke="#dbc095" strokeWidth="1.5" strokeDasharray="13 10" opacity=".6" />

      <g fill="none" stroke="#191f2b" strokeWidth="6" strokeLinecap="round"><path d="M43 326 54 189l-5-57m3 81-23-24-7-29m31 40 24-30 7-31" /><path d="m39 279-20-16m32-21 24-16" strokeWidth="4" /></g>
      <g fill="#191f2b"><path d="m213 133-15-6 7 9 7-1 8 7 9-7 7 1 8-9-16 6-7 3Z" /><path d="m263 93-10-5 5 7 5-1 6 5 6-5 5 1 5-7-11 5-5 2Z" /></g>
      <ellipse cx="343" cy="356" rx="115" ry="14" fill="#302c35" opacity=".35" />
      <circle cx="420" cy="186" r="104" fill={`url(#${id}-flame-light)`} />
      <g data-album-games-flame="" strokeLinecap="round" strokeLinejoin="round">
        <path d="m405 249 16-60" stroke="#352d33" strokeWidth="11" />
        <path d="m405 249 16-60" stroke="#c49b68" strokeWidth="6" />
        <path d="m414 195 15 4 10-19-21-6Z" fill="#d7b27c" stroke="#e7cca0" strokeWidth="1.5" />
        <path d="M425 180c-31-13-6-31-9-48 10 10 7 16 13 18 2-18 15-25 12-42 33 38 21 62-3 75Z" fill="#c27347" />
        <path d="M428 178c-15-11-4-22-1-30 1 12 10 7 13-6 12 18 6 29-3 38Z" fill="#efd196" />
      </g>
      <svg x="165" y="95" width="312" height="300" aria-hidden="true"><HalloweenHeadlessRider decorative /></svg>
      <path d="m405 250 6-2" stroke="#3d3238" strokeWidth="9" strokeLinecap="round" />
      <path d="M0 0h640v440H0Z" fill={`url(#${id}-grain)`} />
    </g>
    <path d="M18 18h604v371H18Z" fill="none" stroke="#b89264" strokeWidth="1" />
    <path d="M32 30h32m-32 0v27m576-27h-32m32 0v27" fill="none" stroke="#d6b582" strokeWidth="2" />
    <text x="320" y="418" fill="#e8d5ad" fontFamily="Georgia,serif" fontSize="19" letterSpacing="3" textAnchor="middle">LA NUIT DES JEUX</text>
  </svg>;
}
