import { useId } from "react";
import type { AlbumProfile } from "@/lib/game/collector-album";

type AlbumProfileArtworkProps = {
  profile: AlbumProfile;
  className?: string;
  decorative?: boolean;
};

const INK = {
  blue: "#294b59",
  sage: "#8aa694",
  brick: "#b95542",
  yellow: "#dfb756",
  paper: "#f1ecd9",
};

const SCENE_DESCRIPTIONS: Record<AlbumProfile, string> = {
  tours: "Affiche cycliste : route de grand tour entre un lac et les sommets alpins",
  mountain: "Affiche cycliste : cols enneigés et route en lacets de haute montagne",
  hills: "Affiche cycliste : côtes, vergers et village au milieu des collines",
  sprint: "Affiche cycliste : piste, tribunes et ligne d’arrivée d’un sprint",
  cobbles: "Affiche cycliste : secteur pavé, moulin et paysages des classiques du Nord",
  timeTrial: "Affiche cycliste : route en perspective et chronomètre du contre-la-montre",
  breakaway: "Affiche cycliste : échappée sur une route de campagne entre champs et bosquets",
};

/** Original vector drawings, composed like four-ink cycling travel posters. */
export function AlbumProfileArtwork({ profile, className = "", decorative = true }: AlbumProfileArtworkProps) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = {
    dots: `album-${instanceId}-dots`,
    lines: `album-${instanceId}-lines`,
    stones: `album-${instanceId}-stones`,
    checks: `album-${instanceId}-checks`,
    title: `album-${instanceId}-title`,
  };

  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      data-album-profile={profile}
      aria-hidden={decorative ? true : undefined}
      aria-labelledby={decorative ? undefined : ids.title}
      role={decorative ? undefined : "img"}
      focusable="false"
    >
      {!decorative && <title id={ids.title}>{SCENE_DESCRIPTIONS[profile]}</title>}
      <defs>
        <pattern id={ids.dots} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill={INK.blue} opacity=".16" />
        </pattern>
        <pattern id={ids.lines} width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
          <path d="M0 0V13" stroke={INK.blue} strokeWidth="1" opacity=".15" />
        </pattern>
        <pattern id={ids.stones} width="86" height="48" patternUnits="userSpaceOnUse">
          <path d="M2 3 38 1 41 21 3 23ZM47 2 82 4 84 23 46 22ZM-17 28 17 26 19 45-15 47ZM23 28 61 26 63 46 24 47ZM68 29 105 27 108 46 68 47Z" fill={INK.paper} opacity=".58" />
          <path d="m7 6 24-1m21 2 22 2M29 31l23-2m21 4 20-2" stroke={INK.blue} strokeWidth="1.3" opacity=".25" />
        </pattern>
        <pattern id={ids.checks} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M0 0H16V16H0ZM16 16H32V32H16Z" fill={INK.blue} />
          <path d="M16 0H32V16H16ZM0 16H16V32H0Z" fill={INK.paper} />
        </pattern>
      </defs>
      <path d="M0 0H1200V700H0Z" fill={INK.paper} />
      {profile === "tours" && <TourScene dots={ids.dots} />}
      {profile === "mountain" && <MountainScene lines={ids.lines} />}
      {profile === "hills" && <HillsScene dots={ids.dots} />}
      {profile === "sprint" && <SprintScene dots={ids.dots} checks={ids.checks} />}
      {profile === "cobbles" && <CobblesScene stones={ids.stones} lines={ids.lines} />}
      {profile === "timeTrial" && <TimeTrialScene lines={ids.lines} />}
      {profile === "breakaway" && <BreakawayScene dots={ids.dots} />}
      <path d="M18 18H1182V682H18Z" fill="none" stroke={INK.blue} strokeWidth="2" opacity=".22" />
      <path d="M29 29H1171M29 671H1171" stroke={INK.paper} strokeWidth="2" opacity=".8" />
    </svg>
  );
}

