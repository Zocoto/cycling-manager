// Read-only, bounded production diagnostics; never run gameplay fixtures here.
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
if (readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg") throw new Error("Unexpected linked project.");
const mode = process.argv[2];
function query(sql) {
  const raw = execFileSync(binary, ["db", "query", "--linked", `begin read only; set local statement_timeout='8s'; ${sql}; rollback;`, "--output", "json"], {
    encoding: "utf8", timeout: 20000, maxBuffer: 300000,
  });
  return JSON.parse(raw.slice(raw.indexOf("{"))).rows;
}
if (mode === "--health") {
  console.log(JSON.stringify(query(`select id,game_year,status,current_day_number,
    (select count(*) from rider_training_stat_progress p where p.season_id=s.id) progress_rows,
    (select count(*) from rider_season_ratings r where r.season_id=s.id) rating_rows
    from seasons s where game_year >= (select max(game_year)-1 from seasons where status='active')
    order by game_year limit 4`), null, 2));
} else if (mode === "--counts") {
  console.log(JSON.stringify(query(`select source_progress.stat_code,
    count(*) filter(where source_progress.balance_milli % 1000 <> 0) affected_stats,
    count(*) filter(where target_progress.rider_id is null) missing_current_progress,
    count(*) filter(where target_progress.balance_milli + source_progress.balance_milli % 1000 >= 1000) positive_crossings,
    count(*) filter(where target_progress.balance_milli + source_progress.balance_milli % 1000 <= -1000) negative_crossings,
    min(source_progress.balance_milli) source_min_balance,max(source_progress.balance_milli) source_max_balance
    from seasons target join seasons source on source.game_year=target.game_year-1
    join rider_training_stat_progress source_progress on source_progress.season_id=source.id
    join rider_season_ratings target_rating on target_rating.season_id=target.id and target_rating.rider_id=source_progress.rider_id
    left join rider_training_stat_progress target_progress on target_progress.season_id=target.id
      and target_progress.rider_id=source_progress.rider_id and target_progress.stat_code=source_progress.stat_code
    where target.status='active' group by source_progress.stat_code order by source_progress.stat_code`), null, 2));
} else if (mode === "--baseline") {
  console.log(JSON.stringify(query(`with active as (select id from seasons where status='active'),
    daily_decline as (select session.rider_id,entry.key stat_code,(entry.value)::integer milli
      from rider_training_sessions session join active on active.id=session.season_id
      cross join lateral jsonb_each_text(session.decline_milli) entry
      union all select session.rider_id,entry.key,(entry.value)::integer
      from free_agent_training_sessions session join active on active.id=session.season_id
      cross join lateral jsonb_each_text(session.decline_milli) entry),
    decline_totals as (select rider_id,stat_code,sum(milli) milli from daily_decline group by rider_id,stat_code)
    select progress.stat_code,count(*) compared_rows,
      count(*) filter(where balance_milli>total_training_milli-coalesce(decline.milli,0)-1000*(rating_gain-rating_loss)) unexplained_positive_balance,
      min(balance_milli) current_min_balance,max(balance_milli) current_max_balance
    from rider_training_stat_progress progress join active on active.id=progress.season_id
    left join decline_totals decline on decline.rider_id=progress.rider_id and decline.stat_code=progress.stat_code
    group by progress.stat_code order by progress.stat_code`),null,2));
} else if (mode === "--verify") {
  console.log(JSON.stringify(query(`select target.game_year,count(distinct receipt.rider_id) repaired_riders,count(*) repaired_stats,
    count(*) filter(where receipt.carried_milli>0) positive_remainders,
    count(*) filter(where receipt.carried_milli<0) negative_remainders,
    sum(greatest(0,receipt.rating_change)) recovered_rating_points,
    sum(greatest(0,-receipt.rating_change)) recovered_decline_points,
    (select count(*) from rider_training_stat_progress previous join seasons source on source.id=previous.season_id
      and source.game_year=target.game_year-1 and source.status='completed'
      join rider_season_ratings rating on rating.rider_id=previous.rider_id and rating.season_id=target.id
      where previous.balance_milli % 1000<>0 and not exists(select 1 from rider_training_season_carryovers done
        where done.rider_id=previous.rider_id and done.target_season_id=target.id and done.stat_code=previous.stat_code)) pending_stats,
    (select count(*) from pg_stat_activity where application_name='cycling-manager-training-fraction-catchup-20261011' and state<>'idle') own_running_transactions
    from seasons target join rider_training_season_carryovers receipt on receipt.target_season_id=target.id
    where target.status='active' group by target.id,target.game_year`),null,2));
} else if (mode === "--capture-engines") {
  const rows = query(`select signature,pg_get_functiondef(signature::regprocedure) definition from (values
    ('public.settle_due_training_sessions()'),('public.settle_due_free_agent_training(integer)'),
    ('public.rollover_game_season(uuid,boolean)')) functions(signature)`);
  const directory = "C:/Dev/.tmp-training-season-decimals-runtime";
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "live-engines.json"), JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(rows.map(row => ({ signature: row.signature, characters: row.definition.length }))));
} else {
  throw new Error("Choose --health, --counts, --baseline, --verify or --capture-engines; all modes are read-only.");
}
