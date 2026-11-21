begin;
set local application_name = 'international-selection-trophies';
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create index if not exists federation_selection_members_professional_owner_idx
  on public.national_federation_selection_members
    (owner_director_id, selection_list_id, professional_rider_id)
  where professional_rider_id is not null;

create function public.get_sporting_director_selection_trophy_wins(
  p_sporting_director_id uuid
)
returns table (
  id uuid, race_slug text, race_name text, season_id uuid,
  won_at timestamptz, rider_name text, competition_type text
)
language sql stable security definer set search_path = ''
set statement_timeout = '8s'
as $$
  with candidate_rosters as materialized (
    -- The director's callups and historical club riders bound the lookup.
    -- A later signing can move the beneficiary away from the callup owner.
    select roster.id
    from public.national_federation_selection_members as member
    join public.national_federation_selection_race_links as link
      on link.selection_list_id = member.selection_list_id
    join public.race_rosters as roster
      on roster.race_registration_id = link.race_registration_id
      and roster.rider_id = member.professional_rider_id
    join public.race_results as winner on winner.race_roster_id = roster.id
      and winner.final_rank = 1 and winner.status = 'classified'
    where member.owner_director_id = p_sporting_director_id
      and member.professional_rider_id is not null

    union

    select roster.id
    from public.team_manager_assignments as assignment
    join public.rider_contracts as contract on contract.team_id = assignment.team_id
      and contract.status in ('active', 'completed', 'terminated')
    join public.race_rosters as roster on roster.rider_id = contract.rider_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
      and registration.team_season_id is null
    join public.race_results as winner on winner.race_roster_id = roster.id
      and winner.final_rank = 1 and winner.status = 'classified'
    where assignment.sporting_director_id = p_sporting_director_id
      and assignment.role = 'general_manager'
      and assignment.status in ('active', 'completed', 'terminated')
  ), candidate_wins as materialized (
    select result.id, result.race_roster_id, result.race_edition_id, result.created_at,
      race.slug, edition.display_name, edition.season_id, race.competition_type
    from candidate_rosters as candidate
    join public.race_results as result on result.race_roster_id = candidate.id
      and result.final_rank = 1 and result.status = 'classified'
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
      and registration.race_edition_id = result.race_edition_id
      and registration.team_season_id is null
    join public.race_editions as edition on edition.id = result.race_edition_id
      and edition.status = 'completed'
    join public.races as race on race.id = edition.race_id
      and race.competition_type in ('world_championship', 'continental_championship')
  )
  select win.id, win.slug, win.display_name, win.season_id, win.created_at,
    concat_ws(' ', rider.first_name, rider.last_name), win.competition_type
  from candidate_wins as win
  cross join lateral private.get_quadrennial_games_club_beneficiaries(win.race_edition_id) as owner
  join public.riders as rider on rider.id = owner.rider_id
  where owner.race_roster_id = win.race_roster_id
    and owner.final_rank = 1
    and owner.owner_director_id = p_sporting_director_id;
$$;

revoke all on function public.get_sporting_director_selection_trophy_wins(uuid)
  from public, anon, authenticated;
grant execute on function public.get_sporting_director_selection_trophy_wins(uuid)
  to service_role;

create or replace function private.notify_major_race_trophies(p_race_edition_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_context record;
  v_winner record;
  v_director record;
  v_kind text;
  v_notification_id uuid;
  v_created integer := 0;
begin
  select edition.id, edition.season_id, edition.display_name, race.slug,
    race.is_grand_tour, race.is_monument,
    coalesce(race.competition_type, 'standard') as competition_type,
    season.name as season_name
  into v_context
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  join public.seasons as season on season.id = edition.season_id
  where edition.id = p_race_edition_id and edition.status = 'completed'
    and (race.is_grand_tour or race.is_monument
      or race.competition_type in ('world_championship', 'continental_championship'));

  if not found then return 0; end if;

  select result.id as result_id, registration.team_season_id is not null as is_club_registration,
    coalesce(registration.team_season_id, owner.team_season_id) as team_season_id,
    team_season.team_id, owner.owner_director_id as selection_director_id,
    rider.first_name, rider.last_name
  into v_winner
  from public.race_results as result
  join public.race_rosters as roster on roster.id = result.race_roster_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
    and registration.race_edition_id = result.race_edition_id
  left join public.team_seasons as team_season on team_season.id = registration.team_season_id
  left join lateral private.get_quadrennial_games_club_beneficiaries(p_race_edition_id) as owner
    on registration.team_season_id is null
    and v_context.competition_type in ('world_championship', 'continental_championship')
    and owner.race_roster_id = roster.id and owner.final_rank = 1
  join public.riders as rider on rider.id = roster.rider_id
  where result.race_edition_id = p_race_edition_id
    and result.status = 'classified' and result.final_rank = 1
  limit 1;

  if not found then return 0; end if;

  v_kind := case
    when v_context.competition_type = 'world_championship' then 'world_championship'
    when v_context.competition_type = 'continental_championship' then 'continental_championship'
    when v_context.is_grand_tour then 'grand_tour'
    else 'monument'
  end;

  for v_director in
    select v_winner.selection_director_id as sporting_director_id
    where v_winner.selection_director_id is not null
    union all
    select managed.sporting_director_id
    from private.managed_directors_for_team_season(v_winner.team_id, v_context.season_id) as managed
    where v_winner.is_club_registration
  loop
    v_notification_id := private.create_trophy_notification(
      v_director.sporting_director_id, v_kind, v_kind || ':' || v_context.slug,
      v_context.display_name, 'race:' || v_winner.result_id::text, now(),
      v_context.season_id, v_winner.team_season_id,
      concat_ws(' ', v_winner.first_name, v_winner.last_name)
        || ' s’impose en ' || v_context.display_name || ' (' || v_context.season_name || ').'
    );
    if v_notification_id is not null then v_created := v_created + 1; end if;
  end loop;
  return v_created;
end;
$$;

revoke all on function private.notify_major_race_trophies(uuid) from public, anon, authenticated;
grant execute on function private.notify_major_race_trophies(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
