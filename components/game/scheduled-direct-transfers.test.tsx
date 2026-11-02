import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TransferMarketOverview } from "@/services/transfer-market";

vi.mock("@/components/ui/app-link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
import { ScheduledDirectTransfers } from "./scheduled-direct-transfers";

describe("scheduled direct transfers", () => {
  it("keeps the section hidden without accepted future agreements", () => {
    expect(renderToStaticMarkup(<ScheduledDirectTransfers offers={[]} />)).toBe("");
  });
  it.each(["arrival", "departure"] as const)("shows %s, counterparty and the blocked amount without another confirmation", direction => {
    const offers: NonNullable<TransferMarketOverview["scheduledTransfers"]> = [{ id: "offer", amount: 5000, salaryPerSeason: 9000, currency: "EUR", status: "accepted",
      createdAt: "2026-11-02T12:00:00Z", respondedAt: "2026-11-02T12:01:00Z", buyerTeamId: "buyer", buyerTeamName: "Acheteur", counterpartTeamName: "Adversaire", direction,
      rider: { id: "target", firstName: "Paul", lastName: "Cédé", overall: 60 }, offeredRider: null, effectiveSeasonYear: 5 }];
    const html = renderToStaticMarkup(<ScheduledDirectTransfers offers={offers} />);
    expect(html).toContain("Transferts programmés");
    expect(html).toContain("Début de la saison 5");
    expect(html).toContain("Adversaire");
    expect(html).toContain("Indemnité bloquée");
    if (direction === "departure") expect(html).toContain("Salaire à la charge de l’acheteur");
    expect(html).toContain('href="/jeu/coureurs/target"');
    expect(html).not.toContain("<form");
  });
  it("shows both movements of a scheduled exchange", () => {
    const offers: NonNullable<TransferMarketOverview["scheduledTransfers"]> = [{ id: "trade", amount: 0, salaryPerSeason: 9000, currency: "EUR", status: "accepted", createdAt: "2026-11-02T12:00:00Z", respondedAt: null,
      buyerTeamId: "buyer", buyerTeamName: "Acheteur", counterpartTeamName: "Adversaire", direction: "arrival", effectiveSeasonYear: 5,
      rider: { id: "target", firstName: "Paul", lastName: "Arrivant", overall: 60 }, offeredRider: { id: "offered", firstName: "Jean", lastName: "Sortant", overall: 59, salaryPerSeason: 7000 } }];
    const html = renderToStaticMarkup(<ScheduledDirectTransfers offers={offers} />);
    expect(html).toContain("Échange programmé");
    expect(html).toContain("Arrivée");
    expect(html).toContain("Départ");
    expect(html).toContain("Paul Arrivant");
    expect(html).toContain("Jean Sortant");
    expect(html).toContain("Indemnité bloquée");
  });
});