function TourScene({ dots }: { dots: string }) {
  return (
    <g>
      <path d="M0 0H1200V302H0Z" fill={INK.sage} opacity=".22" />
      <circle cx="932" cy="139" r="99" fill={INK.yellow} />
      <path d="M0 365 170 150 259 250 446 58 620 261 736 156 908 332 1057 213 1200 322V450H0Z" fill={INK.sage} />
      <path d="m344 175 102-117 103 119-57-22-42-45-36 52-34-7Zm-238 56 64-81 65 73-42-20-21-27-26 37Z" fill={INK.paper} />
      <path d="m445 113 44 79 105 103-88-38-44-82-44 54-72 26Z" fill={INK.blue} opacity=".35" />
      <path d="M0 417c141-72 257-54 394-9s266 19 395-22 275-17 411 31v151H0Z" fill={INK.blue} />
      <path d="M232 451c147-37 235-4 352 10s218-18 342-8l-99 93-605-2Z" fill={INK.paper} opacity=".8" />
      <path d="M258 470h371m-279 17h454m-328 17h210" stroke={INK.sage} strokeWidth="3" />
      <path d="M0 483c187 5 244 49 329 97 113 65 384 38 500-1 157-52 256-32 371-6v127H0Z" fill={INK.sage} />
      <path d="M0 483c187 5 244 49 329 97 113 65 384 38 500-1 157-52 256-32 371-6v127H0Z" fill={`url(#${dots})`} />
      <path d="M-45 693c184-105 293-42 448-73s180-105 325-99 253 118 517 80" fill="none" stroke={INK.paper} strokeWidth="49" />
      <path d="M-45 693c184-105 293-42 448-73s180-105 325-99 253 118 517 80" fill="none" stroke={INK.blue} strokeWidth="35" />
      <path d="M-45 693c184-105 293-42 448-73s180-105 325-99 253 118 517 80" fill="none" stroke={INK.yellow} strokeWidth="2" strokeDasharray="24 22" />
      <g transform="translate(971 389)"><AlpineChalet /></g>
      <g transform="translate(190 629) rotate(-1) scale(.56) translate(-110 -130)"><PosterCyclist jersey={INK.brick} /></g>
      <g transform="translate(638 530) rotate(-15) scale(.4) translate(-110 -130)"><PosterCyclist jersey={INK.yellow} /></g>
      <Pine x={45} y={403} scale={1.1} />
      <Pine x={1113} y={433} scale={1.45} />
    </g>
  );
}

function MountainScene({ lines }: { lines: string }) {
  return (
    <g>
      <path d="M0 0H1200V360H0Z" fill={INK.blue} opacity=".12" />
      <circle cx="977" cy="116" r="78" fill={INK.yellow} />
      <path d="M0 366 137 204 222 286 415 62 603 294 751 114 997 372 1121 232 1200 303V700H0Z" fill={INK.sage} />
      <path d="M60 407 258 169 356 305 527 31 739 342 871 191 1081 436 1200 358V700H0Z" fill={INK.blue} />
      <path d="m185 257 73-88 98 136-68-39-23-42-31 47-19-24Zm227-42 115-184 133 195-64-38-30-50-31 18-24-55-55 90-22-5Zm392 53 67-77 66 78-37-14-31-35-31 46Z" fill={INK.paper} />
      <path d="m525 104 41 84 81 68-56-12-49-49-20-60-47 78-47 18Z" fill={INK.sage} />
      <path d="M0 583 216 355 384 476 588 318 799 506 1001 390 1200 499V700H0Z" fill={INK.sage} />
      <path d="M0 583 216 355 384 476 588 318 799 506 1001 390 1200 499V700H0Z" fill={`url(#${lines})`} />
      <path d="M103 726c83-112 312-91 399-130 63-28-165-24-123-66 26-26 215-26 238-55 21-27-102-21-82-44 14-16 62-20 93-42" fill="none" stroke={INK.paper} strokeWidth="31" strokeLinecap="round" />
      <path d="M103 726c83-112 312-91 399-130 63-28-165-24-123-66 26-26 215-26 238-55 21-27-102-21-82-44 14-16 62-20 93-42" fill="none" stroke={INK.blue} strokeWidth="19" strokeLinecap="round" />
      <path d="M102 725c84-111 313-90 400-129 63-28-165-24-123-66 26-26 215-26 238-55 21-27-102-21-82-44 14-16 62-20 93-42" fill="none" stroke={INK.yellow} strokeWidth="1.5" strokeDasharray="13 15" />
      <g transform="translate(546 497) rotate(-9) scale(.37) translate(-110 -130)"><PosterCyclist jersey={INK.brick} /></g>
      <g transform="translate(823 489)"><path d="M0 53V-13m0 0h83v36H0" fill={INK.paper} stroke={INK.blue} strokeWidth="4" /><path d="m16 12 16-13 16 13 16-13" fill="none" stroke={INK.brick} strokeWidth="4" /></g>
      <Pine x={46} y={573} scale={1.65} />
      <Pine x={1070} y={539} scale={1.25} />
      <Pine x={1141} y={574} scale={1.8} />
    </g>
  );
}

