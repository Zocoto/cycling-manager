import type { InventoryCategory } from "@/lib/game/inventory";

type InventoryItemIllustrationProps = {
  name: string;
  iconKey: string;
  category?: InventoryCategory;
  effectKind?: string;
  compact?: boolean;
};

type IllustrationKind =
  | "nutrition"
  | "experience"
  | "training"
  | "scouting"
  | "equipment"
  | "rating"
  | "ability"
  | "passport"
  | "ticket"
  | "youth"
  | "staff"
  | "architect"
  | "medical"
  | "potential"
  | "object";

/**
 * Illustrations volontairement dessinées en SVG dans le produit : formes
 * simples, palette Cyclostratège et aucun fichier d'image généré.
 */
export function InventoryItemIllustration({
  name,
  iconKey,
  category,
  effectKind,
  compact = false,
}: InventoryItemIllustrationProps) {
  const kind = resolveIllustrationKind({ iconKey, category, effectKind });

  return (
    <div
      className={`overflow-hidden bg-[#071A17] ${compact ? "h-24 rounded-2xl" : "h-28"}`}
      data-inventory-illustration={kind}
    >
      <svg
        viewBox="0 0 320 112"
        className="h-full w-full"
        role="img"
        aria-label={`Illustration de ${name}`}
      >
        <rect width="320" height="112" fill="#0B302B" />
        <circle cx="35" cy="18" r="54" fill="#176951" opacity=".42" />
        <circle cx="293" cy="100" r="76" fill="#42B99A" opacity=".12" />
        <path
          d="M0 91C55 73 95 101 151 85s97-5 169-28v55H0Z"
          fill="#071A17"
          opacity=".72"
        />
        <path
          d="M18 88c47-14 78 5 117-4 42-10 73-33 167-31"
          fill="none"
          stroke="#9BE0BC"
          strokeWidth="2"
          strokeDasharray="5 7"
          opacity=".25"
        />
        <g transform="translate(112 8)">{renderIllustration(kind)}</g>
      </svg>
    </div>
  );
}

function resolveIllustrationKind({
  iconKey,
  category,
  effectKind,
}: Omit<InventoryItemIllustrationProps, "name" | "compact">): IllustrationKind {
  if (effectKind === "scouting_visibility" || iconKey === "scouting-clarity") {
    return "scouting";
  }
  if (effectKind === "injury_care" || iconKey === "medical") return "medical";
  if (effectKind === "instant_youth_promotion" || iconKey === "contract") {
    return "youth";
  }
  if (effectKind === "custom_staff_recruitment" ||
      effectKind === "staff_level_boost" || iconKey === "staff") {
    return "staff";
  }
  if (effectKind === "construction_time_reduction" || iconKey === "architect") {
    return "architect";
  }
  if (effectKind === "form_boost" || iconKey === "nutrition" || iconKey === "form") {
    return "nutrition";
  }
  if (effectKind === "rider_experience" || iconKey === "experience") {
    return "experience";
  }
  if (effectKind === "training_multiplier" || iconKey === "training") {
    return "training";
  }
  if (effectKind === "scouting_boost" || iconKey === "scouting") {
    return "scouting";
  }
  if (effectKind === "equipment" || iconKey === "equipment") return "equipment";
  if (effectKind === "rating_boost" || category === "rating_boost" || iconKey === "rating") {
    return "rating";
  }
  if (effectKind === "special_ability" || category === "special_ability" ||
      iconKey === "ability" || iconKey === "medallion") {
    return "ability";
  }
  if (effectKind === "naturalization" || iconKey === "passport") return "passport";
  if (effectKind === "wildcard" || iconKey === "ticket") return "ticket";
  if (category === "potential_boost" || iconKey === "potential") return "potential";
  return "object";
}

