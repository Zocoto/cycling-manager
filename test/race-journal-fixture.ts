import type { RaceCourseJournalEntry } from "@/lib/game/race-course-journal";
import type { TeamStageReport } from "@/lib/game/race-team-stage-report";

export function createRaceJournalFixture(): { entries: RaceCourseJournalEntry[]; report: TeamStageReport } {
  return {
    entries: [
      { id: "start", kind: "start", distanceKm: 0, title: "Départ", detail: "120 coureurs prennent le départ." },
      { id: "breakaway", kind: "breakaway", distanceKm: 42, title: "Échappée", detail: "Marc Petit rejoint le groupe de tête." },
      { id: "gap", kind: "gap", distanceKm: 75, title: "Écart maximal", detail: "L’échappée porte son avance à 2 min 10 s." },
      { id: "incident", kind: "incident", distanceKm: 88, title: "Chute", detail: "Léo Bernard doit abandonner." },
      { id: "junction", kind: "junction", distanceKm: 100, title: "Jonction", detail: "Le peloton reprend les échappés." },
      { id: "finish", kind: "finish", distanceKm: 150, title: "Victoire", detail: "Camille Rapide s’impose." },
    ],
    report: {
      teamName: "Vélo Club des Collines", hasTimeline: true, hasWorkRecording: true, tactics: [],
      riders: [
        { result: { riderId: "leader", riderName: "Lucas Martin", teamId: "own", teamName: "Vélo Club des Collines", rank: 8, status: "finished", elapsedTimeMs: 3665000, gapToWinnerMs: 65000, mountainPoints: 0, sprintPoints: 0, abandonmentReason: null }, role: "Leader", energyAfter: 43, breakawayKm: 0, relayKm: null, workKm: { protection: 0, recovery: 0, peloton: 0, leadout: 0 } },
        { result: { riderId: "helper", riderName: "Marc Petit", teamId: "own", teamName: "Vélo Club des Collines", rank: 44, status: "finished", elapsedTimeMs: 4000000, gapToWinnerMs: 400000, mountainPoints: 0, sprintPoints: 0, abandonmentReason: null }, role: "Équipier", energyAfter: 20, breakawayKm: 28, relayKm: 12, workKm: { protection: 18.5, recovery: 4.2, peloton: 0, leadout: 0 } },
        { result: { riderId: "injured", riderName: "Léo Bernard", teamId: "own", teamName: "Vélo Club des Collines", rank: null, status: "did_not_finish", elapsedTimeMs: null, gapToWinnerMs: null, mountainPoints: 0, sprintPoints: 0, abandonmentReason: "Chute" }, role: "Équipier", energyAfter: null, breakawayKm: 0, relayKm: null, workKm: null },
      ],
      events: [
        { id: "work-0", distanceKm: 0, endKm: 18.5, title: "Protection", detail: "Marc Petit pour Lucas Martin.", riderIds: ["helper", "leader"] },
        { id: "group-2-helper-breakaway", distanceKm: 42, title: "En échappée", detail: "Marc Petit · dans le groupe de tête.", riderIds: ["helper"] },
        { id: "incident-1", distanceKm: 88, title: "Chute", detail: "Léo Bernard.", riderIds: ["injured"] },
        { id: "work-1", distanceKm: 99, endKm: 103.2, title: "Aide au retour", detail: "Marc Petit pour Lucas Martin.", riderIds: ["helper", "leader"] },
      ],
    },
  };
}