function HillsScene({ dots }: { dots: string }) {
  return (
    <g>
      <path d="M0 0H1200V353H0Z" fill={INK.sage} opacity=".19" />
      <circle cx="213" cy="145" r="89" fill={INK.yellow} />
      <path d="M0 343c99-127 206-130 327-29s178 23 277-65 198-84 309 10 188 81 287-7v448H0Z" fill={INK.sage} />
      <path d="M0 465c165-33 221-231 392-145 152 77 177 232 337 102 174-141 270-141 471-22v300H0Z" fill={INK.blue} />
      <path d="M0 534c184-116 329-89 485 9s289 43 407-41 215-17 308 51v147H0Z" fill={INK.yellow} />
      <path d="M0 534c184-116 329-89 485 9s289 43 407-41 215-17 308 51v147H0Z" fill={`url(#${dots})`} />
      <path d="M0 655c160-105 269-87 375-47 100 38 158 27 206-23 58-59-132-129-103-178 22-36 124-61 178-64" fill="none" stroke={INK.paper} strokeWidth="42" />
      <path d="M0 655c160-105 269-87 375-47 100 38 158 27 206-23 58-59-132-129-103-178 22-36 124-61 178-64" fill="none" stroke={INK.brick} strokeWidth="27" />
      <path d="M0 655c160-105 269-87 375-47 100 38 158 27 206-23 58-59-132-129-103-178 22-36 124-61 178-64" fill="none" stroke={INK.paper} strokeWidth="2" strokeDasharray="20 22" />
      <g transform="translate(802 208)"><Village /></g>
      <g fill="none" stroke={INK.paper} strokeWidth="3" opacity=".45"><path d="M723 594q170-137 385-34M762 622q163-130 378-28M800 652q157-121 340-25" /></g>
      {[78, 158, 247, 340].map((x, i) => <OrchardTree key={x} x={x} y={402 - i * 8} scale={.74} />)}
      <OrchardTree x={1091} y={390} scale={1.2} />
      <g transform="translate(507 628) rotate(-11) scale(.49) translate(-110 -130)"><PosterCyclist jersey={INK.yellow} /></g>
      <g transform="translate(151 586) rotate(-14) scale(.48) translate(-110 -130)"><PosterCyclist jersey={INK.blue} /></g>
    </g>
  );
}

