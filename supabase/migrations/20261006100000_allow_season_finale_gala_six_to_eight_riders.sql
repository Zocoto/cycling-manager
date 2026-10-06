begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Uniquement le gala vallonné : les anciens profils conservent leurs règles.
insert into public.pcm_gala_events (season_id,event_key,display_name,discipline,pcm_race_id,pcm_stage_id,pcm_stage_filename,roster_size,status,sort_order)
select id,'gala-des-puncheurs','Grand Gala de fin de saison','hilly',15,1015,'topclas_fleche',8,'open',2
from public.seasons where status='active'
on conflict (season_id,event_key) do update
set roster_size=excluded.roster_size, updated_at=now();

create or replace function public.save_current_team_pcm_gala_registration(p_event_key text,p_rider_ids uuid[])
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  authenticated_user_id uuid := auth.uid();
  current_team_id uuid;
  current_season_id uuid;
  target_event_id uuid;
  minimum_roster_size integer;
  maximum_roster_size integer;
  requested_roster_size integer := cardinality(p_rider_ids);
  valid_rider_count integer;
  saved_registration_id uuid;
begin
  if authenticated_user_id is null then raise exception 'Utilisateur non authentifie.'; end if;

  select teams.id,seasons.id into current_team_id,current_season_id
  from public.sporting_directors
  join public.team_manager_assignments on team_manager_assignments.sporting_director_id=sporting_directors.id
    and team_manager_assignments.role='general_manager' and team_manager_assignments.status='active'
  join public.teams on teams.id=team_manager_assignments.team_id and teams.status='active'
  join public.seasons on seasons.status='active'
  where sporting_directors.auth_user_id=authenticated_user_id and sporting_directors.status='active' limit 1;
  if current_team_id is null or current_season_id is null then raise exception 'Aucune equipe active ne peut etre inscrite.'; end if;

  select events.id,
    case when events.event_key='gala-des-puncheurs' then 6 else events.roster_size end,
    case when events.event_key='gala-des-puncheurs' then 8 else events.roster_size end
  into target_event_id,minimum_roster_size,maximum_roster_size
  from public.pcm_gala_events events
  where events.season_id=current_season_id and events.event_key=p_event_key and events.status='open' limit 1;
  if target_event_id is null then raise exception 'Cette course de gala est inconnue ou fermee.'; end if;

  if p_rider_ids is null or requested_roster_size<minimum_roster_size or requested_roster_size>maximum_roster_size
    or (select count(distinct rider_id) from unnest(p_rider_ids) selected(rider_id))<>requested_roster_size then
    raise exception 'Selectionnez entre % et % coureurs differents.',minimum_roster_size,maximum_roster_size;
  end if;

  select count(distinct riders.id)::integer into valid_rider_count
  from public.riders
  join public.rider_contracts on rider_contracts.rider_id=riders.id and rider_contracts.team_id=current_team_id and rider_contracts.status='active'
  join public.seasons contract_start on contract_start.id=rider_contracts.start_season_id
  join public.seasons contract_end on contract_end.id=rider_contracts.end_season_id
  join public.seasons active_season on active_season.id=current_season_id
  join public.rider_season_ratings on rider_season_ratings.rider_id=riders.id and rider_season_ratings.season_id=current_season_id
  where riders.status='active' and riders.id=any(p_rider_ids)
    and contract_start.game_year<=active_season.game_year and contract_end.game_year>=active_season.game_year;
  if valid_rider_count<>requested_roster_size then raise exception 'La selection contient un coureur hors de votre effectif actif.'; end if;

  insert into public.pcm_gala_registrations (gala_event_id,team_id,season_id,registered_at,updated_at)
  values (target_event_id,current_team_id,current_season_id,now(),now())
  on conflict (team_id,season_id) do update set gala_event_id=excluded.gala_event_id,updated_at=now()
  returning id into saved_registration_id;
  delete from public.pcm_gala_registration_riders where registration_id=saved_registration_id;
  insert into public.pcm_gala_registration_riders (registration_id,rider_id,position)
  select saved_registration_id,rider_id,position::smallint from unnest(p_rider_ids) with ordinality selected(rider_id,position);
  return saved_registration_id;
end;
$$;
revoke all on function public.save_current_team_pcm_gala_registration(text,uuid[]) from public,anon;
grant execute on function public.save_current_team_pcm_gala_registration(text,uuid[]) to authenticated;
comment on function public.save_current_team_pcm_gala_registration(text,uuid[]) is
  'Inscriptions gala isolees : 6 a 8 coureurs pour le gala vallonne, aucune limite du nombre d equipes ni mutation sportive.';
notify pgrst,'reload schema';
commit;