function renderIllustration(kind: IllustrationKind) {
  const common = {
    fill: "none",
    stroke: "#DDF3E7",
    strokeWidth: 4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "nutrition":
      return (
        <g {...common}>
          <path d="M38 19h21l4 12v49a10 10 0 0 1-10 10H38a10 10 0 0 1-10-10V31l10-12Z" fill="#176951" />
          <path d="M38 19v-8h21v8M29 42h33" />
          <path d="m47 49-9 17h10l-5 16 17-23H49l7-10Z" fill="#F2C94C" stroke="#F2C94C" />
        </g>
      );
    case "experience":
      return (
        <g {...common}>
          <circle cx="48" cy="49" r="30" fill="#176951" />
          <path d="M48 28v21l15 9M24 87h49M33 87l5-12h20l6 12" />
          <path d="M20 18h17M25 11v14" stroke="#F2C94C" />
        </g>
      );
    case "training":
      return (
        <g {...common}>
          <circle cx="48" cy="55" r="31" fill="#176951" />
          <path d="M48 55V36M48 55l15 10M39 14h18M48 14v10M69 30l7-7" />
          <path d="m18 78 12-7 7 12 18-4 17 8" stroke="#F2C94C" />
        </g>
      );
    case "scouting":
      return (
        <g {...common}>
          <rect x="17" y="18" width="52" height="65" rx="8" fill="#176951" />
          <path d="M28 33h30M28 45h21M28 57h13" />
          <circle cx="65" cy="68" r="20" fill="#0B302B" stroke="#F2C94C" />
          <path d="m79 82 12 12" stroke="#F2C94C" />
          <path d="m58 68 5 5 10-12" />
        </g>
      );
    case "equipment":
      return (
        <g {...common}>
          <circle cx="23" cy="72" r="19" />
          <circle cx="75" cy="72" r="19" />
          <path d="m23 72 17-29 15 29H23l27-19 25 19M40 43h19M50 53l8-18h11" />
          <circle cx="50" cy="53" r="5" fill="#F2C94C" stroke="#F2C94C" />
        </g>
      );
    case "rating":
      return (
        <g {...common}>
          <path d="M18 86V22M18 86h67" />
          <path d="m27 73 15-19 13 8 23-31" stroke="#F2C94C" strokeWidth="6" />
          <path d="M67 31h11v11" stroke="#F2C94C" />
          <circle cx="42" cy="54" r="4" fill="#DDF3E7" />
          <circle cx="55" cy="62" r="4" fill="#DDF3E7" />
        </g>
      );
    case "ability":
      return (
        <g {...common}>
          <circle cx="48" cy="48" r="32" fill="#176951" />
          <path d="m48 25 7 14 16 2-12 11 4 16-15-8-15 8 4-16-12-11 16-2Z" fill="#F2C94C" stroke="#F2C94C" />
          <path d="m35 77-7 18 20-9 20 9-7-18" />
        </g>
      );
    case "passport":
      return (
        <g {...common}>
          <rect x="20" y="14" width="58" height="78" rx="7" fill="#176951" />
          <circle cx="49" cy="48" r="16" stroke="#F2C94C" />
          <path d="M33 48h32M49 32c6 7 6 25 0 32M49 32c-6 7-6 25 0 32M34 76h30" stroke="#F2C94C" />
        </g>
      );
    case "ticket":
      return (
        <g {...common}>
          <path d="M15 34a10 10 0 0 0 0 20v22a10 10 0 0 0 10 10h56a10 10 0 0 0 10-10V54a10 10 0 0 0 0-20V18a10 10 0 0 0-10-10H25a10 10 0 0 0-10 10Z" fill="#176951" />
          <path d="M35 9v76" strokeDasharray="5 7" />
          <path d="m62 29 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z" fill="#F2C94C" stroke="#F2C94C" />
        </g>
      );
    case "youth":
      return (
        <g {...common}>
          <rect x="17" y="15" width="62" height="76" rx="8" fill="#176951" />
          <circle cx="38" cy="40" r="9" />
          <path d="M25 65c3-11 23-11 26 0M58 35h12M58 47h12M28 78h39" />
          <path d="M78 13v22M67 24h22" stroke="#F2C94C" strokeWidth="6" />
        </g>
      );
    case "staff":
      return (
        <g {...common}>
          <path d="M33 14h30l-5 18H38Z" fill="#176951" />
          <path d="m41 32-8 15 15 44 15-44-8-15" />
          <rect x="23" y="48" width="50" height="38" rx="8" fill="#176951" />
          <path d="M35 62h26M35 73h17" />
          <circle cx="72" cy="22" r="11" fill="#F2C94C" stroke="#F2C94C" />
        </g>
      );
    case "architect":
      return (
        <g {...common}>
          <path d="M15 82h75L52 15Z" fill="#176951" />
          <path d="M38 67h25L51 44Z" />
          <path d="m73 17 17 17M78 12l17 17-39 39-17 5 5-17Z" stroke="#F2C94C" />
        </g>
      );
    case "medical":
      return (
        <g {...common}>
          <rect x="13" y="29" width="76" height="59" rx="12" fill="#176951" />
          <path d="M34 29v-9a8 8 0 0 1 8-8h18a8 8 0 0 1 8 8v9" />
          <path d="M43 43h16v11h11v16H59v11H43V70H32V54h11Z" fill="#F2C94C" stroke="#F2C94C" />
        </g>
      );
    case "potential":
      return (
        <g {...common}>
          <path d="M19 86 48 17l29 69Z" fill="#176951" />
          <path d="M48 17v69M19 86l45-34M77 86 32 51" />
          <circle cx="48" cy="17" r="7" fill="#F2C94C" stroke="#F2C94C" />
          <path d="m71 19 6 6 12-14" stroke="#F2C94C" />
        </g>
      );
    default:
      return (
        <g {...common}>
          <path d="m16 35 32-20 32 20v48L48 99 16 83Z" fill="#176951" />
          <path d="m16 35 32 19 32-19M48 54v45" />
          <path d="m48 27 6 12 13 2-10 9 3 13-12-6-12 6 3-13-10-9 13-2Z" fill="#F2C94C" stroke="#F2C94C" />
        </g>
      );
  }
}