function SprintScene({ dots, checks }: { dots: string; checks: string }) {
  return (
    <g>
      <path d="M0 0H1200V302H0Z" fill={INK.sage} opacity=".23" />
      <circle cx="190" cy="129" r="88" fill={INK.yellow} />
      <path d="M0 329 234 210 981 210 1200 329V490H0Z" fill={INK.blue} />
      <path d="m40 328 208-97h720l192 97Z" fill={INK.brick} />
      <path d="m40 328 208-97h720l192 97Z" fill={`url(#${dots})`} />
      <g fill="none" stroke={INK.paper} strokeWidth="3" opacity=".6"><path d="M168 272h871M112 296h981M238 233l-76 91m168-91-42 91m136-91-18 91m125-91 5 91m97-91 22 91m86-91 44 91m61-91 71 91" /></g>
      <ellipse cx="600" cy="518" rx="714" ry="245" fill={INK.paper} />
      <ellipse cx="600" cy="518" rx="655" ry="203" fill={INK.brick} />
      <g fill="none" stroke={INK.paper} strokeWidth="2" opacity=".8"><ellipse cx="600" cy="518" rx="622" ry="183" /><ellipse cx="600" cy="518" rx="588" ry="163" /><ellipse cx="600" cy="518" rx="553" ry="142" /></g>
      <ellipse cx="600" cy="518" rx="515" ry="121" fill={INK.sage} />
      <ellipse cx="600" cy="518" rx="515" ry="121" fill={`url(#${dots})`} />
      <path d="M876 343h41v327h-41Z" fill={`url(#${checks})`} transform="rotate(15 896 506)" />
      <path d="M365 359V109h492v250" fill="none" stroke={INK.blue} strokeWidth="12" />
      <path d="M349 116h524v60H349Z" fill={INK.yellow} />
      <path d="M349 176h524v14H349Z" fill={`url(#${checks})`} />
      <path d="m456 138 17 12-17 12m46-24 17 12-17 12m46-24 17 12-17 12m46-24 17 12-17 12m46-24 17 12-17 12m46-24 17 12-17 12m46-24 17 12-17 12" fill="none" stroke={INK.blue} strokeWidth="5" />
      <path d="M33 204v110m0-111 73 19-73 21m1130-39v110m0-111-73 19 73 21" fill={INK.brick} stroke={INK.blue} strokeWidth="3" />
      <g transform="translate(840 658) scale(.79) translate(-110 -130)"><PosterCyclist jersey={INK.yellow} /></g>
      <g transform="translate(565 676) scale(.72) translate(-110 -130)"><PosterCyclist jersey={INK.paper} /></g>
      <g transform="translate(334 653) scale(.65) translate(-110 -130)"><PosterCyclist jersey={INK.blue} /></g>
    </g>
  );
}

function CobblesScene({ stones, lines }: { stones: string; lines: string }) {
  return (
    <g>
      <path d="M0 0H1200V354H0Z" fill={INK.sage} opacity=".24" />
      <circle cx="244" cy="138" r="88" fill={INK.yellow} />
      <path d="M0 327q202-43 367-4t368-7 465 9v375H0Z" fill={INK.sage} />
      <path d="m0 389 454-55-206 366H0Zm1200-18-470-38 227 367h243Z" fill={INK.yellow} />
      <path d="m0 389 454-55-206 366H0Zm1200-18-470-38 227 367h243Z" fill={`url(#${lines})`} />
      <path d="m0 511 427-145m773 166L764 366M0 629l388-234m812 259L799 398" fill="none" stroke={INK.sage} strokeWidth="4" />
      <path d="m494 325 175 0 322 375H174Z" fill={INK.paper} />
      <path d="m517 325 130 0 282 375H233Z" fill={INK.blue} />
      <path d="m517 325 130 0 282 375H233Z" fill={`url(#${stones})`} />
      <path d="m444 437 33-48m248 55-36-48M330 589l49-66m459 80-53-68" stroke={INK.yellow} strokeWidth="6" />
      <g transform="translate(958 242)"><Windmill /></g>
      <g transform="translate(143 302) scale(.67)"><Village /></g>
      {[373, 418, 454].map((x, index) => <Poplar key={x} x={x} y={331 - index * 4} scale={.72 - index * .12} />)}
      {[832, 886, 958, 1060].map((x, index) => <Poplar key={x} x={x} y={363 + index * 15} scale={.66 + index * .16} />)}
      <g transform="translate(441 430) scale(.66)"><PosterCyclist jersey={INK.brick} /></g>
      <g transform="translate(553 334) scale(.3)"><PosterCyclist jersey={INK.yellow} /></g>
      <path d="M58 126h91m-62 13h81m844-65h74m-55 13h80" stroke={INK.paper} strokeWidth="6" strokeLinecap="round" opacity=".8" />
    </g>
  );
}

