import { CHRISTMAS_AVATAR_ITEMS, composeChristmasAvatarKey, toggleChristmasAvatarItem, type ChristmasAvatarItemId } from "@/lib/game/christmas-avatar";
import { SportingDirectorAvatar } from "./sporting-director-avatar";
import type { AvatarStyleCategory } from "./halloween-avatar-choices";
const categories: Record<string, AvatarStyleCategory> = { fond: "background", chapeau: "hat", tenue: "outfit", lunettes: "glasses", masque: "accessories", cadre: "accessories" };
export function ChristmasAvatarChoices({ category, owned, selected, baseKey, onToggle }: {
  category: AvatarStyleCategory; owned: readonly ChristmasAvatarItemId[]; selected: readonly ChristmasAvatarItemId[];
  baseKey: string; onToggle: (id: ChristmasAvatarItemId) => void;
}) {
  const items = CHRISTMAS_AVATAR_ITEMS.filter(item => owned.includes(item.id) && categories[item.slot ?? ""] === category);
  if (!items.length) return null;
  return <fieldset className="mt-5"><legend className="text-sm font-black text-[#183F37]">Votre collection de Noël</legend>
    <p className="mt-1 text-xs text-[#60756E]">Cliquez pour porter ou retirer un élément. Les accessoires compatibles se cumulent.</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{items.map(item => <button key={item.id} type="button" aria-pressed={selected.includes(item.id)} onClick={() => onToggle(item.id)}
      className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-[#278B70] ${selected.includes(item.id) ? "border-[#278B70] bg-[#DFF4EC] text-[#0E5141]" : "border-[#315B3E]/15 bg-white text-[#48665F] hover:bg-[#F3FAF7]"}`}>
      <SportingDirectorAvatar avatarKey={composeChristmasAvatarKey(baseKey, selected.includes(item.id) ? selected : toggleChristmasAvatarItem(selected, item.id))} size="small" label={`Aperçu : ${item.name}`} />
      <span>{item.name}</span>{selected.includes(item.id) ? <span aria-hidden="true">✓</span> : null}
    </button>)}</div></fieldset>;
}
