begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- Editorial eligibility only: no changes to simulation, results or prizes.
-- A connected bot is still a bot; inactivity alone does not turn a player into AI.
create or replace function private.is_cyclogazette_human_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_manager_assignments manager
    join public.sporting_directors director on director.id=manager.sporting_director_id
    where manager.team_id=p_team_id and manager.role='general_manager' and manager.status='active'
      and director.auth_user_id is not null
      and not exists(select 1 from public.alpha_bot_managers bot
        where bot.sporting_director_id=director.id or bot.auth_user_id=director.auth_user_id)
  );
$$;
revoke all on function private.is_cyclogazette_human_team(uuid) from public,anon,authenticated;
grant execute on function private.is_cyclogazette_human_team(uuid) to service_role;

create or replace function public.get_cyclogazette_human_race_editions(
  p_season_day_id uuid, p_include_scheduled boolean default false
)
returns table(race_edition_id uuid)
language sql stable security definer set search_path = '' set statement_timeout = '5s'
as $$
  select stage.race_edition_id from (
    select distinct scheduled.race_edition_id from public.stages scheduled
    where scheduled.season_day_id=p_season_day_id
  ) stage
  where exists (
      select 1 from public.race_registrations registration
      join public.team_seasons team_season on team_season.id=registration.team_season_id
      where registration.race_edition_id=stage.race_edition_id
        and private.is_cyclogazette_human_team(team_season.team_id)
        and exists (
          select 1 from public.race_rosters roster
          where roster.race_registration_id=registration.id
            and (
              (p_include_scheduled and registration.status='accepted' and roster.status in ('selected','confirmed'))
              or exists(select 1 from public.stage_results result
                join public.stages started_stage on started_stage.id=result.stage_id
                  and started_stage.race_edition_id=stage.race_edition_id
                where result.race_roster_id=roster.id
                  and result.status <> 'did_not_start')
            )
        )
    );
$$;
revoke all on function public.get_cyclogazette_human_race_editions(uuid,boolean) from public,anon,authenticated;
grant execute on function public.get_cyclogazette_human_race_editions(uuid,boolean) to service_role;

-- Filter before the editorial LIMIT: AI-only races must not consume the slots
-- that should have been available to races involving players.
create or replace function public.get_cyclogazette_human_race_victories(p_race_edition_ids uuid[], p_limit integer default 12)
returns table(id uuid,race_edition_id uuid,race_roster_id uuid,created_at timestamptz,total_count bigint)
language sql stable security definer set search_path = '' set statement_timeout = '5s'
as $$
  select result.id,result.race_edition_id,result.race_roster_id,result.created_at,count(*) over ()::bigint
  from public.race_results result
  join public.race_editions edition on edition.id=result.race_edition_id
  join public.races race on race.id=edition.race_id
  where result.race_edition_id=any(p_race_edition_ids) and result.final_rank=1
    and race.competition_type not in ('national_road','national_time_trial')
  order by result.created_at desc,result.id
  limit least(12,greatest(1,coalesce(p_limit,12)));
$$;
revoke all on function public.get_cyclogazette_human_race_victories(uuid[],integer) from public,anon,authenticated;
grant execute on function public.get_cyclogazette_human_race_victories(uuid[],integer) to service_role;

create or replace function public.get_cyclogazette_human_development_editions(p_race_edition_ids uuid[])
returns table(race_edition_id uuid)
language sql stable security definer set search_path = '' set statement_timeout = '5s'
as $$
  select requested.id from unnest(p_race_edition_ids) requested(id)
  where exists (
    select 1 from public.development_race_results result
    join public.youth_academy_riders rider on rider.id=result.academy_rider_id
    where result.race_edition_id=requested.id and private.is_cyclogazette_human_team(rider.team_id)
  ) group by requested.id;
$$;
revoke all on function public.get_cyclogazette_human_development_editions(uuid[]) from public,anon,authenticated;
grant execute on function public.get_cyclogazette_human_development_editions(uuid[]) to service_role;

notify pgrst, 'reload schema';
commit;
