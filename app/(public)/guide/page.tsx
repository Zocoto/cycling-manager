import type { Metadata } from "next";

import { GameGuideContent } from "@/components/guide/game-guide-content";
import { EnglishGameGuide } from "@/components/public/english-game-guide";
import Link from "@/components/public/public-link";
import { getRequestLocale } from "@/lib/i18n/server";
import { getPublicGuide, PUBLIC_GUIDE_SLUGS } from "@/lib/seo/public-guides";
import { buildPublicMetadata } from "@/lib/seo/public-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return buildPublicMetadata({
    path: "/guide", locale,
    title: locale === "en" ? "How to play: the sports director’s guide" : "Guide complet du Directeur Sportif",
    description: locale === "en"
      ? "Get started in Cyclo Stratège: build a cycling team, prepare your first races, develop riders and plan your club’s future. Free online cycling management."
      : "Le manuel complet de Cyclo Stratège : calendrier, courses, entraînement, forme, staff, transferts, finances, objectifs et progression.",
  });
}

export default async function GuidePage() {
  const locale = await getRequestLocale();
  if (locale === "en") return <EnglishGameGuide />;
  return <>
    <section className="bg-[#0B302B] px-5 py-8 text-[#FFFDF4] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-xl font-black">Des guides pratiques pour commencer</h2>
        <nav aria-label="Guides pratiques" className="mt-4 grid gap-3 md:grid-cols-3">
          {PUBLIC_GUIDE_SLUGS.map(slug => <Link key={slug} href={`/guide/${slug}`} className="rounded-xl border border-white/25 bg-white/5 p-4 text-sm font-bold leading-6 hover:border-[#F2C94C]">{getPublicGuide(slug, locale).title} →</Link>)}
        </nav>
      </div>
    </section>
    <GameGuideContent />
  </>;
}
