import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { GameHeader } from "@/components/game/game-header";
import Link from "@/components/ui/app-link";
import { FAN_CLUB_PRODUCTS } from "@/lib/game/fan-club-pilot";
import type { FanClubDailySalesReport } from "@/lib/game/fan-club-sales-report";
import { createTeamProfileTheme } from "@/lib/game/team-profile-theme";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTeamFanClubBuildings } from "@/services/fan-club-buildings";
import { getFanClubSalesReport } from "@/services/fan-club-sales-report";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Rapport des ventes du Fan Club",
  description:
    "Consultez le compte rendu quotidien et l’historique des ventes de la boutique du club.",
};

const integerFormatter = new Intl.NumberFormat("fr-FR");
const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export default async function FanClubSalesReportPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const headerData = await getGameHeaderData(supabase, user.id);
  if (!headerData.teamId) redirect("/jeu");

  const buildings = await getTeamFanClubBuildings(supabase, headerData.teamId);
  if (buildings.headquartersLevel < 1 || buildings.shopLevel < 1) {
    redirect("/jeu/fan-club");
  }

  const report = await getFanClubSalesReport({
    supabase,
    teamId: headerData.teamId,
  });
  const theme = createTeamProfileTheme(
    headerData.teamSponsorIdentity?.sponsor.colors ?? {
      primary: "#176951",
      secondary: "#278B70",
      accent: "#F2C94C",
      background: "#F5FAF7",
      text: "#183F37",
    },
  );
  const themeStyle = {
    "--fan-primary": theme.primary,
    "--fan-secondary": theme.secondary,
    "--fan-accent": theme.accent,
    "--fan-surface": theme.surface,
    "--fan-soft": theme.soft,
    "--fan-ink": theme.ink,
    "--fan-muted": theme.muted,
    "--fan-line": theme.line,
    "--fan-shadow": theme.shadow,
    background: `radial-gradient(circle at 12% 0%, ${theme.soft} 0, transparent 34rem), ${theme.surface}`,
  } as CSSProperties;

  return (
    <main className="min-h-screen text-[var(--fan-ink)]" style={themeStyle}>
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/jeu/fan-club?onglet=magasin"
          className="inline-flex min-h-10 items-center rounded-xl border border-[var(--fan-line)] bg-white px-4 text-sm font-black text-[var(--fan-primary)] shadow-sm transition hover:bg-[var(--fan-soft)]"
        >
          ← Retour au magasin
        </Link>

        <header className="mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,var(--fan-ink)_0%,var(--fan-primary)_60%,var(--fan-secondary)_100%)] px-6 py-8 text-white shadow-[0_24px_70px_var(--fan-shadow)] sm:px-10 sm:py-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--fan-accent)]">
            Comptabilité quotidienne · Boutique du club
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
            Rapport des ventes
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/80 sm:text-base">
            Chaque CR est produit automatiquement à heure fixe, même si le DS
            ne consulte pas le magasin. Les journées sont conservées ci-dessous
            de la plus récente à la plus ancienne.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <ReportMetric
              label="Articles vendus aujourd’hui"
              value={
                report.processedToday
                  ? integerFormatter.format(report.todayUnitsSold)
                  : "En attente"
              }
            />
            <ReportMetric
              label="Recettes du jour"
              value={
                report.processedToday
                  ? currencyFormatter.format(report.todayRevenue)
                  : "—"
              }
            />
            <ReportMetric
              label="Recettes historisées"
              value={currencyFormatter.format(report.totalRevenue)}
            />
          </div>
        </header>

        <div className="mt-7 space-y-5">
          {report.dailyReports.map((day) => (
            <DailyReportCard
              key={day.key}
              report={day}
              isToday={day.key === report.todayKey}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--fan-accent)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-white sm:text-2xl">{value}</p>
    </article>
  );
}

function DailyReportCard({
  report,
  isToday,
}: {
  report: FanClubDailySalesReport;
  isToday: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-[1.6rem] border border-[var(--fan-line)] bg-white shadow-[0_14px_38px_var(--fan-shadow)]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--fan-line)] bg-[var(--fan-soft)] px-5 py-5 sm:px-7">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--fan-secondary)]">
            {isToday ? "CR du jour" : "Archive quotidienne"}
          </p>
          <h2 className="mt-1 text-xl font-black text-[var(--fan-ink)]">
            {report.seasonName} · J{report.dayNumber}
          </h2>
          {report.calendarDate ? (
            <p className="mt-1 text-xs font-bold capitalize text-[var(--fan-muted)]">
              {dateFormatter.format(
                new Date(`${report.calendarDate}T12:00:00Z`),
              )}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-black">
          <span
            className={[
              "rounded-full px-3 py-1.5",
              report.processed
                ? "bg-white text-[var(--fan-primary)]"
                : "bg-[#FFF3CD] text-[#7A6119]",
            ].join(" ")}
          >
            {report.processed ? "CR traité" : "CR programmé"}
          </span>
          <span className="rounded-full bg-[var(--fan-primary)] px-3 py-1.5 text-white">
            {integerFormatter.format(report.unitsSold)} vendus ·{" "}
            {currencyFormatter.format(report.revenue)}
          </span>
        </div>
      </header>

      {report.lines.length > 0 ? (
        <div className="overflow-x-auto px-5 py-2 sm:px-7">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--fan-line)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--fan-muted)]">
                <th className="px-2 py-3">Article</th>
                <th className="px-2 py-3 text-right">Unités</th>
                <th className="px-2 py-3 text-right">Prix unitaire</th>
                <th className="px-2 py-3 text-right">Recette</th>
                <th className="px-2 py-3 text-right">Conjoncture</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((line) => {
                const product = FAN_CLUB_PRODUCTS.find(
                  (candidate) => candidate.id === line.productId,
                );
                return (
                  <tr
                    key={line.id}
                    className="border-b border-[var(--fan-line)] last:border-b-0"
                  >
                    <td className="px-2 py-4 font-black text-[var(--fan-ink)]">
                      {product?.name ?? "Article"}
                    </td>
                    <td className="px-2 py-4 text-right font-black text-[var(--fan-secondary)]">
                      {integerFormatter.format(line.unitsSold)}
                    </td>
                    <td className="px-2 py-4 text-right font-bold text-[var(--fan-muted)]">
                      {currencyFormatter.format(line.unitPrice)}
                    </td>
                    <td className="px-2 py-4 text-right font-black text-[var(--fan-primary)]">
                      {currencyFormatter.format(line.revenue)}
                    </td>
                    <td className="px-2 py-4 text-right font-bold text-[var(--fan-muted)]">
                      {formatDemand(line.demandFactor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-6 text-sm font-bold leading-6 text-[var(--fan-muted)] sm:px-7">
          {report.processed
            ? "Aucune vente sur cette journée. Vérifiez les prix et le stock disponible."
            : "Le compte rendu apparaîtra automatiquement après le prochain règlement quotidien."}
        </p>
      )}
    </article>
  );
}

function formatDemand(factor: number): string {
  if (factor >= 1.15) return "Journée porteuse";
  if (factor <= 0.8) return "Journée calme";
  return "Demande normale";
}