function TimeTrialScene({ lines }: { lines: string }) {
  return (
    <g>
      <path d="M0 0H1200V355H0Z" fill={INK.sage} opacity=".23" />
      <circle cx="223" cy="145" r="91" fill={INK.yellow} />
      <path d="M0 353c173-72 291-81 471-37s365-63 729 4v380H0Z" fill={INK.sage} />
      <path d="M0 394 520 325 328 700H0Zm1200-15-543-54 251 375h292Z" fill={INK.yellow} />
      <path d="M0 394 520 325 328 700H0Zm1200-15-543-54 251 375h292Z" fill={`url(#${lines})`} />
      <path d="m527 322 91 0 274 378H249Z" fill={INK.paper} />
      <path d="m539 322 67 0 237 378H299Z" fill={INK.blue} />
      <path d="m572 342-3 25m-6 32-5 37m-7 45-8 55m-10 64-11 86" fill="none" stroke={INK.paper} strokeWidth="6" />
      <path d="M0 500 456 372m744 169L690 373M0 624l409-210m791 257L747 410" fill="none" stroke={INK.brick} strokeWidth="3" opacity=".6" />
      <g transform="translate(960 158)">
        <path d="M-15-93h30v22h-30Zm-30-6h60v12h-60Z" fill={INK.blue} />
        <circle r="79" fill={INK.paper} stroke={INK.blue} strokeWidth="8" />
        <circle r="65" fill="none" stroke={INK.sage} strokeWidth="2" />
        {Array.from({ length: 12 }, (_, index) => <path key={index} d="M0-57V-48" stroke={INK.blue} strokeWidth="3" transform={`rotate(${index * 30})`} />)}
        <path d="M0 0V-39M0 0l27 17" stroke={INK.brick} strokeWidth="5" strokeLinecap="round" />
        <circle r="5" fill={INK.blue} />
      </g>
      <g fill="none" stroke={INK.blue} strokeWidth="3"><path d="M141 547V267m-29 25h58m-23-22h-11m192 147V283m-16 18h32m61 71v-77m-12 12h24" /><path d="M141 286q97 48 187 11 37 23 77 5" strokeWidth="1.5" /></g>
      <path d="M1009 549V348h72v201" fill={INK.paper} stroke={INK.blue} strokeWidth="4" />
      <path d="M1020 364h50v35h-50Z" fill={INK.brick} />
      <path d="M1026 425h38m-38 14h38m-38 14h24" stroke={INK.blue} strokeWidth="3" />
      <g transform="translate(455 412) scale(.9)"><PosterCyclist jersey={INK.brick} aero /></g>
      <path d="m346 500-80 14m71 8-119 24m112 3-66 16" stroke={INK.paper} strokeWidth="3" />
    </g>
  );
}

