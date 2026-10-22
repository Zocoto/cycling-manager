begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

alter table public.season_awards
  alter column stat_value type numeric(14, 2),
  drop constraint season_awards_key_allowed,
  add constraint season_awards_key_allowed check (award_key in (
    'rider_of_year','team_of_year','serial_winner','young_rider','director_of_year',
    'injury_rider','injury_director','red_lantern_rider','red_lantern_director',
    'negotiator','sudoku_master','crossword_master','builder','mixed_zone',
    'chatterbox','youth_developer','junior_rider_of_year','junior_director_of_year',
    'paddock_favorite','homegrown_squad','national_identity','international_squad'
  ));

create table public.season_award_finalizations (
  season_id uuid primary key references public.seasons(id) on delete cascade,
  award_count integer not null check (award_count >= 0),
  finalized_at timestamptz not null default now()
);
alter table public.season_award_finalizations enable row level security;
revoke all on public.season_award_finalizations from public, anon, authenticated;
grant select, insert on public.season_award_finalizations to service_role;

create function private.season_awards_ready(p_season_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select season.status = 'completed' or (
    season.status = 'active' and season.current_day_number = 28
    and not exists (select 1 from public.race_editions edition
      where edition.season_id = season.id and edition.status not in ('completed','cancelled'))
  ) from public.seasons season where season.id = p_season_id), false);
$$;
revoke all on function private.season_awards_ready(uuid) from public, anon, authenticated;
grant execute on function private.season_awards_ready(uuid) to service_role;

-- Preserve all 19 existing calculations. Only replace the two readiness guards.
-- Hash normalized bodies so the reviewed patch is independent of CRLF/LF files.
do $patch$
declare v_source text; v_definition text; v_guard text; v_start integer; v_end integer;
begin
  select replace(prosrc, E'\r\n', E'\n'), replace(pg_get_functiondef(oid), E'\r\n', E'\n')
  into v_source, v_definition from pg_proc
  where oid = 'private.create_core_season_awards_before_expansion(uuid)'::regprocedure;
  if md5(v_source) <> '62dbcbb4721b961b886c277455eb3e25' then
    raise exception 'Unexpected core season-award definition; review required.';
  end if;
  v_start := strpos(v_source, E'  if not found or (\n');
  v_end := strpos(v_source, E'\n\n  insert into public.season_awards (');
  if v_start = 0 or v_end <= v_start then raise exception 'Core award guard not found.'; end if;
  v_guard := substr(v_source, v_start, v_end - v_start);
  execute replace(v_definition, v_guard,
    E'  if not private.season_awards_ready(p_season_id) then\n    return 0;\n  end if;');

  select replace(prosrc, E'\r\n', E'\n'), replace(pg_get_functiondef(oid), E'\r\n', E'\n')
  into v_source, v_definition from pg_proc
  where oid = 'private.create_season_awards_for_season(uuid)'::regprocedure;
  if md5(v_source) <> '2c6b453a6b1c8907a82beb946b709047' then
    raise exception 'Unexpected expanded season-award definition; review required.';
  end if;
  v_guard := E'  if not found or v_season.status <> ''completed'' then\n    return v_created;\n  end if;';
  if strpos(v_source, v_guard) = 0 then raise exception 'Expanded award guard not found.'; end if;
  execute replace(v_definition, v_guard,
    E'  if not private.season_awards_ready(p_season_id) then\n    return v_created;\n  end if;');
end;
$patch$;

alter function private.create_season_awards_for_season(uuid) rename to create_season_awards_before_roster_identity;
revoke all on function private.create_season_awards_before_roster_identity(uuid) from public, anon, authenticated;
grant execute on function private.create_season_awards_before_roster_identity(uuid) to service_role;

