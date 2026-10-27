import type { JourneyTrophyVisualVariant } from "@/lib/game/achievement-trophies";
import type { TrophyPalette } from "@/lib/game/trophy-gallery";

type Variant = JourneyTrophyVisualVariant | "first-pedals";

/** Small, flat vector sculptures: no images, filters, ids or browser work. */
export function JourneyTrophySymbol({ variant, palette }: { variant: Variant; palette: TrophyPalette }) {
  return <g data-achievement-symbol={variant} stroke={palette.secondary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <Symbol variant={variant} palette={palette} />
  </g>;
}

function Symbol({ variant, palette: p }: { variant: Variant; palette: TrophyPalette }) {
  switch (variant) {
    case "journey-community_days":
      return <>
        <path d="M37 42h92v62H82l-24 22v-22H37Z" fill={p.accent} />
        <path d="M57 61h53M57 75h37" stroke={p.primary} strokeWidth="6" />
        <path d="M113 76h30v39h-12l-12 13v-13h-15V96" fill={p.primary} />
        <circle cx="123" cy="94" r="4" fill={p.accent} stroke="none" />
      </>;
    case "journey-private_contacts":
      return <>
        <rect x="49" y="33" width="83" height="98" rx="9" fill={p.accent} />
        <path d="M65 34v96M44 52h13M44 73h13M44 94h13M44 115h13" stroke={p.primary} strokeWidth="5" />
        <circle cx="98" cy="67" r="14" fill={p.primary} />
        <path d="M77 108V98c0-21 42-21 42 0v10Z" fill={p.primary} />
        <path d="M132 48h9v18h-9M132 78h9v18h-9" fill={p.primary} />
      </>;
    case "journey-transfer_sent":
      return <>
        <path d="m34 80 112-45-32 95-27-33-33 21 8-32Z" fill={p.primary} />
        <path d="m62 86 84-51-59 62M87 97l-3 26-13-16" stroke={p.accent} />
        <path d="M35 108h14M30 123h27M38 64h17" stroke={p.primary} strokeWidth="4" />
      </>;
    case "journey-transfer_received":
      return <>
        <path d="M41 76h98l10 51H31Z" fill={p.accent} />
        <path d="M33 104h36l8 13h26l8-13h36" stroke={p.primary} strokeWidth="5" />
        <path d="M80 34h20v32h20L90 96 60 66h20Z" fill={p.primary} />
        <path d="m130 39 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill={p.secondary} stroke="none" />
      </>;
    case "journey-interview_support_given":
      return <>
        <path d="M40 112 69 87l19 7 25-4 25 20-25 19H64Z" fill={p.primary} />
        <path d="M73 106h31l9-6M57 99l12 25" stroke={p.accent} />
        <path d="M93 83C56 62 68 29 86 43l7 8 7-8c18-14 30 19-7 40Z" fill={p.accent} />
        <path d="m50 52 6 6M126 53l7-7M93 27v8" stroke={p.primary} strokeWidth="4" />
      </>;
    case "journey-interview_support_received":
      return <>
        <path d="m90 31 10 23 25-7-4 26 23 12-22 14 3 25-25-5-10 14-11-14-25 5 3-25-22-14 23-12-4-26 25 7Z" fill={p.primary} />
        <path d="M66 64h48v34H94l-13 12V98H66Z" fill={p.accent} />
        <path d="M90 91c-18-10-14-23-5-18l5 5 5-5c9-5 13 8-5 18Z" fill={p.secondary} stroke="none" />
      </>;
    case "journey-gazette_days":
      return <>
        <path d="M44 37h89v88H44Z" fill={p.secondary} stroke={p.primary} />
        <path d="M44 57H32v62c0 15 18 15 18 0V56M59 52h59" stroke={p.accent} strokeWidth="5" />
        <path d="M59 67h24v26H59Z" fill={p.primary} stroke={p.accent} />
        <path d="M94 68h23M94 79h23M94 90h23M59 105h58M59 116h41" stroke={p.accent} strokeWidth="4" />
      </>;
    case "journey-game_variety":
      return <>
        <path d="M36 45h90v83H36Z" fill={p.accent} />
        <path d="M66 45v83M96 45v83M36 73h90M36 101h90" stroke={p.primary} />
        <path d="M38 47h26v24H38M68 75h26v24H68M98 103h26v23H98" fill={p.primary} stroke="none" />
        <path d="m105 40 13-12 34 37-13 12Z" fill={p.secondary} stroke={p.accent} />
        <path d="m105 40-5 20 18-8Z" fill={p.primary} stroke={p.accent} />
      </>;
    case "journey-first_deal":
      return <>
        <path d="m31 76 24-24 26 8 20-6 47 35-24 36-24-7-17 9-23-12-29-23Z" fill={p.primary} />
        <path d="m57 62 28 15 17-11 33 27-19 23M50 72l-9 15M72 101l14 17M88 94l17 22M104 88l19 19" stroke={p.accent} strokeWidth="4" />
        <path d="m37 68 15 28-13 11-22-27ZM139 65l-13 25 15 15 20-28Z" fill={p.accent} />
      </>;
    case "journey-interview_regular":
      return <>
        <path d="M52 94v6c0 41 76 41 76 0v-6M90 130v-16" stroke={p.primary} strokeWidth="6" />
        <rect x="67" y="29" width="46" height="76" rx="23" fill={p.accent} />
        <path d="M77 46h26M77 59h26M77 72h26M79 85h22" stroke={p.primary} strokeWidth="4" />
        <path d="m38 59-9-5M142 59l9-5M34 83H23M146 83h11" stroke={p.primary} />
      </>;
    case "journey-natural_progress":
      return <>
        <path d="M39 129V95h23v34M69 129V76h23v53M99 129V56h23v73" fill={p.accent} stroke={p.primary} />
        <path d="m38 77 26-22 22 6 42-32M107 29h21v21" stroke={p.secondary} strokeWidth="6" />
        <path d="M32 131h103" stroke={p.primary} strokeWidth="5" />
      </>;
    case "journey-tailored_setup":
      return <>
        <path d="M81 36h18l4 13 13 7 14-3 9 16-10 10v15l10 10-9 16-14-3-13 7-4 10H81l-4-10-13-7-14 3-9-16 10-10V79L41 69l9-16 14 3 13-7Z" fill={p.accent} />
        <circle cx="90" cy="85" r="25" stroke={p.primary} strokeWidth="5" />
        <path d="m58 122 42-42c-8-18 2-28 18-27l-10 12 9 10 12-11c2 16-8 27-25 21l-36 45Z" fill={p.primary} stroke={p.secondary} />
      </>;
    case "journey-panache":
      return <>
        <path d="M94 27c15 33 46 44 36 75-6 20-22 31-42 31-27 0-44-19-40-42 2-12 12-25 22-34-1 18 6 21 10 16 9-11 12-30 14-46Z" fill={p.primary} />
        <path d="M94 77c2 17 19 21 17 37-2 13-27 20-37 4-10-16 9-26 20-41Z" fill={p.secondary} stroke={p.accent} />
      </>;
    case "journey-world_traveler":
      return <>
        <circle cx="87" cy="75" r="40" fill={p.accent} stroke={p.primary} />
        <ellipse cx="87" cy="75" rx="18" ry="40" stroke={p.primary} />
        <path d="M48 75h78M55 54h64M55 96h64" stroke={p.primary} />
        <path d="M37 103c-27 26 52 26 98-18" stroke={p.secondary} strokeWidth="4" />
        <path d="m125 78 13-7-4 18-7-4-7 1Z" fill={p.secondary} stroke="none" />
        <path d="m63 120 14 11h30" stroke={p.primary} strokeWidth="5" />
      </>;
    case "journey-shopkeeper":
      return <>
        <path d="M46 68h89v61H46Z" fill={p.accent} />
        <path d="m44 39-9 30h109l-10-30Z" fill={p.primary} />
        <path d="m58 40-4 29M78 40l-1 29M100 40l1 29M120 40l5 29" stroke={p.accent} strokeWidth="6" />
        <path d="M54 85h30v26H54ZM100 85h23v44h-23Z" fill={p.primary} />
        <path d="M40 131h101" stroke={p.secondary} strokeWidth="5" />
      </>;
    case "journey-mentor":
      return <>
        <path d="m90 57-34-11-19 14v58l19-10 34 12 34-12 19 10V60l-19-14Z" fill={p.accent} />
        <path d="M90 62v58M48 70l25 7M48 86l25 7M107 77l25-7M107 93l25-7" stroke={p.primary} />
        <path d="m90 27 38 14-38 16-38-16Z" fill={p.primary} />
        <path d="M125 43v24M120 66h10" stroke={p.secondary} />
      </>;
    case "journey-research_podium":
      return <>
        <path d="M80 31h27M84 32v28l-25 43c-5 9 0 16 10 16h49c10 0 15-7 10-16l-25-43V32" fill={p.accent} />
        <path d="M76 84h35l14 24c2 4 0 6-6 6H69c-6 0-8-2-6-6Z" fill={p.primary} stroke="none" />
        <circle cx="91" cy="91" r="4" fill={p.secondary} stroke="none" />
        <circle cx="105" cy="102" r="3" fill={p.secondary} stroke="none" />
        <path d="M51 132v-10h29v-6h27v6h31v10Z" fill={p.primary} />
        <path d="m46 49 3 7 8 3-8 3-3 8-3-8-7-3 7-3Z" fill={p.primary} stroke="none" />
      </>;
    case "journey-homegrown":
      return <>
        <path d="m35 79 55-45 55 45h-15v49H50V79Z" fill={p.accent} stroke={p.primary} />
        <path d="M90 120V72M90 95c-21 1-30-11-26-24 17-2 26 9 26 24ZM90 85c21 1 30-11 26-24-17-2-26 9-26 24Z" fill={p.primary} />
        <path d="M69 130h42" stroke={p.secondary} strokeWidth="5" />
      </>;
    case "journey-three_tours":
      return <>
        <path d="M35 127V64h32v63Z" fill="#EC86AF" />
        <path d="M74 127V38h32v89Z" fill="#F4D05A" />
        <path d="M113 127V54h32v73Z" fill="#D95555" />
        <path d="m39 64 12-16 12 16M78 38l12-16 12 16M117 54l12-16 12 16" fill={p.secondary} />
        <path d="M45 82h12M84 60h12M123 74h12M29 131h122" stroke={p.accent} strokeWidth="4" />
      </>;
    case "journey-family_photo":
      return <>
        <path d="M34 51h112v78H34Z" fill={p.accent} stroke={p.primary} strokeWidth="5" />
        <path d="m47 51 9-15h25l10 15" fill={p.primary} />
        <circle cx="90" cy="91" r="29" fill={p.primary} />
        <circle cx="90" cy="91" r="22" fill={p.accent} />
        <circle cx="90" cy="80" r="6" fill={p.secondary} stroke="none" />
        <circle cx="77" cy="88" r="5" fill={p.primary} stroke="none" />
        <circle cx="103" cy="88" r="5" fill={p.primary} stroke="none" />
        <path d="M78 103c0-15 24-15 24 0M70 103c0-9 7-12 12-7M110 103c0-9-7-12-12-7" />
        <path d="M126 65h10" stroke={p.secondary} strokeWidth="5" />
      </>;
    case "journey-upset":
      return <>
        <path d="m90 28 12 29 32-9-10 31 25 18-31 7-1 28-27-14-27 14-1-28-31-7 25-18-10-31 32 9Z" fill={p.accent} />
        <path d="m98 43-33 48h23l-5 31 32-47H92Z" fill={p.primary} />
        <path d="m42 31 4 9M138 31l-4 9M25 65l10 3M155 65l-10 3" stroke={p.secondary} strokeWidth="4" />
      </>;
    case "first-pedals":
      return <>
        <path d="M40 128h100M44 47h90M49 36v92M129 36v92" stroke={p.primary} strokeWidth="5" />
        <path d="M50 47h78v22H50Z" fill={p.secondary} />
        <path d="M51 48h15v10H51M81 48h15v10H81M111 48h16v10h-16M66 59h15v9H66M96 59h15v9H96" fill={p.accent} stroke="none" />
        <circle cx="62" cy="107" r="18" fill={p.accent} stroke={p.secondary} />
        <circle cx="119" cy="107" r="18" fill={p.accent} stroke={p.secondary} />
        <path d="m62 107 17-29 20 29H62l24-15h26l7 15M108 92l-5-17h12M73 77h15" stroke={p.primary} strokeWidth="4" />
      </>;
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}
