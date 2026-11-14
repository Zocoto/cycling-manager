import type { CyclogazetteEdition } from "@/lib/game/cyclogazette";
import {
  isFrenchGrandTourGazetteDay,
  isItalianGrandTourGazetteDay,
  isSpanishGrandTourGazetteDay,
} from "@/lib/game/cyclogazette";
import {
  cyclogazetteArticleReactionKey,
  type CyclogazetteArticleReactionStates,
  type CyclogazetteArticleReactionTarget,
} from "@/lib/game/cyclogazette-article-reactions";
import { isCyclogazetteInterviewReactionEmoji } from "@/lib/game/cyclogazette-interview-reactions";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type GazetteReactionRpcTarget = {
  kind: "media" | "race" | "jersey" | "feature" | "joke";
  id: string;
  editionId: string | null;
};

type GazetteReactionSummaryRow = {
  target_key: string;
  emoji: string | null;
  count: number;
  reacted_by_viewer: boolean;
  can_react?: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EDITORIAL_TARGET = /^(race|jersey|feature|joke):(.{1,160})$/u;
const JOKE_ID = /^(italy|france|spain):[0-2]$/;

export function getGazetteReactionRpcTarget(
  target: CyclogazetteArticleReactionTarget | null,
): GazetteReactionRpcTarget | null {
  if (!target || typeof target.id !== "string") return null;
  if (target.kind === "media") {
    return UUID.test(target.id)
      ? { kind: "media", id: target.id.toLowerCase(), editionId: null }
      : null;
  }
  if (
    target.kind !== "edition" ||
    typeof target.editionId !== "string" ||
    !UUID.test(target.editionId)
  ) return null;

  const match = EDITORIAL_TARGET.exec(target.id);
  if (!match) return null;
  const [, kind, id] = match;
  if (kind === "joke" && !JOKE_ID.test(id)) return null;
  return { kind: kind as GazetteReactionRpcTarget["kind"], id, editionId: target.editionId };
}

export async function getCyclogazetteArticleReactions(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  edition: CyclogazetteEdition,
): Promise<CyclogazetteArticleReactionStates> {
  const { content, id: editionId, dayNumber } = edition;
  const targets = new Map<string, GazetteReactionRpcTarget>();
  function addTarget(target: CyclogazetteArticleReactionTarget) {
    const rpcTarget = getGazetteReactionRpcTarget(target);
    if (rpcTarget) targets.set(cyclogazetteArticleReactionKey(target), rpcTarget);
  }

  for (const item of [
    content.lead,
    ...content.raceStories,
    ...content.raceHighlights,
    ...content.mercatoStories,
  ]) {
    if (item) addTarget({ kind: "edition", id: `race:${item.id}`, editionId });
  }
  for (const story of content.featureStories ?? []) {
    const kind = story.jerseyReveal ? "jersey" : "feature";
    addTarget({ kind: "edition", id: `${kind}:${story.id}`, editionId });
  }
  if (content.nationsCupSpecial) {
    addTarget({ kind: "edition", id: "feature:nations-cup-champion", editionId });
  }
  for (const article of content.mediaArticles ?? []) {
    addTarget({ kind: "media", id: article.id });
  }
  const jokeFlavor = isItalianGrandTourGazetteDay(dayNumber)
    ? "italy"
    : isFrenchGrandTourGazetteDay(dayNumber)
      ? "france"
      : isSpanishGrandTourGazetteDay(dayNumber)
        ? "spain"
        : null;
  if (jokeFlavor) {
    for (let index = 0; index < 3; index++) {
      addTarget({ kind: "edition", id: `joke:${jokeFlavor}:${index}`, editionId });
    }
  }

  const state: CyclogazetteArticleReactionStates = {
    canReact: false,
    articles: {},
    blockedArticleKeys: [],
  };
  if (!targets.size) return state;
  const { data, error } = await supabase
    .rpc("get_gazette_article_reaction_summaries", { p_targets: [...targets.values()] });
  if (error || !Array.isArray(data)) {
    console.error("Échec du chargement des réactions aux articles de la Gazette", error);
    return state;
  }

  state.canReact = true;
  const blockedArticleKeys = new Set<string>();
  for (const row of data as GazetteReactionSummaryRow[]) {
    if (!targets.has(row.target_key)) continue;
    if (row.can_react === false) blockedArticleKeys.add(row.target_key);
    if (!isCyclogazetteInterviewReactionEmoji(row.emoji) || row.count < 1) continue;
    (state.articles[row.target_key] ??= []).push({
      emoji: row.emoji,
      count: row.count,
      reactedByViewer: row.reacted_by_viewer,
    });
  }
  state.blockedArticleKeys = [...blockedArticleKeys];
  return state;
}
