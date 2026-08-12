import { describe, expect, it } from "vitest";

import {
  filterDirectorMailboxMessages,
  getDirectorMessageIdToMarkReadOnNavigation,
  normalizeDirectorMailboxFilter,
  type DirectorMailboxMessage,
} from "@/lib/game/director-mailbox";

const messages: DirectorMailboxMessage[] = [
  {
    id: "race",
    type: "race_result",
    senderName: "Direction des courses",
    subject: "Résultats majeurs — Tour des Alpes",
    preview: "Le classement final est homologué.",
    body: "Victoire de Jean Dupont.",
    actionHref: "/jeu/resultats/tour-des-alpes",
    actionLabel: "Consulter les résultats",
    isImportant: true,
    sentAt: "2026-08-08T18:00:00.000Z",
    readAt: null,
    archivedAt: null,
  },
  {
    id: "academy",
    type: "academy",
    senderName: "Centre de formation",
    subject: "Promotion planifiée",
    preview: "Un jeune rejoindra l'effectif.",
    body: "La promotion est programmée.",
    actionHref: "/jeu/centre-de-formation",
    actionLabel: "Ouvrir le centre",
    isImportant: false,
    sentAt: "2026-08-07T18:00:00.000Z",
    readAt: "2026-08-08T08:00:00.000Z",
    archivedAt: null,
  },
  {
    id: "archive",
    type: "wildcard",
    senderName: "Comité organisateur",
    subject: "Wild Card refusée",
    preview: "La demande n'a pas été retenue.",
    body: "Décision définitive.",
    actionHref: "/jeu/calendrier",
    actionLabel: "Voir le calendrier",
    isImportant: false,
    sentAt: "2026-08-06T18:00:00.000Z",
    readAt: "2026-08-06T19:00:00.000Z",
    archivedAt: "2026-08-07T08:00:00.000Z",
  },
];

describe("boîte mail du directeur sportif", () => {
  it("normalise les dossiers demandés", () => {
    expect(normalizeDirectorMailboxFilter("unread")).toBe("unread");
    expect(normalizeDirectorMailboxFilter(["archived", "inbox"])).toBe(
      "archived",
    );
    expect(normalizeDirectorMailboxFilter("inconnu")).toBe("inbox");
  });

  it("sépare réception, non lus, importants et archives", () => {
    expect(
      filterDirectorMailboxMessages({ messages, filter: "inbox" }).map(
        (message) => message.id,
      ),
    ).toEqual(["race", "academy"]);
    expect(
      filterDirectorMailboxMessages({ messages, filter: "unread" }).map(
        (message) => message.id,
      ),
    ).toEqual(["race"]);
    expect(
      filterDirectorMailboxMessages({ messages, filter: "important" }).map(
        (message) => message.id,
      ),
    ).toEqual(["race"]);
    expect(
      filterDirectorMailboxMessages({ messages, filter: "archived" }).map(
        (message) => message.id,
      ),
    ).toEqual(["archive"]);
  });

  it("recherche sans tenir compte des accents ou de la casse", () => {
    expect(
      filterDirectorMailboxMessages({
        messages,
        filter: "inbox",
        query: "resultats ALPES",
      }).map((message) => message.id),
    ).toEqual(["race"]);
  });

  it("marque le mail quitté, pas celui qui vient d'être ouvert", () => {
    expect(
      getDirectorMessageIdToMarkReadOnNavigation({
        currentMessageId: "premier-mail",
        currentMessageReadAt: null,
        targetMessageId: "deuxieme-mail",
      }),
    ).toBe("premier-mail");

    expect(
      getDirectorMessageIdToMarkReadOnNavigation({
        currentMessageId: "deuxieme-mail",
        currentMessageReadAt: null,
        targetMessageId: "deuxieme-mail",
      }),
    ).toBeNull();
  });

  it("ne réécrit pas un mail déjà lu lors du changement", () => {
    expect(
      getDirectorMessageIdToMarkReadOnNavigation({
        currentMessageId: "mail-lu",
        currentMessageReadAt: "2026-08-11T08:00:00.000Z",
        targetMessageId: "autre-mail",
      }),
    ).toBeNull();
  });
});
