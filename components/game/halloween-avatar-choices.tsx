import { HALLOWEEN_PREVIEW_ITEMS } from "@/lib/game/halloween-catalog";
import {
  composeHalloweenAvatarKey, HALLOWEEN_AVATAR_COSMETICS, toggleHalloweenAvatarItem,
  type HalloweenAvatarItemId,
} from "@/lib/game/halloween-avatar";
import { SportingDirectorAvatar } from "./sporting-director-avatar";

export type AvatarStyleCategory = "background" | "glasses" | "hat" | "outfit" | "accessories";
export function HalloweenAvatarChoices({ category, owned, selected, baseKey, curse, onToggle }: {
  category: AvatarStyleCategory; owned: readonly HalloweenAvatarItemId[]; selected: readonly HalloweenAvatarItemId[];
  baseKey: string; curse?: "vampire" | "mummy"; onToggle: (id: HalloweenAvatarItemId) => void;
}) {
  const items = owned.filter(id => {
    const slot = HALLOWEEN_AVATAR_COSMETICS[id].slot;
    return category === "accessories" ? !["background", "hat", "outfit"].includes(slot) : slot === category;
  });
  return <fieldset>
    <legend className="text-sm font-black text-[#183F37]">Votre collection Halloween</legend>
    <p className="mt-1 text-xs leading-5 text-[#60756E]">
      {items.length === 0 ? "Vos achats et cadeaux de cette catégorie apparaîtront ici." :
        category === "accessories" ? "Cumulez les accessoires compatibles. Cliquez sur un élément sélectionné pour le retirer." :
          "Cliquez pour porter cet élément ; cliquez à nouveau pour le retirer."}
    </p>
    {curse && category === "outfit" ? <p className="mt-2 text-xs text-[#80640C]">Votre tenue réapparaîtra à la fin de la malédiction.</p> : null}
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map(id => {
        const active = selected.includes(id);
        const name = HALLOWEEN_PREVIEW_ITEMS.find(item => item.id === id)?.name ?? id;
        const previewItems = active ? selected : toggleHalloweenAvatarItem(selected, id);
        return <button key={id} type="button" aria-pressed={active} onClick={() => onToggle(id)}
          className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] ${active ? "border-[#278B70] bg-[#DFF4EC] text-[#0E5141]" : "border-[#315B3E]/15 bg-white text-[#48665F] hover:bg-[#F3FAF7]"}`}>
          <SportingDirectorAvatar avatarKey={composeHalloweenAvatarKey(baseKey, previewItems, curse)} size="small" label={`Aperçu : ${name}`} />
          <span>{name}</span>{active ? <span aria-hidden="true" className="ml-auto">✓</span> : null}
        </button>;
      })}
    </div>
  </fieldset>;
}
