begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

alter table public.pcm_gala_events add column if not exists registration_closes_at timestamptz;
update public.pcm_gala_events as event
set registration_closes_at = '2026-10-08 12:00:00 Europe/Paris'::timestamptz,
    updated_at = now()
from public.seasons as season
where season.id = event.season_id and season.game_year = 3
  and event.event_key = 'gala-des-puncheurs';

-- Retrouver ce gala après le changement de saison, sans créer de nouvelles inscriptions.
create or replace function private.season_finale_gala_source_season_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select season_id from public.pcm_gala_events
     where event_key = 'gala-des-puncheurs' and registration_closes_at is not null
     order by registration_closes_at desc limit 1),
    (select id from public.seasons where status = 'active' order by game_year desc limit 1)
  );
$$;

-- Projection en lecture seule : aucun contrat ou nom d'équipe n'est activé avant la saison suivante.
create or replace function private.season_finale_gala_team_identity(p_team_id uuid)
returns table (
  team_id uuid, identity_season integer, team_name text, team_short_name text,
  team_country_code text, registration_country_id uuid, sponsor_catalog_key text,
  jersey_id text, jersey_style text, identity_ready boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  with source as (
    select season.id, season.game_year, current_team.display_name, current_team.short_name,
           current_team.registration_country_id
    from public.seasons season
    join public.team_seasons current_team on current_team.season_id = season.id
      and current_team.team_id = p_team_id
    where season.id = private.season_finale_gala_source_season_id()
  ), target as (
    select season.id, season.game_year from public.seasons season
    join source on season.game_year = source.game_year + 1
  ), principal as (
    select sponsor.name, sponsor.short_name, sponsor.country_id, sponsor.catalog_key,
      case when contract.pending_jersey_season_id = target.id
        then coalesce(contract.pending_jersey_id, contract.selected_jersey_id)
        else contract.selected_jersey_id end as jersey_id,
      case when contract.pending_jersey_season_id = target.id
        then coalesce(contract.pending_jersey_style, contract.selected_jersey_style)
        else contract.selected_jersey_style end as jersey_style
    from target
    join public.team_sponsor_contracts contract on contract.team_id = p_team_id
      and contract.role = 'principal' and contract.status in ('planned', 'active')
    join public.seasons starts on starts.id = contract.start_season_id
      and starts.game_year <= target.game_year
      and starts.game_year + contract.contract_duration_seasons - 1 >= target.game_year
    join public.sponsors sponsor on sponsor.id = contract.sponsor_id
    order by (contract.status = 'planned') desc, starts.game_year desc, contract.created_at desc
    limit 1
  ), secondary as (
    select sponsor.name from target
    join public.secondary_sponsor_contracts contract on contract.team_id = p_team_id
      and contract.season_id = target.id and contract.status in ('planned', 'active')
    join public.secondary_sponsor_catalog sponsor on sponsor.id = contract.secondary_sponsor_id
    limit 1
  ), resolved as (
    select source.*, target.id as target_id,
      coalesce(principal.name, source.display_name) as primary_name,
      coalesce(principal.short_name, source.short_name, source.display_name) as primary_short_name,
      coalesce(principal.country_id, source.registration_country_id) as country_id,
      principal.catalog_key, principal.jersey_id, principal.jersey_style, secondary.name as secondary_name,
      target.id is not null and (principal.name is not null or not exists (
        select 1 from public.team_sponsor_contracts contract
        join public.seasons starts on starts.id = contract.start_season_id
        where contract.team_id = p_team_id and contract.role = 'principal' and contract.status in ('active', 'completed')
          and starts.game_year <= source.game_year
          and starts.game_year + contract.contract_duration_seasons - 1 >= source.game_year
      )) as ready
    from source left join target on true left join principal on true left join secondary on true
  )
  select p_team_id, resolved.game_year + 1,
    case when ready then primary_name || coalesce(' - ' || secondary_name, '')
      else display_name || ' · identité S' || (resolved.game_year + 1)::text || ' à confirmer' end,
    left(primary_short_name || coalesce('-' || secondary_name, ''), 30),
    coalesce(country.iso_alpha2, '')::text, resolved.country_id, catalog_key::text,
    resolved.jersey_id::text, resolved.jersey_style::text, ready
  from resolved left join public.countries country on country.id = resolved.country_id;
$$;

create or replace function public.get_pcm_gala_team_identities(p_team_ids uuid[] default null)
returns table (
  team_id uuid, identity_season integer, team_name text, team_short_name text,
  team_country_code text, registration_country_id uuid, sponsor_catalog_key text,
  jersey_id text, jersey_style text, identity_ready boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  select identity.* from public.team_seasons team_season
  cross join lateral private.season_finale_gala_team_identity(team_season.team_id) identity
  where team_season.season_id = private.season_finale_gala_source_season_id()
    and (auth.uid() is not null or auth.role() = 'service_role')
    and (p_team_ids is not null and team_season.team_id = any(p_team_ids)
      or p_team_ids is null and exists (
        select 1 from public.team_manager_assignments assignment
        join public.sporting_directors director on director.id = assignment.sporting_director_id
        where assignment.team_id = team_season.team_id and assignment.role = 'general_manager'
          and assignment.status = 'active' and director.status = 'active' and director.auth_user_id = auth.uid()
      ));
$$;

create or replace function public.get_season_finale_gala_export_context()
returns table (id uuid, game_year integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select season.id, season.game_year from public.seasons season
  where season.id = private.season_finale_gala_source_season_id();
$$;

create or replace function public.get_current_team_season_finale_gala_context()
returns table (event_key text, event_status text, roster_size integer, selected_event_key text, selected_rider_ids uuid[])
language sql security definer set search_path = public, pg_temp as $$
  with current_team as (
    select assignment.team_id from public.team_manager_assignments assignment
    join public.sporting_directors director on director.id = assignment.sporting_director_id
    join public.teams team on team.id = assignment.team_id and team.status = 'active'
    where director.auth_user_id = auth.uid() and director.status = 'active'
      and assignment.role = 'general_manager' and assignment.status = 'active'
    limit 1
  )
  select event.event_key::text,
    case when event.status = 'open' and event.registration_closes_at <= clock_timestamp()
      then 'closed' else event.status end::text,
    event.roster_size::integer, selected_event.event_key::text,
    coalesce((select array_agg(rider_id order by position) from public.pcm_gala_registration_riders
      where registration_id = registration.id), array[]::uuid[])
  from current_team
  join public.pcm_gala_events event on event.season_id = private.season_finale_gala_source_season_id()
  left join public.pcm_gala_registrations registration on registration.team_id = current_team.team_id
    and registration.season_id = event.season_id
  left join public.pcm_gala_events selected_event on selected_event.id = registration.gala_event_id
  order by event.sort_order;
$$;

create or replace function private.guard_pcm_gala_registration_deadline()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare closes_at timestamptz;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select registration_closes_at into closes_at from public.pcm_gala_events where id = old.gala_event_id;
    if closes_at <= clock_timestamp() then raise exception 'Les inscriptions a cette course sont fermees.'; end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select registration_closes_at into closes_at from public.pcm_gala_events where id = new.gala_event_id;
    if closes_at <= clock_timestamp() then raise exception 'Les inscriptions a cette course sont fermees.'; end if;
    if closes_at is not null and not coalesce((select identity_ready
      from private.season_finale_gala_team_identity(new.team_id)), false) then
      raise exception 'Confirmez votre identite de la saison suivante avant de vous inscrire au gala.';
    end if;
    return new;
  end if;
  return old;
end;
$$;
drop trigger if exists pcm_gala_registration_deadline_guard on public.pcm_gala_registrations;
create trigger pcm_gala_registration_deadline_guard before insert or update or delete
on public.pcm_gala_registrations for each row execute function private.guard_pcm_gala_registration_deadline();

create or replace function public.get_pcm_gala_public_startlists()
returns table (event_key text, team_id uuid, team_name text, team_short_name text, team_country_code text,
  rider_id uuid, rider_first_name text, rider_last_name text, rider_country_code text,
  rider_position integer, registered_at timestamptz)
language sql security definer set search_path = public, pg_temp as $$
  select event.event_key::text, registration.team_id,
    case when event.event_key = 'gala-des-puncheurs' then identity.team_name else team_season.display_name end::text,
    case when event.event_key = 'gala-des-puncheurs' then identity.team_short_name
      else coalesce(team_season.short_name, team_season.display_name) end::text,
    case when event.event_key = 'gala-des-puncheurs' then identity.team_country_code
      else coalesce(team_country.iso_alpha2, '') end::text,
    selection.rider_id, rider.first_name::text, rider.last_name::text,
    coalesce(rider_country.iso_alpha2, '')::text, selection.position::integer, registration.registered_at
  from public.pcm_gala_events event
  join public.seasons season on season.id = event.season_id
  join public.pcm_gala_registrations registration on registration.gala_event_id = event.id
    and registration.season_id = event.season_id
  join public.team_seasons team_season on team_season.team_id = registration.team_id
    and team_season.season_id = event.season_id
  left join lateral private.season_finale_gala_team_identity(registration.team_id) identity
    on event.event_key = 'gala-des-puncheurs'
  left join public.countries team_country on team_country.id = team_season.registration_country_id
  join public.pcm_gala_registration_riders selection on selection.registration_id = registration.id
  join public.riders rider on rider.id = selection.rider_id
  left join public.countries rider_country on rider_country.id = rider.country_id
  where auth.uid() is not null and (
    event.event_key = 'gala-des-puncheurs' and event.season_id = private.season_finale_gala_source_season_id()
    or event.event_key <> 'gala-des-puncheurs' and season.status = 'active' and team_season.status = 'active'
  )
  order by event.sort_order, 3, registration.team_id, selection.position;
$$;

revoke all on function private.season_finale_gala_source_season_id() from public, anon, authenticated;
revoke all on function private.season_finale_gala_team_identity(uuid) from public, anon, authenticated;
revoke all on function private.guard_pcm_gala_registration_deadline() from public, anon, authenticated;
revoke all on function public.get_pcm_gala_team_identities(uuid[]) from public, anon;
revoke all on function public.get_current_team_season_finale_gala_context() from public, anon;
revoke all on function public.get_pcm_gala_public_startlists() from public, anon;
revoke all on function public.get_season_finale_gala_export_context() from public, anon, authenticated;
grant execute on function public.get_pcm_gala_team_identities(uuid[]) to authenticated, service_role;
grant execute on function public.get_current_team_season_finale_gala_context() to authenticated;
grant execute on function public.get_pcm_gala_public_startlists() to authenticated;
grant execute on function public.get_season_finale_gala_export_context() to service_role;
notify pgrst, 'reload schema';
commit;
