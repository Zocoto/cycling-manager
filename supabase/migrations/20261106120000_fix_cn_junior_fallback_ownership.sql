-- Keep transfer ownership protection and support the existing national junior fallback.
-- Function-only change: no withdrawals, selections, races or player data are modified.
begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';
CREATE OR REPLACE FUNCTION private.guard_live_rider_commitment_ownership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_team_id uuid;
  v_contract_id uuid;
  v_academy_owner_id uuid;
begin
  if new.rider_id is null then return new; end if;
  if tg_table_name = 'race_rosters' then
    if new.status not in ('selected', 'confirmed') then return new; end if;
    select team_season.team_id into v_team_id
    from public.race_registrations as registration
    join public.team_seasons as team_season on team_season.id = registration.team_season_id
    join public.race_editions as edition on edition.id = registration.race_edition_id
    where registration.id = new.race_registration_id
      and registration.status in ('pending', 'accepted')
      and edition.status not in ('completed', 'cancelled');
  elsif tg_table_name = 'rider_form_camps' then
    if new.status not in ('planned', 'active') then return new; end if;
    select team_season.team_id into v_team_id
    from public.team_seasons as team_season
    join public.seasons as season on season.id = new.season_id and season.status = 'active'
    where team_season.id = new.team_season_id;
  elsif tg_table_name = 'stage_reconnaissance_riders' then
    select team_season.team_id into v_team_id
    from public.stage_reconnaissances as reconnaissance
    join public.team_seasons as team_season on team_season.id = reconnaissance.team_season_id
    join public.seasons as season on season.id = reconnaissance.season_id and season.status = 'active'
    where reconnaissance.id = new.reconnaissance_id
      and reconnaissance.status in ('planned', 'active');
  end if;
  if v_team_id is null then return new; end if;

  select contract.id into v_contract_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id and contract.team_id = v_team_id and contract.status = 'active'
  for key share nowait;
  -- CN fallback juniors are represented by a season-scoped competition rider,
  -- not a professional contract. Validate the real, still-active school owner.
  -- No exception for ordinary races, camps, reconnaissance or former pros.
  if v_contract_id is null and tg_table_name = 'race_rosters' then
    select academy.id into v_academy_owner_id
    from public.race_registrations as registration
    join public.race_editions as edition on edition.id = registration.race_edition_id
    join public.races as race on race.id = edition.race_id
    join public.academy_competition_rider_links as link
      on link.rider_id = new.rider_id and link.season_id = edition.season_id
    join public.riders as rider on rider.id = link.rider_id and rider.status = 'academy'
    join public.youth_academy_riders as academy
      on academy.id = link.academy_rider_id and academy.team_id = v_team_id
     and academy.status in ('active', 'recruited')
    where registration.id = new.race_registration_id
      and race.competition_type in ('national_road', 'national_time_trial')
      and race.country_id = rider.country_id
    for share of academy, link, rider nowait;
  end if;
  if v_contract_id is null and v_academy_owner_id is null then
    raise exception 'Ce coureur ne fait plus partie de l’effectif actif de cette équipe. Actualisez la page avant de confirmer son engagement.';
  end if;
  return new;
exception when lock_not_available then
  raise exception 'Un transfert de ce coureur est en cours. Réessayez son inscription ou son programme dans quelques secondes.'
    using errcode = '55P03';
end;
$function$;
revoke all on function private.guard_live_rider_commitment_ownership() from public,anon,authenticated;
commit;
