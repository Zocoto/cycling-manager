export const DIRECTOR_MAILBOX_FILTERS = [
  "inbox",
  "unread",
  "important",
  "archived",
] as const;

export type DirectorMailboxFilter =
  (typeof DIRECTOR_MAILBOX_FILTERS)[number];

export type DirectorMessageType =
  | "race_result"
  | "national_championship_selection"
  | "national_championship_result"
  | "international_selection"
  | "roster_alert"
  | "wildcard"
  | "academy"
  | "infrastructure"
  | "system";

export type DirectorMessageActionLink = {
  label: string;
  href: string;
};

export type DirectorMailboxMessage = {
  id: string;
  type: DirectorMessageType;
  senderName: string;
  subject: string;
  preview: string;
  body: string;
  actionHref: string | null;
  actionLabel: string | null;
  actionLinks: DirectorMessageActionLink[];
  isImportant: boolean;
  sentAt: string;
  readAt: string | null;
  archivedAt: string | null;
};

export function normalizeDirectorMessageActionLinks(
  value: unknown,
): DirectorMessageActionLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (link): link is Record<string, unknown> =>
        typeof link === "object" && link !== null,
    )
    .map((link) => ({
      label: typeof link.label === "string" ? link.label.trim() : "",
      href: typeof link.href === "string" ? link.href.trim() : "",
    }))
    .filter(
      (link) =>
        link.label.length > 0 &&
        link.label.length <= 80 &&
        /^\/jeu(?:\/|$)/.test(link.href),
    )
    .slice(0, 16);
}

export const DIRECTOR_MESSAGE_TYPE_LABELS: Record<
  DirectorMessageType,
  string
> = {
  race_result: "Résultats",
  national_championship_selection: "Sélection CN",
  national_championship_result: "Résultats CN",
  international_selection: "Sélection",
  roster_alert: "Effectif",
  wildcard: "Invitation",
  academy: "Formation",
  infrastructure: "Infrastructures",
  system: "Direction",
};

export function normalizeDirectorMailboxFilter(
  value: string | string[] | undefined,
): DirectorMailboxFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return DIRECTOR_MAILBOX_FILTERS.includes(
    candidate as DirectorMailboxFilter,
  )
    ? (candidate as DirectorMailboxFilter)
    : "inbox";
}

export function filterDirectorMailboxMessages({
  messages,
  filter,
  query,
}: {
  messages: DirectorMailboxMessage[];
  filter: DirectorMailboxFilter;
  query?: string | null;
}) {
  const searchTokens = normalizeSearchText(query ?? "")
    .split(/\s+/)
    .filter(Boolean);

  return messages.filter((message) => {
    const matchesFolder =
      filter === "archived"
        ? message.archivedAt !== null
        : message.archivedAt === null &&
          (filter === "inbox" ||
            (filter === "unread" && message.readAt === null) ||
            (filter === "important" && message.isImportant));

    if (!matchesFolder) return false;
    if (searchTokens.length === 0) return true;

    const searchableText = normalizeSearchText(
      [
        message.senderName,
        message.subject,
        message.preview,
        message.body,
        DIRECTOR_MESSAGE_TYPE_LABELS[message.type],
      ].join(" "),
    );

    return searchTokens.every((token) => searchableText.includes(token));
  });
}

export function getDirectorMessageIdToMarkReadOnNavigation({
  currentMessageId,
  currentMessageReadAt,
  targetMessageId,
}: {
  currentMessageId: string | null;
  currentMessageReadAt: string | null;
  targetMessageId: string;
}) {
  if (
    currentMessageId === null ||
    currentMessageReadAt !== null ||
    currentMessageId === targetMessageId
  ) {
    return null;
  }

  return currentMessageId;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}
