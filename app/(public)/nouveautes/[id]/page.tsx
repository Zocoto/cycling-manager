import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import Link from "@/components/ui/app-link";
import { GameNewsPublication } from "@/components/game/game-news-publication";
import { getPublishedGameNewsById } from "@/services/game-product-news";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizeGameNews } from "@/lib/game/game-product-news";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return { title: "Actualité introuvable" };
  const article = await getPublishedGameNewsById(id);
  if (!article) return { title: "Actualité introuvable" };
  const text = localizeGameNews(article.document, await getRequestLocale());
  return { title: text.title, description: text.summary, alternates: { canonical: `/nouveautes/${id}` } };
}
export default async function PublicGameNewsDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [article, locale] = await Promise.all([getPublishedGameNewsById(id), getRequestLocale()]);
  if (!article) notFound();
  return <section className="bg-[#EAF5F3] px-4 py-10 text-[#082A2A] sm:px-8"><div className="mx-auto max-w-5xl"><Link href="/nouveautes" className="mb-6 inline-flex text-sm font-bold text-[#176951]">← Toutes les actualités</Link><GameNewsPublication article={article} locale={locale} /></div></section>;
}
