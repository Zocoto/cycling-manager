import { Fragment, type ReactNode } from "react";
import { isSafeNewsLink, replaceNewsEmojiShortcodes } from "@/lib/game/game-product-news";

export function gameNewsContextHref(href: string, connected = false) {
  if (!connected) return href;
  if (/^https:\/\//iu.test(href)) {
    try {
      const url = new URL(href);
      if (["cyclostratege.fr", "www.cyclostratege.fr"].includes(url.hostname)) {
        href = url.pathname + url.search + url.hash;
      }
    } catch { return href; }
  }
  if (/^\/guide(?:\/?[?#]|\/?$)/u.test(href)) return href.replace(/^\/guide/u, "/jeu/guide");
  if (/^\/nouveautes(?:[/?#]|$)/u.test(href)) return href.replace(/^\/nouveautes/u, "/jeu/nouveautes");
  return href;
}

/** Small, escaped Markdown subset. Raw HTML, images, scripts and embeds are never executed. */
export function GameNewsBody({ body, connected = false }: { body: string; connected?: boolean }) {
  const blocks = replaceNewsEmojiShortcodes(body).replaceAll("\r", "").split(/\n\s*\n/u);
  return <div className="space-y-5 break-words text-base leading-8 text-[#3F5D54]">
    {blocks.map((block, index) => {
      const lines = block.split("\n");
      if (lines.every((line) => /^\s*[-*] /u.test(line))) {
        return <ul key={index} className="list-disc space-y-2 pl-6">{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*] /u, ""), connected)}</li>)}</ul>;
      }
      if (/^#{1,3} /u.test(block)) return <h2 key={index} className="pt-2 text-xl font-black text-[#183F37]">{inline(block.replace(/^#{1,3} /u, ""), connected)}</h2>;
      return <p key={index}>{lines.map((line, i) => <Fragment key={i}>{i > 0 ? <br /> : null}{inline(line, connected)}</Fragment>)}</p>;
    })}
  </div>;
}

function inline(value: string, connected: boolean): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^\s)]+)\)/gu;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    if (match.index > cursor) result.push(value.slice(cursor, match.index));
    if (match[1]) result.push(<strong key={match.index} className="font-black text-[#183F37]">{match[1]}</strong>);
    else if (match[2]) result.push(<em key={match.index}>{match[2]}</em>);
    else if (isSafeNewsLink(match[4])) {
      const href = gameNewsContextHref(match[4], connected);
      const external = /^https:/iu.test(href);
      result.push(<a key={match.index} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="font-bold text-[#176951] underline decoration-[#176951]/35 underline-offset-4">{match[3]}</a>);
    } else result.push(match[0]);
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) result.push(value.slice(cursor));
  return result;
}
