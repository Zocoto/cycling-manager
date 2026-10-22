import { getPublishedGameNews } from "@/services/game-product-news";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizeGameNews } from "@/lib/game/game-product-news";
import { DashboardNewsTicker, type NewsTickerItem } from "./dashboard-news-ticker";

export async function DashboardNewsTickerLoader() {
  let items: NewsTickerItem[] = [];
  try {
    const [news, locale] = await Promise.all([getPublishedGameNews(), getRequestLocale()]);
    items = news.slice(0, 5).map((article) => ({ id: article.id, title: localizeGameNews(article.document, locale).title }));
  } catch {
    // This enhancement must never block the sports director's office.
  }
  return <DashboardNewsTicker items={items} />;
}
