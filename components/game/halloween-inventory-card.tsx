import Link from "@/components/ui/app-link";
import { HalloweenItemIllustration } from "@/components/halloween/halloween-art";
import { halloweenInventoryItemHref } from "@/lib/game/halloween-inventory";
import { getInventoryCategory, type TeamInventoryItem } from "@/lib/game/inventory";

export function HalloweenInventoryCard({ item }: { item: TeamInventoryItem }) {
  const halloween = item.halloween;
  if (!halloween) return null;
  return <article id={`inventory-halloween-${item.sourceId}`} className="overflow-hidden rounded-[2rem] border border-orange-300/60 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)]">
    <div className="bg-[#302823] [&_.halloween-item-art]:h-28 [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
      <HalloweenItemIllustration art={halloween.art} name={item.name} />
    </div>
    <div className="p-5 sm:p-6">
      <p className="text-xs font-extrabold uppercase tracking-wider text-orange-800">Halloween · {getInventoryCategory(item.category).label}</p>
      <h3 className="mt-2 text-xl font-black text-[#183F37]">{item.name}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">{item.description}</p>
      <details className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-[#183F37]">
        <summary className="cursor-pointer font-black">Effet et conditions</summary>
        <p className="mt-2 leading-6">{item.effectSummary}</p>
        {halloween.bodyChange ? <p className="mt-2 leading-6">{halloween.bodyChange.limit}</p> : null}
        {halloween.relic ? <p className="mt-2 leading-6">{halloween.relic.limit}</p> : null}
      </details>
      <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-orange-100 pt-4 text-sm font-bold text-[#183F37]">
        <span>Possédé : {item.quantity}</span><span>Disponible : {item.availableQuantity}</span>
        {item.equippedQuantity > 0 ? <span>Porté sur votre portrait</span> : null}
      </div>
      <Link href={halloweenInventoryItemHref(item.sourceId)} prefetch={false} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#9A431C] px-4 py-3 text-sm font-black text-white hover:bg-[#713116]">
        {halloween.kind === "cosmetic" ? "Gérer cet accessoire" : halloween.kind === "transformation" ? "Envoyer ce sort" : "Utiliser cet objet"} →
      </Link>
      <p className="mt-3 text-xs font-semibold leading-5 text-[#60756E]">Objet conservé après Halloween, lié à votre compte de DS. Utilisation dans « Mes trésors ».</p>
    </div>
  </article>;
}
