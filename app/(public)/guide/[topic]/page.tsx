import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Link from "@/components/public/public-link";
import { getRequestLocale } from "@/lib/i18n/server";
import { buildPublicMetadata } from "@/lib/seo/public-metadata";
import { getPublicGuide, isPublicGuideSlug, PUBLIC_GUIDE_SLUGS } from "@/lib/seo/public-guides";

type Props = { params: Promise<{ topic: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  if (!isPublicGuideSlug(topic)) notFound();
  const locale = await getRequestLocale();
  const guide = getPublicGuide(topic, locale);
  return buildPublicMetadata({ path: `/guide/${topic}`, locale, title: guide.title, description: guide.description });
}

export default async function PracticalGuidePage({ params }: Props) {
  const { topic } = await params;
  if (!isPublicGuideSlug(topic)) notFound();
  const locale = await getRequestLocale();
  const isEnglish = locale === "en";
  const guide = getPublicGuide(topic, locale);

  return (
    <article className="bg-[#F7FAF7] text-[#082A2A]">
      <header className="border-b border-[#315B3E]/15 bg-[#EAF5F3] px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <Link href="/guide" className="inline-flex min-h-11 items-center text-sm font-bold text-[#176951]">
            {isEnglish ? "← All guides" : "← Tous les guides"}
          </Link>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
            {isEnglish ? "Cyclo Stratège · Practical guide" : "Cyclo Stratège · Guide pratique"}
          </p>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">{guide.title}</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[#48665F] sm:text-lg">{guide.introduction}</p>
          <nav aria-label={isEnglish ? "On this page" : "Dans ce guide"} className="mt-8 flex flex-wrap gap-2">
            {guide.sections.map((section, index) => (
              <Link key={section.title} href={`#etape-${index + 1}`} className="rounded-xl border border-[#315B3E]/20 bg-white px-3 py-3 text-sm font-semibold text-[#176951] hover:border-[#176951]">
                {index + 1}. {section.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="space-y-8">
          {guide.sections.map((section, index) => (
            <section key={section.title} id={`etape-${index + 1}`} className="scroll-mt-40 rounded-2xl border border-[#315B3E]/15 bg-white p-5 sm:p-8">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2C94C] font-black text-[#071A17]">{String(index + 1).padStart(2, "0")}</span>
              <h2 className="mt-5 text-2xl font-black tracking-tight">{section.title}</h2>
              <div className="mt-5 space-y-4 text-base leading-8 text-[#48665F]">
                {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <p className="mt-6 rounded-xl border border-[#F2C94C]/40 bg-[#FFF9DF] p-4 font-semibold leading-7 text-[#705B00]">{section.advice}</p>
            </section>
          ))}
        </div>

        <aside className="mt-10 rounded-2xl bg-[#0B302B] p-6 text-[#FFFDF4] sm:p-8">
          <h2 className="text-2xl font-black">{isEnglish ? "Put your plan into practice" : "Passer à la pratique"}</h2>
          <p className="mt-3 max-w-2xl leading-7 text-[#D6DFD2]">
            {isEnglish ? "Cyclo Stratège is free to play in your browser, on desktop and mobile. Create your sports director and build your first team." : "Cyclo Stratège se joue gratuitement dans votre navigateur, sur ordinateur et mobile. Créez votre Directeur Sportif et construisez votre première équipe."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/inscription" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#F2C94C] px-5 py-3 font-black text-[#071A17]">
              {isEnglish ? "Create my team for free" : "Créer mon équipe gratuitement"}
            </Link>
            <Link href="/guide" className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-5 py-3 font-semibold">
              {isEnglish ? "Read the game guide" : "Consulter le guide du jeu"}
            </Link>
          </div>
        </aside>

        <nav aria-label={isEnglish ? "More practical guides" : "Autres guides pratiques"} className="mt-10 grid gap-4 sm:grid-cols-2">
          {PUBLIC_GUIDE_SLUGS.filter(slug => slug !== topic).map(slug => (
            <Link key={slug} href={`/guide/${slug}`} className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-[#315B3E]/20 bg-white p-5 font-bold text-[#176951]">
              {getPublicGuide(slug, locale).title}<span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </article>
  );
}
