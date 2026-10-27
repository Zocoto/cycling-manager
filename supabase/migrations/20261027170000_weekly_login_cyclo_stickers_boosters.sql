-- Real consecutive connection days, independent of the 40-gift claim cycle.
-- First counted connection: S5 or later. No historical attendance backfill.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

create table if not exists public.weekly_login_booster_states (
  sporting_director_id uuid primary key references public.sporting_directors(id) on delete cascade,
  last_connection_on date not null,
  streak_started_on date not null,
  consecutive_days integer not null check(consecutive_days>0),
  boosters_awarded integer not null default 0 check(boosters_awarded>=0),
  last_booster_on date,
  updated_at timestamptz not null default now(),
  check(streak_started_on<=last_connection_on),
  check(last_booster_on is null or last_booster_on<=last_connection_on)
);

-- These are real unopened packs. The public album opening workflow will use
-- this server inventory, never the private preview's browser storage.
create table if not exists public.cyclo_stickers_boosters (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  collection_season_id uuid not null references public.seasons(id) on delete restrict,
  acquisition_source text not null check(btrim(acquisition_source)<>''),
  source_reference text not null check(btrim(source_reference)<>''),
  awarded_on date not null,
  acquired_at timestamptz not null default now(),
  opened_at timestamptz,
  unique(sporting_director_id,acquisition_source,source_reference),
  check(opened_at is null or opened_at>=acquired_at)
);
create index if not exists cyclo_stickers_boosters_unopened_owner_idx
  on public.cyclo_stickers_boosters(sporting_director_id,collection_season_id,acquired_at) where opened_at is null;

alter table public.weekly_login_booster_states enable row level security;
alter table public.cyclo_stickers_boosters enable row level security;
revoke all on public.weekly_login_booster_states,public.cyclo_stickers_boosters from public,anon,authenticated;
grant select on public.weekly_login_booster_states,public.cyclo_stickers_boosters to authenticated;
grant all on public.weekly_login_booster_states,public.cyclo_stickers_boosters to service_role;
drop policy if exists weekly_login_booster_states_read_own on public.weekly_login_booster_states;
create policy weekly_login_booster_states_read_own on public.weekly_login_booster_states for select to authenticated
  using(exists(select 1 from public.sporting_directors d where d.id=sporting_director_id and d.auth_user_id=(select auth.uid())));
drop policy if exists cyclo_stickers_boosters_read_own on public.cyclo_stickers_boosters;
create policy cyclo_stickers_boosters_read_own on public.cyclo_stickers_boosters for select to authenticated
  using(exists(select 1 from public.sporting_directors d where d.id=sporting_director_id and d.auth_user_id=(select auth.uid())));

create or replace function private.record_weekly_login_booster_connection(
  p_director_id uuid,p_season_id uuid,p_connection_on date
)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_state public.weekly_login_booster_states%rowtype;
  v_days integer; v_start date; v_booster_id uuid;
begin
  if p_connection_on is null or not exists(select 1 from public.seasons s
    where s.id=p_season_id and s.game_year>=5 and s.status='active')
    or not exists(select 1 from public.sporting_directors d where d.id=p_director_id and d.status='active'
      and not exists(select 1 from public.alpha_bot_managers b where b.sporting_director_id=d.id)) then
    return;
  end if;
  -- Most visits of the same day need no writes and no row lock.
  select * into v_state from public.weekly_login_booster_states where sporting_director_id=p_director_id;
  if found and v_state.last_connection_on>=p_connection_on then return; end if;
  insert into public.weekly_login_booster_states(sporting_director_id,last_connection_on,streak_started_on,consecutive_days)
    values(p_director_id,p_connection_on,p_connection_on,1) on conflict(sporting_director_id) do nothing;
  -- Serialize only this player's first connection of a new day. Recheck after
  -- waiting: overlapping requests must never advance or award twice.
  select * into strict v_state from public.weekly_login_booster_states where sporting_director_id=p_director_id for update;
  if v_state.last_connection_on>=p_connection_on then return; end if;
  v_days:=case when v_state.last_connection_on=p_connection_on-1 then v_state.consecutive_days+1 else 1 end;
  v_start:=case when v_days=1 then p_connection_on else v_state.streak_started_on end;
  if mod(v_days,7)=0 then
    insert into public.cyclo_stickers_boosters(sporting_director_id,collection_season_id,acquisition_source,source_reference,awarded_on)
    values(p_director_id,p_season_id,'weekly_login',v_start::text||':'||v_days,p_connection_on)
    on conflict(sporting_director_id,acquisition_source,source_reference) do nothing returning id into v_booster_id;
  end if;
  update public.weekly_login_booster_states set last_connection_on=p_connection_on,streak_started_on=v_start,
    consecutive_days=v_days,boosters_awarded=boosters_awarded+case when v_booster_id is null then 0 else 1 end,
    last_booster_on=case when v_booster_id is not null then p_connection_on else last_booster_on end,updated_at=now()
  where sporting_director_id=p_director_id;
