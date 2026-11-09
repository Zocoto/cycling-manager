begin;
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

-- Withdraw only this rider's future starts for their former country. The live
-- national ranking and ordinary selectors decide eligibility for the new country.
create or replace function private.reconcile_rider_cn_nationality(
  p_rider_id uuid,
  p_old_country_id uuid,
  p_new_country_id uuid,
  p_now timestamptz
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with withdrawn as (
    update public.race_rosters as roster
    set status = 'withdrawn'
    from public.race_registrations as registration
    join public.race_editions as edition on edition.id = registration.race_edition_id
    join public.seasons as season on season.id = edition.season_id and season.status = 'active'
    join public.races as race on race.id = edition.race_id
    join public.stages as stage on stage.race_edition_id = edition.id and stage.stage_number = 1
    where roster.rider_id = p_rider_id
      and roster.race_registration_id = registration.id
      and roster.status in ('selected', 'confirmed')
      and race.competition_type in ('national_road', 'national_time_trial')
      and race.country_id = p_old_country_id
      and race.country_id is distinct from p_new_country_id
      and edition.status in ('planned', 'registration_open', 'registration_closed')
      and stage.status = 'planned'
      and stage.departure_at > p_now
    returning 1
  )
  select count(*)::integer from withdrawn;
$$;

revoke all on function private.reconcile_rider_cn_nationality(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- The candidate list can predate a concurrent naturalization. Recheck and lock
-- this one rider before any registration, race-conflict or camp side effect.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_candidate_anchor constant text := E'      candidate.rider_id,\n      candidate.team_season_id,';
  v_loop_anchor constant text := E'  loop\n    v_registration_id := null;';
  v_loop_replacement constant text := $guard$  loop
    -- cn_nationality_write_guard_v1
    begin
      perform 1
      from public.riders as current_rider
      where current_rider.id = v_entry.rider_id
        and current_rider.country_id = v_entry.country_id
        and current_rider.status in ('active', 'free_agent', 'academy')
        and (
          current_rider.status <> 'academy'
          or exists (
            select 1
            from public.academy_competition_rider_links as link
            join public.youth_academy_riders as academy on academy.id = link.academy_rider_id
            where link.rider_id = current_rider.id
              and link.season_id = p_season_id
              and academy.country_id = v_entry.country_id
              and academy.status in ('active', 'recruited')
            for share of link, academy nowait
          )
        )
      for share of current_rider nowait;
      if not found then continue; end if;
    exception when lock_not_available then
      continue;
    end;

    v_registration_id := null;$guard$;
begin
  foreach v_signature in array array[
    'public.sync_national_championship_registrations(uuid,timestamptz)'::regprocedure,
    'public.sync_team_national_championship_registrations(uuid,uuid,timestamptz)'::regprocedure
  ] loop
    select replace(pg_get_functiondef(v_signature), chr(13), '') into v_definition;
    if strpos(v_definition, 'cn_nationality_write_guard_v1') > 0 then continue; end if;
    if length(v_definition) - length(replace(v_definition, v_candidate_anchor, '')) <> length(v_candidate_anchor)
      or length(v_definition) - length(replace(v_definition, v_loop_anchor, '')) <> length(v_loop_anchor) then
      raise exception 'Unexpected CN writer source in %; migration aborted', v_signature;
    end if;
    v_definition := replace(v_definition, v_candidate_anchor,
      v_candidate_anchor || E'\n      candidate.country_id,');
    execute replace(v_definition, v_loop_anchor, v_loop_replacement);
  end loop;
end;
$migration$;

commit;
