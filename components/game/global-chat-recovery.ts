import type { GlobalChatMessage, GlobalChatMessagePage } from "@/services/global-chat";

export function compareGlobalChatMessages(
  left: Pick<GlobalChatMessage, "createdAt" | "id">,
  right: Pick<GlobalChatMessage, "createdAt" | "id">,
) {
  if (left.createdAt !== right.createdAt) return left.createdAt < right.createdAt ? -1 : 1;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

export function mergeGlobalChatRecoveryPage(
  current: GlobalChatMessage[],
  page: GlobalChatMessagePage,
) {
  const firstFresh = page.messages[0];
  const firstKnown = current[0];
  const lastKnown = current.at(-1);
  const hasGap = Boolean(firstFresh && lastKnown && compareGlobalChatMessages(lastKnown, firstFresh) < 0);
  const replacesPagination = !page.hasMore || !firstKnown || hasGap ||
    Boolean(firstFresh && compareGlobalChatMessages(firstFresh, firstKnown) <= 0);
  const earlier = page.hasMore && firstFresh && !hasGap
    ? current.filter((message) => compareGlobalChatMessages(message, firstFresh) < 0)
    : [];

  return { messages: [...earlier, ...page.messages], replacesPagination };
}
