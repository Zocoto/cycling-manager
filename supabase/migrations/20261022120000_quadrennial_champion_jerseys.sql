begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Titles share the existing indexed, publicly readable champion history.
-- No standings, rewards, rider ratings or simulation results are changed.
alter table public.rider_national_championship_titles
  drop constraint rider_national_titles_type_allowed;
alter table public.rider_national_championship_titles
  add constraint rider_national_titles_type_allowed check (championship_type in (
    'road', 'time_trial', 'world_road', 'world_time_trial',
    'continental_africa_road', 'continental_africa_time_trial',
    'continental_america_road', 'continental_america_time_trial',
    'continental_asia_road', 'continental_asia_time_trial',
    'continental_europe_road', 'continental_europe_time_trial',
    'continental_oceania_road', 'continental_oceania_time_trial',
    'quadrennial_road', 'quadrennial_time_trial'
  )) not valid;
alter table public.rider_national_championship_titles
  validate constraint rider_national_titles_type_allowed;

create unique index rider_quadrennial_titles_one_active_per_discipline_idx
  on public.rider_national_championship_titles(championship_type)
  where relinquished_at is null and championship_type in ('quadrennial_road', 'quadrennial_time_trial');

create or replace function private.sync_quadrennial_championship_title(p_edition_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_type text;
  v_active_id uuid;
begin
  -- Exact event registry, not names, countries or a generic Nations Cup winner.
  select case when event.race_edition_id = p_edition_id then 'quadrennial_road' else 'quadrennial_time_trial' end
  into v_type
  from public.national_federation_olympic_events event
  join public.seasons season on season.id = event.season_id
  where p_edition_id in (event.race_edition_id, event.time_trial_race_edition_id)
    and season.game_year >= 4 and season.game_year % 4 = 0;
  if v_type is null then return; end if;

  -- Only the winning row reaches this function. Serialize the two title streams independently.
  perform pg_advisory_xact_lock(hashtextextended('quadrennial-title:' || v_type, 0));
  update public.rider_national_championship_titles set relinquished_at = now()
    where championship_type = v_type and relinquished_at is null;

  -- Reconcile the handful of official Games editions. Replaying an old result
  -- cannot dethrone a newer champion; a corrected winner receives the same title.
  with winners as (
    select roster.rider_id, rider.country_id, edition.season_id, edition.id as edition_id,
      result.updated_at as won_at,
      count(*) over (partition by edition.id) as winner_count
    from public.national_federation_olympic_events event
    join public.seasons season on season.id = event.season_id
      and season.game_year >= 4 and season.game_year % 4 = 0
    join public.race_editions edition on edition.id = case when v_type = 'quadrennial_road'
      then event.race_edition_id else event.time_trial_race_edition_id end
      and edition.season_id = event.season_id
    join public.races race on race.id = edition.race_id and race.competition_type = 'nations_cup'
    join public.race_results result on result.race_edition_id = edition.id
      and result.status = 'classified' and result.final_rank = 1
    join public.race_rosters roster on roster.id = result.race_roster_id
    join public.riders rider on rider.id = roster.rider_id
  )
  insert into public.rider_national_championship_titles
    (rider_id, country_id, season_id, race_edition_id, championship_type, won_at, relinquished_at)
  select rider_id, country_id, season_id, edition_id, v_type, won_at, now()
  from winners where winner_count = 1
  on conflict (race_edition_id, championship_type) do update set
    rider_id = excluded.rider_id, country_id = excluded.country_id,
    won_at = excluded.won_at;

  -- A removed/disqualified or ambiguous winner must not keep an active jersey.
  delete from public.rider_national_championship_titles title
  where title.championship_type = v_type and not exists (
    select 1 from public.race_results result
    join public.race_rosters roster on roster.id = result.race_roster_id
    where result.race_edition_id = title.race_edition_id
      and result.status = 'classified' and result.final_rank = 1
    group by result.race_edition_id
    having count(*) = 1 and bool_and(roster.rider_id = title.rider_id)
  );

  select title.id into v_active_id from public.rider_national_championship_titles title
  join public.seasons season on season.id = title.season_id
  where title.championship_type = v_type
  order by season.game_year desc, title.won_at desc, title.id desc limit 1;
  update public.rider_national_championship_titles set relinquished_at = null where id = v_active_id;
end;
$$;
revoke all on function private.sync_quadrennial_championship_title(uuid) from public, anon, authenticated;

create or replace function private.assign_quadrennial_championship_title()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_quadrennial_championship_title(old.race_edition_id);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.race_edition_id is distinct from new.race_edition_id then
    perform private.sync_quadrennial_championship_title(old.race_edition_id);
  end if;
  perform private.sync_quadrennial_championship_title(new.race_edition_id);
  return new;
end;
$$;
revoke all on function private.assign_quadrennial_championship_title() from public, anon, authenticated;

create trigger assign_quadrennial_title_on_insert after insert on public.race_results
for each row when (new.final_rank = 1)
execute function private.assign_quadrennial_championship_title();
create trigger assign_quadrennial_title_on_update
after update of status, final_rank, race_roster_id, race_edition_id on public.race_results
for each row when (old.final_rank = 1 or new.final_rank = 1)
execute function private.assign_quadrennial_championship_title();
create trigger assign_quadrennial_title_on_delete after delete on public.race_results
for each row when (old.final_rank = 1)
execute function private.assign_quadrennial_championship_title();

-- Idempotent recovery of any Games already finished, with no race mutations.
do $$ declare v_edition uuid; begin
  for v_edition in
    select event.race_edition_id from public.national_federation_olympic_events event
    union select event.time_trial_race_edition_id from public.national_federation_olympic_events event
    where event.time_trial_race_edition_id is not null
  loop perform private.sync_quadrennial_championship_title(v_edition); end loop;
end $$;

commit;
