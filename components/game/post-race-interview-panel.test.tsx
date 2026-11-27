import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PostRaceInterviewSnapshot } from "@/lib/game/post-race-interview";

import { PostRaceInterviewPanel } from "./post-race-interview-panel";

vi.mock("@/app/jeu/resultats/interview-actions", () => ({
  submitPostRaceInterviewAction: vi.fn(),
}));

const PENDING_INTERVIEW = {
  id: "d291371c-56f6-4a6c-b9f7-0d5c4b1ee5f1",
  status: "pending",
  questions: [
    {
      id: "result",
      category: "result",
      text: "Que retenez-vous de cette course ?",
    },
    {
      id: "tactics",
      category: "tactics",
      text: "Votre tactique a-t-elle fonctionné ?",
    },
    {
      id: "event",
      category: "event",
      text: "Décision du DS",
    },
  ],
  answers: [],
  closingNote: "",
  context: {
    raceName: "Course test",
    stageName: "Étape test",
    teamId: "team-test",
    teamName: "Équipe test",
    directorName: "Roger Test",
    directorAvatarKey: null,
    riderName: "Mesfin Deng",
    bestRank: 8,
    gapLabel: "+12 s",
    uciRank: 42,
    divisionLabel: "Nationale",
    tookBreakaway: false,
    tookChase: false,
    zoneMixteEvent: {
      id: "rider-criticizes-tactics",
      rarity: "notable",
      title: "Le coureur critique la tactique",
      story: "Le coureur aurait préféré courir différemment.",
      choices: [
        {
          id: "collective",
          label: "Assumer collectivement",
          description: "Reconnaître que le plan pouvait être meilleur.",
          impactPreview: "+1 réputation et +1 popularité",
          risk: "safe",
          outcomes: [
            {
              weight: 100,
              reputationDelta: 1,
              riderPopularityDelta: 1,
              summary:
                "La réponse rassemble l’équipe : +1 réputation et +1 popularité.",
            },
          ],
        },
      ],
    },
  },
  submittedAt: null,
  eventResolution: null,
} satisfies PostRaceInterviewSnapshot;

const RIDER_INTERVIEW = {
  ...PENDING_INTERVIEW,
  context: {
    ...PENDING_INTERVIEW.context,
    zoneMixteEvent: {
      ...PENDING_INTERVIEW.context.zoneMixteEvent,
      riderId: "rider-secondary",
      riderName: "Anahit Sarkissian",
      riderPersonalityKey: "discret",
      riderMorale: 42,
      choices: [
        ...PENDING_INTERVIEW.context.zoneMixteEvent.choices,
        ...[
          ["private-talk", "Débriefer au bus"],
          ["value-effort", "Souligner l’effort en course"],
          ["share-responsibility", "Assumer le plan de course"],
          ["next-race", "Fixer un objectif pour la suite"],
        ].map(([id, label]) => ({
          ...PENDING_INTERVIEW.context.zoneMixteEvent.choices[0],
          id,
          label,
        })),
      ],
    },
  },
} satisfies PostRaceInterviewSnapshot;

describe("décisions du DS en zone mixte", () => {
  it("masque tous les effets avant la validation du choix", () => {
    const markup = renderToStaticMarkup(
      <PostRaceInterviewPanel initialInterview={PENDING_INTERVIEW} />,
    );

    expect(markup).toContain("Assumer collectivement");
    expect(markup).toContain("Reconnaître que le plan pouvait être meilleur.");
    expect(markup).not.toContain("+1 réputation et +1 popularité");
    expect(markup).not.toContain("Aucun effet");
  });

  it("affiche le coureur concerné et laisse choisir parmi toutes ses réponses", () => {
    const markup = renderToStaticMarkup(
      <PostRaceInterviewPanel initialInterview={RIDER_INTERVIEW} />,
    );

    expect(markup).toContain("Anahit Sarkissian");
    expect(markup).toContain("Discret");
    expect(markup).toContain("Moral du coureur");
    expect(markup).toContain("42 %");
    expect(markup).toContain("Fragile");
    expect(markup).not.toContain("Mesfin Deng");
    expect(markup.match(/type="radio"/g)).toHaveLength(6);
    expect(markup).toContain("Fixer un objectif pour la suite");
    expect(markup).toContain("Poursuivre l’interview sans lui répondre.");
    expect(markup).not.toContain("+1 réputation et +1 popularité");
  });

  it("révèle la conséquence après l’enregistrement de la décision", () => {
    const submittedInterview = {
      ...PENDING_INTERVIEW,
      status: "submitted",
      answers: [
        {
          questionId: "result",
          question: "Que retenez-vous de cette course ?",
          answer: "Le collectif a répondu présent.",
        },
        {
          questionId: "tactics",
          question: "Votre tactique a-t-elle fonctionné ?",
          answer: "Nous pouvons encore progresser.",
        },
      ],
      submittedAt: "2026-09-23T08:00:00.000Z",
      eventResolution: {
        choiceId: "collective",
        choiceLabel: "Assumer collectivement",
        outcome: {
          weight: 100,
          reputationDelta: 1,
          riderPopularityDelta: 1,
          summary:
            "La réponse rassemble l’équipe : +1 réputation et +1 popularité.",
        },
      },
    } satisfies PostRaceInterviewSnapshot;

    const markup = renderToStaticMarkup(
      <PostRaceInterviewPanel initialInterview={submittedInterview} />,
    );

    expect(markup).toContain("Conséquence");
    expect(markup).toContain(
      "La réponse rassemble l’équipe : +1 réputation et +1 popularité.",
    );
  });

  it("affiche la réaction et la variation de moral effectivement enregistrée", () => {
    const submittedInterview = {
      ...RIDER_INTERVIEW,
      status: "submitted",
      answers: [{
        questionId: "event",
        question: "Décision du DS",
        answer: "Ancien récapitulatif de décision",
      }],
      submittedAt: "2026-11-27T14:30:00.000Z",
      eventResolution: {
        choiceId: "private-talk",
        choiceLabel: "Débriefer au bus",
        appliedRiderMoraleDelta: 1,
        outcome: {
          weight: 100,
          riderMoraleDelta: 5,
          summary: "Anahit Sarkissian apprécie l’échange à l’écart des micros.",
        },
      },
    } satisfies PostRaceInterviewSnapshot;
    const markup = renderToStaticMarkup(
      <PostRaceInterviewPanel initialInterview={submittedInterview} />,
    );

    expect(markup).toContain("Réaction du coureur");
    expect(markup).toContain("Débriefer au bus");
    expect(markup).toContain("Anahit Sarkissian apprécie l’échange à l’écart des micros.");
    expect(markup).toContain("<span>Moral</span><span>+1</span>");
    expect(markup).not.toContain("+5");
    expect(markup).not.toContain("Ancien récapitulatif de décision");
  });
});