create function private.create_season_awards_for_season(p_season_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_created integer := 0; v_rows integer := 0; v_game_year integer;
begin
  if not private.season_awards_ready(p_season_id) then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended('season-awards:' || p_season_id::text, 0));
  if exists (select 1 from public.season_award_finalizations where season_id = p_season_id) then return 0; end if;
  v_created := private.create_season_awards_before_roster_identity(p_season_id);
  select game_year into strict v_game_year from public.seasons where id = p_season_id;

  -- New roster distinctions start with S4. Past nationalities and rosters must
  -- not be guessed from today's riders. Existing historical awards stay intact.
  if v_game_year >= 4 then
    with final_contracts as materialized (
      select distinct on (contract.rider_id) contract.rider_id, contract.team_id
      from public.rider_contracts contract
      join public.seasons first_season on first_season.id = contract.start_season_id
      join public.seasons last_season on last_season.id = contract.end_season_id
      left join public.seasons left_season on left_season.id = contract.left_season_id
      where first_season.game_year <= v_game_year and last_season.game_year >= v_game_year
        and contract.status <> 'cancelled'
        and (contract.status <> 'terminated' or left_season.game_year > v_game_year)
        and (first_season.game_year < v_game_year or coalesce(contract.joined_day_number, 1) <= 28)
        and (contract.left_season_id is null or left_season.game_year > v_game_year)
      order by contract.rider_id, first_season.game_year desc,
        contract.joined_day_number desc nulls last, contract.signed_at desc, contract.id
    ), eligible_teams as materialized (
      select team_season.team_id,team_season.display_name,team_season.registration_country_id,
        manager.sporting_director_id
      from public.team_seasons team_season
      join lateral private.season_award_team_director(team_season.team_id,p_season_id) manager on true
      where team_season.season_id = p_season_id and team_season.status <> 'withdrawn'
    ), roster_stats as materialized (
      select team_season.team_id, team_season.display_name as team_name,
        team_season.sporting_director_id,
        count(*)::integer as roster_size,
        count(*) filter (where exists (select 1 from public.youth_academy_riders academy
          where academy.promoted_rider_id = rider.id and academy.team_id = team_season.team_id
            and academy.status = 'promoted'))::integer as homegrown_count,
        count(*) filter (where rider.country_id = team_season.registration_country_id)::integer as national_count,
        count(distinct rider.country_id)::integer as nationality_count
      from final_contracts contract
      join eligible_teams team_season on team_season.team_id = contract.team_id
      join public.riders rider on rider.id = contract.rider_id
      group by team_season.team_id, team_season.display_name, team_season.sporting_director_id
    ), candidates as (
      select stats.*, award.*,
        case when award.award_key = 'international_squad' then stats.nationality_count::numeric
          else 100.0 * award.qualifying_count / stats.roster_size end as metric
      from roster_stats stats cross join lateral (values
        ('homegrown_squad','ADN du club',
          'L’équipe dont la plus grande part de l’effectif professionnel a été formée dans son propre centre de formation.',stats.homegrown_count),
        ('national_identity','Fierté nationale',
          'L’équipe dont la plus grande part de l’effectif professionnel représente la nationalité du club.',stats.national_count),
        ('international_squad','Peloton sans frontières',
          'L’équipe qui réunit le plus de nationalités différentes dans son effectif professionnel.',stats.nationality_count)
      ) award(award_key,title,description,qualifying_count)
      where award.qualifying_count > 0
    ), ranked as (
      select *, row_number() over (partition by award_key order by metric desc,
        qualifying_count desc, roster_size desc, team_name, team_id) as rank
      from candidates
    )
    insert into public.season_awards (
      season_id,award_key,title,description,recipient_type,team_id,sporting_director_id,
      recipient_name,team_name,stat_value,stat_label
    ) select p_season_id,award_key,title,description,'team',team_id,sporting_director_id,
      team_name,team_name,round(metric,2),
      case when award_key = 'international_squad' then 'nationalités'
        else format('%% · %s/%s',qualifying_count,roster_size) end
    from ranked where rank = 1
    on conflict (season_id,award_key) do nothing;
    get diagnostics v_rows = row_count;
    v_created := v_created + v_rows;
  end if;

  insert into public.season_award_finalizations(season_id,award_count)
    select p_season_id,count(*)::integer from public.season_awards where season_id = p_season_id;
  return v_created;
end;
$$;
revoke all on function private.create_season_awards_for_season(uuid) from public, anon, authenticated;
grant execute on function private.create_season_awards_for_season(uuid) to service_role;

-- Keep the existing completion trigger as a fallback, and rebind its cached
-- call to the new wrapper after the previous builder was renamed.
create or replace function private.create_season_awards_after_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform private.create_season_awards_for_season(new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.create_season_awards_after_completion() from public, anon, authenticated;

create or replace function public.prepare_cyclogazette_season_gala(p_season_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_season record; v_pending_stages integer; v_pending_editions integer; v_award_count integer;
begin
  select status,current_day_number into v_season from public.seasons where id = p_season_id;
  if not found or not (v_season.status = 'completed' or (v_season.status = 'active' and v_season.current_day_number = 28)) then
    return jsonb_build_object('ready',false,'reason','not-final-day','pendingStages',0,'pendingEditions',0,'awardCount',0);
  end if;
  select award_count into v_award_count from public.season_award_finalizations where season_id = p_season_id;
  if found then
    return jsonb_build_object('ready',true,'reason','already-finalized','pendingStages',0,'pendingEditions',0,'awardCount',v_award_count);
  end if;
  select count(*)::integer into v_pending_editions from public.race_editions
    where season_id = p_season_id and status not in ('completed','cancelled');
  select count(*)::integer into v_pending_stages from public.stages stage
    join public.race_editions edition on edition.id = stage.race_edition_id
    where edition.season_id = p_season_id and edition.status not in ('completed','cancelled')
      and stage.status not in ('completed','cancelled');
  if v_season.status <> 'completed' and (v_pending_editions > 0 or v_pending_stages > 0) then
    return jsonb_build_object('ready',false,'reason','races-still-pending',
      'pendingStages',v_pending_stages,'pendingEditions',v_pending_editions,'awardCount',0);
  end if;
  perform private.create_season_awards_for_season(p_season_id);
  select count(*)::integer into v_award_count from public.season_awards where season_id = p_season_id;
  -- Some categories legitimately have no candidate; never require exactly 5 or 22.
  return jsonb_build_object('ready',true,'reason','ready','pendingStages',0,'pendingEditions',0,'awardCount',v_award_count);
end;
$$;
revoke all on function public.prepare_cyclogazette_season_gala(uuid) from public, anon, authenticated;
grant execute on function public.prepare_cyclogazette_season_gala(uuid) to service_role;

comment on table public.season_award_finalizations is 'One immutable award calculation per season, at J28 after the final race or on season completion. No historical backfill.';
notify pgrst, 'reload schema';
commit;
