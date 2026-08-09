import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentDashboardOperationalEvents } from "@/services/dashboard-events";
import {
  markAllManagerMailReadAction,
  markManagerMailReadAction,
} from "./actions";

type Summary = {
  team_id: string;
  season_id: string;
  season_day_number: number;
};
type RosterEntry = { rider_id: string };

export default async function ManagerMailboxPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await getAuthenticatedUser(supabase);
  if (!user) redirect("/connexion");
  const [summaryResult, rosterResult] = await Promise.all([
    supabase.rpc("get_current_team_dashboard_summary").maybeSingle<Summary>(),
    supabase.rpc("get_current_team_roster_with_potential"),
  ]);
  const summary = summaryResult.data;
  const roster = (rosterResult.data ?? []) as unknown as RosterEntry[];
  const events = summary
    ? (
        await getCurrentDashboardOperationalEvents({
          authUserId: user.id,
          teamId: summary.team_id,
          seasonId: summary.season_id,
          currentDayNumber: summary.season_day_number,
          riderIds: roster.map((rider) => rider.rider_id),
        })
      ).events
    : [];
  const { data: readStates } = events.length
    ? await supabase
        .from("manager_mail_read_states")
        .select("message_key")
        .eq("auth_user_id", user.id)
        .in(
          "message_key",
          events.map((event) => event.id),
        )
    : { data: [] };
  const readKeys = new Set(
    (readStates ?? []).map((state) => state.message_key),
  );
  const unread = events.filter((event) => !readKeys.has(event.id));

  return (
    <main className="min-h-screen bg-[#F3F8F5] text-[#082A2A]">
      <GameHeader simulatorEmail={user.email} />
      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <BackToOfficeLink />
        <header className="mt-8 flex flex-wrap items-end justify-between gap-4 rounded-[2rem] bg-[#0B302B] p-7 text-white shadow-xl">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
              Bureau du Directeur Sportif
            </p>
            <h1 className="mt-2 text-4xl font-black">Boîte mail</h1>
            <p className="mt-2 font-semibold text-[#BFD1C6]">
              {unread.length
                ? `${unread.length} message${unread.length > 1 ? "s" : ""} à lire`
                : "Tous vos messages sont lus"}
            </p>
          </div>
          {unread.length ? (
            <form action={markAllManagerMailReadAction}>
              {unread.map((event) => (
                <input
                  key={event.id}
                  type="hidden"
                  name="messageKey"
                  value={event.id}
                />
              ))}
              <button className="rounded-xl bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-wide hover:bg-white/20">
                Tout marquer comme lu
              </button>
            </form>
          ) : null}
        </header>
        <div className="mt-6 space-y-3">
          {events.length ? (
            events.map((event) => {
              const unreadMessage = !readKeys.has(event.id);
              return (
                <article
                  key={event.id}
                  className={`rounded-2xl border p-5 shadow-sm ${unreadMessage ? "border-[#F2C94C]/55 bg-[#FFFDF4]" : "border-[#315B3E]/12 bg-white/75"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#278B70]">
                        {event.badgeLabel ?? "Information DS"}
                      </p>
                      <h2 className="mt-1 text-lg font-black">{event.title}</h2>
                      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
                        {event.description}
                      </p>
                    </div>
                    {unreadMessage ? (
                      <span className="rounded-full bg-[#F2C94C]/25 px-3 py-1 text-[10px] font-black uppercase text-[#725611]">
                        Non lu
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={event.href}
                      className="rounded-xl bg-[#176951] px-4 py-2 text-xs font-black text-white"
                    >
                      {event.actionLabel}
                    </Link>
                    {unreadMessage ? (
                      <form action={markManagerMailReadAction}>
                        <input
                          type="hidden"
                          name="messageKey"
                          value={event.id}
                        />
                        <button className="rounded-xl border border-[#315B3E]/20 px-4 py-2 text-xs font-black text-[#48665F]">
                          Marquer comme lu
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="rounded-2xl bg-white p-8 text-center font-semibold text-[#60756E]">
              Aucun message à traiter.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
