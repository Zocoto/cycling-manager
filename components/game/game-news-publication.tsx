import Image from "next/image";
import Link from "@/components/ui/app-link";
import type { AppLocale } from "@/lib/i18n/config";
import { localizeGameNews, isSafeNewsLink, type PublishedGameNews } from "@/lib/game/game-product-news";
import { GameNewsBody, gameNewsContextHref } from "./game-news-body";
import { GAME_NEWS_IMAGE_PREFIX } from "@/lib/game/game-news-images";

export function GameNewsCards({ articles, connected = false, locale = "fr" }: { articles: PublishedGameNews[]; connected?: boolean; locale?: AppLocale }) {
  return <div className="grid gap-5 md:grid-cols-2">{articles.map((article) => {
    const text = localizeGameNews(article.document, locale);
    return <article key={article.id} className="flex min-w-0 flex-col rounded-2xl border border-[#315B3E]/15 bg-white p-5 shadow-[0_8px_28px_rgba(19,60,46,0.05)] sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#278B70]">{text.category}</p>
      <h2 className="mt-3 break-words text-2xl font-black text-[#183F37]">{text.title}</h2>
      <time dateTime={article.publishedAt} className="mt-2 text-xs font-semibold text-[#789087]">{formatGameNewsDate(article.publishedAt, locale)}</time>
      <p className="mt-4 flex-1 whitespace-pre-wrap break-words text-sm leading-7 text-[#60756E]">{text.summary}</p>
      <Link href={`${connected ? "/jeu" : ""}/nouveautes/${article.id}`} className="mt-5 inline-flex min-h-10 items-center gap-2 self-start rounded-lg bg-[#173C2E] px-4 py-2 text-xs font-black text-white hover:bg-[#278B70]">{locale === "en" ? "Read the update" : "Lire l’actualité"}<span aria-hidden="true">→</span></Link>
    </article>;
  })}</div>;
}

export function GameNewsPublication({ article, connected = false, locale = "fr" }: { article: PublishedGameNews; connected?: boolean; locale?: AppLocale }) {
  const text = localizeGameNews(article.document, locale);
  const destination = article.document.link_url && isSafeNewsLink(article.document.link_url) ? gameNewsContextHref(article.document.link_url, connected) : null;
  return <article className="overflow-hidden rounded-3xl border border-[#315B3E]/15 bg-white shadow-[0_14px_45px_rgba(19,60,46,0.06)]">
    {article.document.image_path ? <div className="relative h-48 overflow-hidden bg-[#0B302B] sm:h-72"><Image src={article.document.image_path} alt={article.document.image_alt} unoptimized={article.document.image_path.startsWith(GAME_NEWS_IMAGE_PREFIX)} fill sizes="(max-width:1024px) 100vw, 1000px" className="object-cover" /></div> : null}
    <div className="p-5 sm:p-9">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-[#278B70]">{text.category}</p>
      <h1 className="mt-3 break-words text-3xl font-black leading-tight text-[#183F37] sm:text-4xl">{text.title}</h1>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#789087]"><time dateTime={article.publishedAt}>{formatGameNewsDate(article.publishedAt, locale)}</time>{article.updatedAt !== article.publishedAt ? <span>{locale === "en" ? "Updated" : "Mis à jour"} · {formatGameNewsDate(article.updatedAt, locale)}</span> : null}</div>
      <p className="mt-6 whitespace-pre-wrap break-words border-l-2 border-[#B67A44]/50 pl-4 text-lg font-semibold leading-8 text-[#3F5D54]">{text.summary}</p>
      {text.body.trim() !== text.summary.trim() ? <div className="mt-8"><GameNewsBody body={text.body} connected={connected} /></div> : null}
      {destination ? <Link href={destination} target={destination.startsWith("https:") ? "_blank" : undefined} rel={destination.startsWith("https:") ? "noopener noreferrer" : undefined} className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-[#173C2E] px-5 py-3 text-sm font-black text-white">{article.document.link_label || (locale === "en" ? "Find out more" : "En savoir plus")} →</Link> : null}
    </div>
  </article>;
}

export function formatGameNewsDate(value: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(value));
}
