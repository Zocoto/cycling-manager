import type { AppLocale } from "@/lib/i18n/config";
import type { PublicGameNewsItem } from "@/lib/game/public-game-news";

const EXACT_TRANSLATIONS: Readonly<Record<string, string>> = {
  "Le mercato anime le peloton": "The transfer market shakes up the peloton",
  "Les classements annexes prennent forme": "The secondary classifications take shape",
  "Un nouveau directeur sportif prend place sur la ligne de départ.":
    "A new Sports Director takes their place on the start line.",
  "Un nouveau sponsor principal rejoint le peloton.":
    "A new main sponsor joins the peloton.",
  "Recrutement conclu parmi les agents libres.":
    "Signing completed from the free-agent market.",
  "Transfert conclu entre deux directeurs sportifs.":
    "Transfer completed between two Sports Directors.",
  "Recrutement conclu sur le marché quotidien.":
    "Signing completed through the daily market.",
};

export function localizeCyclogazetteText(
  value: string,
  locale: AppLocale,
): string {
  if (locale !== "en") return value;

  const exact = EXACT_TRANSLATIONS[value];
  if (exact) return exact;

  const rules: Array<[RegExp, string]> = [
    [/^L’essentiel du peloton au jour (\d+)$/u, "The peloton essentials on Day $1"],
    [/^(.+) s’impose$/u, "$1 wins"],
    [/^(.+) remporte (.+)\.$/u, "$1 wins $2."],
    [/^(.+) a rejoint le peloton$/u, "$1 has joined the peloton"],
    [/^(.+) rejoint (.+)$/u, "$1 joins $2"],
    [/^(.+) signe chez (.+)$/u, "$1 signs for $2"],
    [/^(.+) signe avec (.+)$/u, "$1 signs with $2"],
    [/^(.+) niveau (\d+), une nouvelle expertise rejoint l’équipe\.$/u, "$1 level $2 brings new expertise to the team."],
    [/^(.+) va au bout de l’échappée$/u, "$1 makes the breakaway stick"],
    [/^(.+) anime l’échappée$/u, "$1 drives the breakaway"],
    [/^(.+) transforme l’offensive en victoire sur (.+)\.$/u, "$1 turns the attack into victory on $2."],
    [/^(\d+) coureur\(s\) ont pris le large sur (.+)\.$/u, "$1 rider(s) went clear in $2."],
    [/^(.+) abandonne après une chute$/u, "$1 abandons after a crash"],
    [/^Une chute provoque (\d+) abandons$/u, "A crash causes $1 abandonments"],
    [/^(.+) ne termine pas (.+)\.$/u, "$1 did not finish $2."],
    [/^(.+) rallie l’arrivée blessé$/u, "$1 reaches the finish injured"],
    [/^(\d+) coureurs terminent touchés$/u, "$1 riders finish injured"],
    [/^(.+) termine malgré une blessure sur (.+)\.$/u, "$1 finishes $2 despite an injury."],
    [/^(.+) terminent malgré leurs blessures sur (.+)\.$/u, "$1 finish $2 despite their injuries."],
    [/^(.+) pris dans une chute$/u, "$1 caught in a crash"],
    [/^Une chute piège (\d+) coureurs$/u, "A crash catches $1 riders"],
    [/^(.+) a perdu du temps ou de l’énergie sur (.+)\.$/u, "$1 lost time or energy on $2."],
    [/^(.+) ont perdu du temps ou de l’énergie sur (.+)\.$/u, "$1 lost time or energy on $2."],
    [/^(.+) piégé par les bordures$/u, "$1 caught in the crosswinds"],
    [/^(\d+) coureurs piégés par les bordures$/u, "$1 riders caught in the crosswinds"],
    [/^(.+) a été mis sous pression par le vent sur (.+)\.$/u, "$1 was put under pressure by the wind on $2."],
    [/^(.+) ont été mis sous pression par le vent sur (.+)\.$/u, "$1 were put under pressure by the wind on $2."],
    [/^(.+) marque (\d+) pt\(s\) aux GPM$/u, "$1 scores $2 KOM point(s)"],
    [/^(.+) marque (\d+) pt\(s\) aux SI$/u, "$1 scores $2 intermediate sprint point(s)"],
  ];

  for (const [pattern, replacement] of rules) {
    if (pattern.test(value)) return value.replace(pattern, replacement);
  }

  return value;
}
export function localizePublicGameNewsItem(
  item: PublicGameNewsItem,
  locale: AppLocale,
): PublicGameNewsItem {
  if (locale !== "en") return item;

  return {
    ...item,
    title: localizeCyclogazetteText(item.title, locale),
    detail: localizeCyclogazetteText(item.detail, locale),
  };
}