end;
$$;
revoke all on function private.record_weekly_login_booster_connection(uuid,uuid,date) from public,anon,authenticated;

create or replace function private.get_weekly_login_booster_progress(p_director_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'consecutiveDays',case when s.last_connection_on>=(now() at time zone 'Europe/Paris')::date-1 then coalesce(s.consecutive_days,0) else 0 end,
    'totalBoostersAwarded',coalesce(s.boosters_awarded,0),
    'boosterAwardedToday',coalesce(s.last_booster_on=(now() at time zone 'Europe/Paris')::date,false)
  ) from (values(p_director_id))owner(id) left join public.weekly_login_booster_states s on s.sporting_director_id=owner.id;
$$;
revoke all on function private.get_weekly_login_booster_progress(uuid) from public,anon,authenticated;

-- Add to the existing attendance request, once per new calendar/game day.
-- No additional HTTP/RPC request and no new lookup for S4 visits.
do $attendance$
declare v_definition text; v_anchor text;
begin
  select replace(pg_get_functiondef('public.record_current_sporting_director_attendance()'::regprocedure),E'\r\n',E'\n') into v_definition;
  if position('record_weekly_login_booster_connection' in v_definition)=0 then
    v_anchor:='  v_inserted_count integer := 0;';
    if position(v_anchor in v_definition)=0 then raise exception 'Unexpected attendance declarations.'; end if;
    v_definition:=replace(v_definition,v_anchor,v_anchor||E'\n  v_activity_inserted_count integer := 0;\n  v_game_year integer;');
    v_anchor:='  on conflict (auth_user_id, activity_on) do nothing;';
    if position(v_anchor in v_definition)=0 then raise exception 'Unexpected daily activity insert.'; end if;
    v_definition:=replace(v_definition,v_anchor,v_anchor||E'\n  get diagnostics v_activity_inserted_count = row_count;');
    v_anchor:=E'    season_day.day_number\n  into';
    if position(v_anchor in v_definition)=0 then raise exception 'Unexpected attendance season query.'; end if;
    v_definition:=replace(v_definition,v_anchor,E'    season_day.day_number,\n    season.game_year\n  into');
    v_anchor:=E'    v_day_number\n  from';
    if position(v_anchor in v_definition)=0 then raise exception 'Unexpected attendance season result.'; end if;
    v_definition:=replace(v_definition,v_anchor,E'    v_day_number,\n    v_game_year\n  from');
    v_anchor:='  get diagnostics v_inserted_count = row_count;';
    if position(v_anchor in v_definition)=0 then raise exception 'Unexpected attendance result.'; end if;
    v_definition:=replace(v_definition,v_anchor,v_anchor||E'\n  if v_game_year>=5 and (v_activity_inserted_count>0 or v_inserted_count>0) then\n    perform private.record_weekly_login_booster_connection(v_director_id,v_season_id,(now() at time zone ''Europe/Paris'')::date);\n  end if;');
    execute v_definition;
  end if;
end;
$attendance$;

-- Expose progress in the existing rewards payload. Recording the authenticated
-- visit here also avoids stale progress while layout.after() is still pending.
do $overview$
declare v_definition text; v_anchor text;
begin
  select replace(pg_get_functiondef('public.get_current_daily_reward_overview()'::regprocedure),E'\r\n',E'\n') into v_definition;
  if position('get_weekly_login_booster_progress' in v_definition)=0 then
    v_anchor:='  if v_context is null then return null; end if;';
    if position(v_anchor in v_definition)=0 then raise exception 'Unexpected daily reward context.'; end if;
    v_definition:=replace(v_definition,v_anchor,v_anchor||E'\n  if v_context.game_year>=5 then\n    perform private.record_weekly_login_booster_connection(v_context.director_id,v_context.season_id,(now() at time zone ''Europe/Paris'')::date);\n  end if;');
    v_anchor:='    ''abilities'', v_abilities';
    if position(v_anchor in v_definition)=0 then raise exception 'Unexpected daily reward payload.'; end if;
    v_definition:=replace(v_definition,v_anchor,v_anchor||E',\n    ''weeklyLogin'', case when v_context.game_year>=5 then private.get_weekly_login_booster_progress(v_context.director_id) else null end');
    execute v_definition;
  end if;
end;
$overview$;

comment on table public.cyclo_stickers_boosters is
  'Persistent Cyclo-Stickers packs, owned by a DS and collection season. Weekly login grants start in S5; no preview/browser data is imported.';
notify pgrst,'reload schema';
commit;