function BreakawayScene({ dots }: { dots: string }) {
  return (
    <g>
      <path d="M0 0H1200V340H0Z" fill={INK.sage} opacity=".2" />
      <circle cx="984" cy="127" r="91" fill={INK.yellow} />
      <path d="M0 352c203-114 380-78 539-2 167-111 400-104 661-32v382H0Z" fill={INK.sage} />
      <path d="M0 438c194-22 355-107 498-63 219 68 431 96 702-9v334H0Z" fill={INK.yellow} />
      <path d="M0 438c194-22 355-107 498-63 219 68 431 96 702-9v334H0Z" fill={`url(#${dots})`} />
      <path d="M0 615c204-147 396-142 561-99 233 62 421-26 639-14v198H0Z" fill={INK.sage} />
      <path d="M0 737c133-161 336-182 507-159s397-2 442-68-143-112-100-143c29-21 98-24 150-26" fill="none" stroke={INK.paper} strokeWidth="54" />
      <path d="M0 737c133-161 336-182 507-159s397-2 442-68-143-112-100-143c29-21 98-24 150-26" fill="none" stroke={INK.blue} strokeWidth="39" />
      <path d="M0 737c133-161 336-182 507-159s397-2 442-68-143-112-100-143c29-21 98-24 150-26" fill="none" stroke={INK.yellow} strokeWidth="2" strokeDasharray="26 25" />
      <g transform="translate(155 293)"><path d="M0 66V4h105v62Z" fill={INK.paper} /><path d="M-13 5 51-40 119 5Z" fill={INK.brick} /><path d="M37 66V25h31v41" fill={INK.blue} /><path d="M14 23h13v18H14m69-18h12v18H83" fill={INK.sage} /></g>
      <g fill="none" stroke={INK.paper} strokeWidth="3" opacity=".6"><path d="m18 467 196-60m-180 82 226-70m-209 95 259-79m-186 82 260-80" /></g>
      <OrchardTree x={377} y={322} scale={1.2} />
      <OrchardTree x={440} y={336} scale={.85} />
      <OrchardTree x={1110} y={495} scale={1.6} />
      <g transform="translate(197 601) rotate(-19) scale(.74) translate(-110 -130)"><PosterCyclist jersey={INK.brick} /></g>
      <g transform="translate(858 561) rotate(-16) scale(.36) translate(-110 -130)"><PosterCyclist jersey={INK.paper} /></g>
      <g transform="translate(966 341) scale(.22) translate(-110 -130)"><PosterCyclist jersey={INK.blue} /></g>
      <path d="M556 552v-91q0-18 16-18t16 18v91Z" fill={INK.paper} stroke={INK.blue} strokeWidth="3" />
      <path d="M556 461q16-14 32 0v13h-32Z" fill={INK.brick} />
      <path d="m564 496 8-6 8 6m-16 10h16" fill="none" stroke={INK.blue} strokeWidth="2" />
      <path d="M56 129h128m-85 16h104m516-53h99m-66 15h88" stroke={INK.paper} strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}

function PosterCyclist({ jersey, aero = false }: { jersey: string; aero?: boolean }) {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <g fill="none" stroke={INK.paper} strokeWidth="10"><circle cx="44" cy="130" r="37" /><circle cx="177" cy="130" r="37" /></g>
      <g fill="none" stroke={INK.blue} strokeWidth="7"><circle cx="44" cy="130" r="37" /><circle cx="177" cy="130" r="37" /></g>
      <g fill="none" stroke={INK.paper} strokeWidth="1.2"><path d="M8 130h72m-36-36v72m-26-62 51 51m-51 0 51-51M141 130h72m-36-36v72m-26-62 51 51m-51 0 51-51" /></g>
      <path d="m44 130 37-66 22 66H44l51-48h65l17 48m-17-48-6-18m-81 0h20m61 0h20l4 10-8 8" fill="none" stroke={INK.yellow} strokeWidth="5" />
      <path d="m90 66 24 28-12 35m-18-64-20 35 37 31" fill="none" stroke={INK.paper} strokeWidth="10" />
      <path d="m87 63 19 25-13 12-21-25Z" fill={INK.blue} />
      <path d={aero ? "M79 62q17-32 41-28l34 4-3 19-39-3-18 20Z" : "M78 61q12-35 39-37l30 22-15 24-28-15-15 20Z"} fill={jersey} stroke={INK.blue} strokeWidth="2" />
      <path d={aero ? "m147 49 13 14 28 1m-55-23 23 9 32 3" : "m135 54 16 24 24-8m-51-28 22 20 27-5"} fill="none" stroke={INK.paper} strokeWidth="7" />
      <circle cx={aero ? 157 : 145} cy={aero ? 25 : 24} r="12" fill={INK.paper} />
      <path d={aero ? "M142 25q1-20 27-10l12 10-26-3Z" : "M132 22q1-19 23-11l9 14-20-4-13 5Z"} fill={jersey} stroke={INK.blue} strokeWidth="2" />
      <path d="m101 129 13 4m-15-3-4 6" stroke={INK.blue} strokeWidth="5" />
    </g>
  );
}

