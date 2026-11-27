import { HALLOWEEN_AVATAR_SEPARATOR } from "./halloween-avatar";

// Small permanent registry: global avatars do not import the event catalogue or Advent data.
export const CHRISTMAS_AVATAR_ITEMS = [
  {
    "id": "lueurs-velodrome",
    "name": "Lueurs du vélodrome",
    "slot": "fond"
  },
  {
    "id": "bonnet-relais",
    "name": "Bonnet du dernier relais",
    "slot": "chapeau"
  },
  {
    "id": "tenue-facteur",
    "name": "Maillot du facteur des neiges",
    "slot": "tenue"
  },
  {
    "id": "cache-cou-renne",
    "name": "Cache-cou nez rouge",
    "slot": "masque"
  },
  {
    "id": "lunettes-givre",
    "name": "Lunettes de descente givrées",
    "slot": "lunettes"
  },
  {
    "id": "couronne-rayons",
    "name": "Couronne de rayons",
    "slot": "cadre"
  },
  {
    "id": "fond-neige",
    "name": "La vallée sous la neige",
    "slot": "fond"
  },
  {
    "id": "couronne-noel",
    "name": "Couronne de Noël",
    "slot": "chapeau"
  },
  {
    "id": "barbe-pere-noel",
    "name": "Barbe du Père Noël",
    "slot": "masque"
  },
  {
    "id": "tenue-pere-noel",
    "name": "Manteau du Père Noël",
    "slot": "tenue"
  },
  {
    "id": "tenue-lutin",
    "name": "Veste du chef des lutins",
    "slot": "tenue"
  },
  {
    "id": "bois-renne",
    "name": "Bois du renne de tête",
    "slot": "chapeau"
  },
  {
    "id": "halo-etoiles",
    "name": "Guirlande des étoiles",
    "slot": "cadre"
  },
  {
    "id": "avent-bonnet-constellation",
    "name": "Bonnet de la nuit étoilée",
    "slot": "chapeau"
  },
  {
    "id": "avent-nuit-lanternes",
    "name": "La nuit des lanternes",
    "slot": "fond"
  },
  {
    "id": "avent-echarpe-pain-epices",
    "name": "Écharpe de pain d’épices",
    "slot": "masque"
  },
  {
    "id": "avent-manteau-casse-noisette",
    "name": "Manteau du Casse-Noisette",
    "slot": "tenue"
  },
  {
    "id": "avent-cadre-givre",
    "name": "Dentelle de givre",
    "slot": "cadre"
  },
  {
    "id": "cadre-grand-sapin",
    "name": "Couronne du Grand Sapin",
    "slot": "cadre"
  },
  {
    "id": "tenue-aurore",
    "name": "Tenue de l’aurore boréale",
    "slot": "tenue"
  }
] as const;
export type ChristmasAvatarItemId = string;
export function isChristmasAvatarItemId(value: unknown): value is ChristmasAvatarItemId {
  return typeof value === "string" && CHRISTMAS_AVATAR_ITEMS.some(item => item.id === value);
}
export function christmasAvatarArts(value?: string | null) {
  return [...new Set((value?.split(HALLOWEEN_AVATAR_SEPARATOR)[1] ?? "").split(",")
    .filter(part => part.startsWith("christmas:")).map(part => part.slice(10)).filter(isChristmasAvatarItemId))];
}
export function composeChristmasAvatarKey(base: string, items: readonly ChristmasAvatarItemId[]) {
  const [original, suffix = ""] = base.split(HALLOWEEN_AVATAR_SEPARATOR);
  const arts = [...suffix.split(",").filter(art => art && !art.startsWith("christmas:")),
    ...[...new Set(items)].filter(isChristmasAvatarItemId).map(id => `christmas:${id}`)];
  return original + (arts.length ? HALLOWEEN_AVATAR_SEPARATOR + arts.join(",") : "");
}
export function christmasAvatarWardrobe(inventory: Record<string, unknown> = {}, cosmetics: Record<string, unknown> = {}) {
  const owned: string[] = CHRISTMAS_AVATAR_ITEMS.filter(item => typeof inventory[item.id] === "number" && Number.isSafeInteger(inventory[item.id]) && (inventory[item.id] as number) > 0).map(item => item.id);
  const selected = [...new Set(Object.values(cosmetics).filter(isChristmasAvatarItemId).filter(id => owned.includes(id)))];
  return { owned, selected };
}
export function toggleChristmasAvatarItem(current: readonly ChristmasAvatarItemId[], id: ChristmasAvatarItemId) {
  if (current.includes(id)) return current.filter(item => item !== id);
  const slot = CHRISTMAS_AVATAR_ITEMS.find(item => item.id === id)?.slot;
  return [...current.filter(item => CHRISTMAS_AVATAR_ITEMS.find(candidate => candidate.id === item)?.slot !== slot), id];
}
export function parseChristmasAvatarSelection(value: FormDataEntryValue | null): ChristmasAvatarItemId[] | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 512) throw new Error("Choix d’accessoires invalide.");
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length > 6 || !parsed.every(isChristmasAvatarItemId)) throw new Error("Choix d’accessoires invalide.");
  const slots = parsed.map(id => CHRISTMAS_AVATAR_ITEMS.find(item => item.id === id)?.slot);
  if (new Set(slots).size !== slots.length) throw new Error("Choisissez un seul élément par emplacement.");
  return parsed;
}