function Pine({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} fill={INK.blue}><path d="M-4 0H4V109H-4Z" /><path d="M0-29-30 28h16l-29 42h24l-30 41H50L20 70h24L15 28h16Z" /></g>;
}

function Poplar({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M0 2V-104" stroke={INK.blue} strokeWidth="5" /><path d="M0-153c-34 36-28 89-18 123Q0-9 18-31c11-35 14-86-18-122Z" fill={INK.blue} /><path d="M0-127V-28" stroke={INK.sage} strokeWidth="2" /></g>;
}

function OrchardTree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M0 1v-64m0 39-20-20m20 28 21-25" fill="none" stroke={INK.blue} strokeWidth="6" /><path d="M-36-42c-18-31 3-54 20-54 18-27 55-16 59 8 28 5 36 45 12 58-30 20-52 8-64 0-13 4-23 0-27-12Z" fill={INK.blue} /><path d="M-23-76q20-23 47-9" fill="none" stroke={INK.sage} strokeWidth="4" /></g>;
}

function AlpineChalet() {
  return <g><path d="M0 60V4h94v56Z" fill={INK.paper} /><path d="M-14 8 48-30 109 8Z" fill={INK.brick} /><path d="M0 27h94m-82-14v24m70-24v24" stroke={INK.blue} strokeWidth="4" /><path d="M39 60V35h20v25M14 44h13v10H14m54-10h13v10H68" fill={INK.blue} /></g>;
}

function Village() {
  return <g><path d="M0 64V22h50v42m7 0V6h49v58m9 0V28h53v36" fill={INK.paper} /><path d="m-8 23 33-28 33 28ZM50 8 82-16 114 8Zm58 22 34-26 34 26Z" fill={INK.brick} /><path d="M181 64V-12h27v76" fill={INK.paper} /><path d="m174-11 20-41 21 41Z" fill={INK.blue} /><path d="M14 42h10v22H14m54-40h10v15H68m21 9h10v16H89m38-20h11v20h-11m64-61h9v19h-9" fill={INK.blue} /><path d="M-14 64h244" stroke={INK.blue} strokeWidth="3" /></g>;
}

function Windmill() {
  return <g><path d="m-33 84 13-112h40L34 84Z" fill={INK.paper} stroke={INK.blue} strokeWidth="3" /><path d="m-31-27 32-37 32 37Z" fill={INK.brick} /><path d="M-9 84V49H10v35" fill={INK.blue} /><g stroke={INK.blue} strokeWidth="5"><path d="M0-11-73-84M0-11 73-84M0-11-73 62M0-11 73 62" /></g><g fill={INK.brick} stroke={INK.blue} strokeWidth="2"><path d="m-13-29-46-58-16 13 54 49ZM18-25 76-72 63-87 14-32ZM-18 3-76 50-63 65-14 10ZM13 7 59 65 75 52 21 3Z" /></g><circle cy="-11" r="8" fill={INK.yellow} stroke={INK.blue} strokeWidth="3" /></g>;
}
