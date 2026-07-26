-- ============================================================
-- CYCLING MANAGER
-- Inscriptions et arbitrage des Wild Cards des courses Elite
-- ============================================================

begin;

alter table public.race_editions
  add column if not exists wildcard_closes_at timestamptz;

comment on column public.race_editions.wildcard_closes_at is
  'Date limite des demandes de Wild Card et instant de leur arbitrage (24 h avant le premier départ).';

-- Les courses Elite utilisent désormais le formulaire standard. Un trigger
-- transforme toutefois toute inscription non-Elite en demande en attente.
update public.race_editions as edition
set
  registration_policy = 'open',
  minimum_reputation = 0
from public.race_categories as category
where category.id = edition.race_category_id
  and category.code = 'elite';

update public.race_editions as edition
set wildcard_closes_at = first_stage.departure_at - interval '24 hours'
from (
  select
    stage.race_edition_id,
    min(
      coalesce(
        stage.departure_at,
        (
          day.calendar_date::timestamp
          + case stage.day_slot
              when 'early' then time '09:00'
              else time '15:00'
            end
        ) at time zone 'Europe/Paris'
      )
    ) as departure_at
  from public.stages as stage
  join public.season_days as day on day.id = stage.season_day_id
  group by stage.race_edition_id
) as first_stage
where first_stage.race_edition_id = edition.id
  and first_stage.departure_at is not null;

create or replace function public.configure_elite_race_edition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_category_code text;
begin
  select category.code
  into v_category_code
  from public.race_categories as category
  where category.id = new.race_category_id;

  if v_category_code = 'elite' then
    new.registration_policy := 'open';
    new.minimum_reputation := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists configure_elite_race_edition_trigger
  on public.race_editions;

create trigger configure_elite_race_edition_trigger
before insert or update of race_category_id, registration_policy, minimum_reputation
on public.race_editions
for each row
execute function public.configure_elite_race_edition();

create or replace function public.refresh_elite_wildcard_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edition_id uuid;
  v_category_code text;
  v_first_departure_at timestamptz;
begin
  if tg_op = 'DELETE' then
    v_edition_id := old.race_edition_id;
  else
    v_edition_id := new.race_edition_id;
  end if;

  select category.code
  into v_category_code
  from public.race_editions as edition
  join public.race_categories as category
    on category.id = edition.race_category_id
  where edition.id = v_edition_id;

  if v_category_code is distinct from 'elite' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select min(
    coalesce(
      stage.departure_at,
      (
        day.calendar_date::timestamp
        + case stage.day_slot
            when 'early' then time '09:00'
            else time '15:00'
          end
      ) at time zone 'Europe/Paris'
    )
  )
  into v_first_departure_at
  from public.stages as stage
  join public.season_days as day on day.id = stage.season_day_id
  where stage.race_edition_id = v_edition_id;

  update public.race_editions
  set wildcard_closes_at = v_first_departure_at - interval '24 hours'
  where id = v_edition_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_elite_wildcard_deadline_trigger
  on public.stages;

create trigger refresh_elite_wildcard_deadline_trigger
after insert or update of race_edition_id, season_day_id, departure_at, day_slot
or delete
on public.stages
for each row
execute function public.refresh_elite_wildcard_deadline();

-- Une inscription non-Elite à une course Elite devient une demande de Wild
-- Card. Les invitations décidées par l'arbitrage sont les seules à pouvoir
-- passer directement au statut accepté.
create or replace function public.route_elite_race_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_code text;
  v_division_code text;
  v_wildcard_closes_at timestamptz;
begin
  select
    category.code,
    division.code,
    edition.wildcard_closes_at
  into
    v_category_code,
    v_division_code,
    v_wildcard_closes_at
  from public.race_editions as edition
  join public.race_categories as category
    on category.id = edition.race_category_id
  join public.team_seasons as team_season
    on team_season.id = new.team_season_id
   and team_season.season_id = edition.season_id
  left join public.divisions as division
    on division.id = team_season.division_id
  where edition.id = new.race_edition_id;

  if v_category_code is distinct from 'elite' then
    return new;
  end if;

  if new.entry_method <> 'invited'
    and new.status in ('accepted', 'pending')
    and (
      v_wildcard_closes_at is null
      or now() >= v_wildcard_closes_at
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'Les inscriptions et demandes de Wild Card sont closes 24 heures avant le départ.';
  end if;

  if coalesce(v_division_code, 'amateur') <> 'elite'
    and new.entry_method <> 'invited'
    and new.status = 'accepted'
  then
    new.status := 'pending';
    new.entry_method := 'requested';
    new.decided_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists route_elite_race_registration_trigger
  on public.race_registrations;

create trigger route_elite_race_registration_trigger
before insert or update of status, entry_method, registered_at
on public.race_registrations
for each row
execute function public.route_elite_race_registration();

-- Les compositions en attente bloquent le coureur exactement comme une
-- inscription acceptée, y compris face à une requête concurrente.
create or replace function public.enforce_pending_race_roster_conflicts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target_edition_id uuid;
  v_conflicting_race_name text;
begin
  if new.status not in ('selected', 'confirmed') then
    return new;
  end if;

  select registration.race_edition_id
  into v_target_edition_id
  from public.race_registrations as registration
  where registration.id = new.race_registration_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.rider_id::text, 0)
  );

  select other_edition.display_name
  into v_conflicting_race_name
  from public.race_rosters as other_roster
  join public.race_registrations as other_registration
    on other_registration.id = other_roster.race_registration_id
   and other_registration.status in ('accepted', 'pending')
  join public.race_editions as other_edition
    on other_edition.id = other_registration.race_edition_id
   and other_edition.id <> v_target_edition_id
  where other_roster.rider_id = new.rider_id
    and other_roster.status in ('selected', 'confirmed')
    and exists (
      select 1
      from public.stages as target_stage
      join public.stages as other_stage
        on other_stage.season_day_id = target_stage.season_day_id
       and other_stage.race_edition_id = other_edition.id
      where target_stage.race_edition_id = v_target_edition_id
    )
  limit 1;

  if v_conflicting_race_name is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Ce coureur est déjà réservé pour %s sur le même créneau.',
        v_conflicting_race_name
      );
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_pending_race_roster_conflicts_trigger
  on public.race_rosters;

create trigger enforce_pending_race_roster_conflicts_trigger
before insert or update of rider_id, race_registration_id, status
on public.race_rosters
for each row
execute function public.enforce_pending_race_roster_conflicts();

-- Enrichit les disponibilités de composition sans remplacer les contrôles
-- médicaux et de reconnaissance déjà empilés par les migrations précédentes.
alter function public.get_current_team_race_roster_options(uuid)
  rename to get_current_team_race_roster_options_before_elite_wildcards;

revoke all
on function public.get_current_team_race_roster_options_before_elite_wildcards(uuid)
from public, anon, authenticated;

grant execute
on function public.get_current_team_race_roster_options_before_elite_wildcards(uuid)
to service_role;

create function public.get_current_team_race_roster_options(
  p_race_edition_id uuid
)
returns table (
  rider_id uuid,
  first_name text,
  last_name text,
  country_name text,
  country_iso_alpha2 text,
  avatar_profile_key text,
  avatar_seed bigint,
  age integer,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  is_selected boolean,
  is_available boolean,
  unavailability_type text,
  unavailability_label text,
  unavailable_until timestamptz,
  conflicting_race_slug text,
  conflicting_race_name text,
  conflicting_start_day integer,
  conflicting_end_day integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    option.rider_id,
    option.first_name,
    option.last_name,
    option.country_name,
    option.country_iso_alpha2,
    option.avatar_profile_key,
    option.avatar_seed,
    option.age,
    option.mountain,
    option.hills,
    option.flat,
    option.time_trial,
    option.cobbles,
    option.sprint,
    option.is_selected,
    option.is_available and pending_conflict.race_slug is null,
    case
      when option.is_available and pending_conflict.race_slug is not null
        then 'race'
      else option.unavailability_type
    end,
    case
      when option.is_available and pending_conflict.race_slug is not null
        then 'Wild Card en attente · ' || pending_conflict.race_name
      else option.unavailability_label
    end,
    option.unavailable_until,
    coalesce(option.conflicting_race_slug, pending_conflict.race_slug),
    coalesce(option.conflicting_race_name, pending_conflict.race_name),
    coalesce(option.conflicting_start_day, pending_conflict.start_day),
    coalesce(option.conflicting_end_day, pending_conflict.end_day)
  from public.get_current_team_race_roster_options_before_elite_wildcards(
    p_race_edition_id
  ) as option
  left join lateral (
    select
      race.slug as race_slug,
      other_edition.display_name as race_name,
      min(other_day.day_number)::integer as start_day,
      max(other_day.day_number)::integer as end_day
    from public.race_rosters as other_roster
    join public.race_registrations as other_registration
      on other_registration.id = other_roster.race_registration_id
     and other_registration.status = 'pending'
    join public.race_editions as other_edition
      on other_edition.id = other_registration.race_edition_id
     and other_edition.id <> p_race_edition_id
    join public.races as race on race.id = other_edition.race_id
    join public.stages as other_stage
      on other_stage.race_edition_id = other_edition.id
    join public.season_days as other_day
      on other_day.id = other_stage.season_day_id
    where other_roster.rider_id = option.rider_id
      and other_roster.status in ('selected', 'confirmed')
      and exists (
        select 1
        from public.stages as target_stage
        where target_stage.race_edition_id = p_race_edition_id
          and target_stage.season_day_id = other_stage.season_day_id
      )
    group by race.slug, other_edition.display_name
    order by min(other_day.day_number)
    limit 1
  ) as pending_conflict on true;
$$;

revoke all
on function public.get_current_team_race_roster_options(uuid)
from public, anon;

grant execute
on function public.get_current_team_race_roster_options(uuid)
to authenticated, service_role;

create table public.elite_wildcard_decisions (
  id uuid primary key default gen_random_uuid(),
  race_registration_id uuid not null unique
    references public.race_registrations(id)
    on delete cascade,
  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,
  decision text not null,
  team_country_match boolean not null default false,
  sponsor_country_match boolean not null default false,
  reputation_points integer not null default 0,
  best_rider_profile_fit numeric(6, 2) not null default 0,
  selection_score numeric(10, 2) not null default 0,
  title text not null,
  message text not null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint elite_wildcard_decisions_decision_allowed
    check (decision in ('accepted', 'rejected'))
);

create index elite_wildcard_decisions_team_season_idx
  on public.elite_wildcard_decisions (team_season_id, decided_at desc);

alter table public.elite_wildcard_decisions enable row level security;

create policy "Managers can read their Elite Wild Card decisions"
on public.elite_wildcard_decisions
for select
to authenticated
using (
  exists (
    select 1
    from public.team_seasons as team_season
    join public.team_manager_assignments as assignment
      on assignment.team_id = team_season.team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.auth_user_id = auth.uid()
    where team_season.id = elite_wildcard_decisions.team_season_id
  )
);

grant select on public.elite_wildcard_decisions to authenticated;
grant all privileges on public.elite_wildcard_decisions to service_role;

create or replace function public.withdraw_current_team_elite_wildcard_request(
  p_race_edition_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_id uuid;
  v_wildcard_closes_at timestamptz;
begin
  select
    registration.id,
    edition.wildcard_closes_at
  into
    v_registration_id,
    v_wildcard_closes_at
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.race_edition_id = p_race_edition_id
   and registration.status = 'pending'
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
   and edition.season_id = team_season.season_id
  where director.auth_user_id = auth.uid()
  for update of registration;

  if v_registration_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Aucune demande de Wild Card en attente ne peut être retirée.';
  end if;

  if v_wildcard_closes_at is null
    or now() >= v_wildcard_closes_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'La demande est déjà en cours d’arbitrage et ne peut plus être retirée.';
  end if;

  update public.race_rosters
  set status = 'withdrawn'
  where race_registration_id = v_registration_id
    and status in ('selected', 'confirmed');

  update public.race_registrations
  set
    status = 'withdrawn',
    decided_at = now()
  where id = v_registration_id;
end;
$$;

revoke all
on function public.withdraw_current_team_elite_wildcard_request(uuid)
from public, anon;

grant execute
on function public.withdraw_current_team_elite_wildcard_request(uuid)
to authenticated;

-- Arbitrage à J-1. Pondération explicite :
-- équipe locale 250, sponsor local 150, réputation 0,25/point,
-- meilleur coureur adapté au profil 5/point.
create or replace function public.settle_due_elite_wildcards()
returns table (
  processed_editions integer,
  accepted_requests integer,
  rejected_requests integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edition record;
  v_candidate record;
  v_available_places integer;
  v_rank integer;
  v_processed_editions integer := 0;
  v_accepted_requests integer := 0;
  v_rejected_requests integer := 0;
  v_decision text;
begin
  for v_edition in
    select
      edition.id,
      edition.display_name,
      edition.field_limit,
      edition.season_id,
      race.country_id as race_country_id
    from public.race_editions as edition
    join public.race_categories as category
      on category.id = edition.race_category_id
     and category.code = 'elite'
    join public.races as race on race.id = edition.race_id
    where edition.wildcard_closes_at is not null
      and edition.wildcard_closes_at <= now()
      and edition.status not in ('completed', 'cancelled')
      and exists (
        select 1
        from public.race_registrations as registration
        where registration.race_edition_id = edition.id
          and registration.status = 'pending'
      )
    order by edition.wildcard_closes_at, edition.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_edition.id::text, 0)
    );

    select least(
      4,
      greatest(
        coalesce(v_edition.field_limit, 24) - count(*)::integer,
        0
      )
    )
    into v_available_places
    from public.race_registrations as registration
    where registration.race_edition_id = v_edition.id
      and registration.status = 'accepted';

    v_rank := 0;

    for v_candidate in
      with scored_candidates as (
        select
          registration.id as registration_id,
          registration.team_season_id,
          registration.registered_at,
          team_season.registration_country_id = v_edition.race_country_id
            as team_country_match,
          coalesce(sponsor.country_id = v_edition.race_country_id, false)
            as sponsor_country_match,
          coalesce(director.reputation_points, 0)::integer
            as reputation_points,
          coalesce(performance.best_profile_fit, 0)::numeric(6, 2)
            as best_rider_profile_fit
        from public.race_registrations as registration
        join public.team_seasons as team_season
          on team_season.id = registration.team_season_id
        left join lateral (
          select sponsor_row.country_id
          from public.team_sponsor_contracts as contract
          join public.sponsors as sponsor_row
            on sponsor_row.id = contract.sponsor_id
          join public.seasons as current_season
            on current_season.id = v_edition.season_id
          join public.seasons as start_season
            on start_season.id = contract.start_season_id
           and start_season.game_year <= current_season.game_year
          join public.seasons as end_season
            on end_season.id = contract.end_season_id
           and end_season.game_year >= current_season.game_year
          where contract.team_id = team_season.team_id
            and contract.role = 'principal'
            and contract.status in ('active', 'planned')
          order by
            case contract.status when 'active' then 0 else 1 end,
            contract.created_at desc
          limit 1
        ) as sponsor on true
        left join lateral (
          select sporting_director.reputation_points
          from public.team_manager_assignments as assignment
          join public.sporting_directors as sporting_director
            on sporting_director.id = assignment.sporting_director_id
          where assignment.team_id = team_season.team_id
            and assignment.role = 'general_manager'
            and assignment.status = 'active'
          limit 1
        ) as director on true
        left join lateral (
          select max(rider_score.profile_fit) as best_profile_fit
          from (
            select
              roster.rider_id,
              avg(
                case stage.profile_type
                  when 'mountain' then rating.mountain
                  when 'hilly' then rating.hills
                  when 'cobbles' then rating.cobbles
                  when 'time_trial' then rating.time_trial
                  when 'sprint' then rating.sprint
                  when 'flat' then (rating.flat + rating.sprint) / 2.0
                  else (
                    rating.mountain
                    + rating.hills
                    + rating.flat
                    + rating.time_trial
                    + rating.cobbles
                    + rating.sprint
                  ) / 6.0
                end
              ) as profile_fit
            from public.race_rosters as roster
            join public.rider_season_ratings as rating
              on rating.rider_id = roster.rider_id
             and rating.season_id = v_edition.season_id
            cross join public.stages as stage
            where roster.race_registration_id = registration.id
              and roster.status in ('selected', 'confirmed')
              and stage.race_edition_id = v_edition.id
            group by roster.rider_id
          ) as rider_score
        ) as performance on true
        where registration.race_edition_id = v_edition.id
          and registration.status = 'pending'
      )
      select
        candidate.*,
        (
          case when candidate.team_country_match then 250 else 0 end
          + case when candidate.sponsor_country_match then 150 else 0 end
          + least(greatest(candidate.reputation_points, 0), 1000) * 0.25
          + candidate.best_rider_profile_fit * 5
        )::numeric(10, 2) as selection_score
      from scored_candidates as candidate
      order by
        selection_score desc,
        candidate.registered_at,
        candidate.registration_id
    loop
      v_rank := v_rank + 1;
      v_decision := case
        when v_rank <= v_available_places then 'accepted'
        else 'rejected'
      end;

      if v_decision = 'accepted' then
        update public.race_registrations
        set
          status = 'accepted',
          entry_method = 'invited',
          decided_at = now()
        where id = v_candidate.registration_id
          and status = 'pending';

        v_accepted_requests := v_accepted_requests + 1;
      else
        update public.race_registrations
        set
          status = 'rejected',
          decided_at = now()
        where id = v_candidate.registration_id
          and status = 'pending';

        update public.race_rosters
        set status = 'withdrawn'
        where race_registration_id = v_candidate.registration_id
          and status in ('selected', 'confirmed');

        v_rejected_requests := v_rejected_requests + 1;
      end if;

      insert into public.elite_wildcard_decisions (
        race_registration_id,
        race_edition_id,
        team_season_id,
        decision,
        team_country_match,
        sponsor_country_match,
        reputation_points,
        best_rider_profile_fit,
        selection_score,
        title,
        message,
        decided_at
      )
      values (
        v_candidate.registration_id,
        v_edition.id,
        v_candidate.team_season_id,
        v_decision,
        v_candidate.team_country_match,
        v_candidate.sponsor_country_match,
        v_candidate.reputation_points,
        v_candidate.best_rider_profile_fit,
        v_candidate.selection_score,
        'Réponse de l''organisateur : ' || v_edition.display_name,
        case v_decision
          when 'accepted' then 'Wild Card octroyée.'
          else 'Wild Card refusée. Les créneaux des coureurs proposés ont été libérés.'
        end,
        now()
      )
      on conflict (race_registration_id)
      do nothing;
    end loop;

    if v_rank > 0 then
      v_processed_editions := v_processed_editions + 1;
    end if;
  end loop;

  return query
  select
    v_processed_editions,
    v_accepted_requests,
    v_rejected_requests;
end;
$$;

revoke all
on function public.settle_due_elite_wildcards()
from public, anon;

grant execute
on function public.settle_due_elite_wildcards()
to authenticated, service_role;

comment on function public.settle_due_elite_wildcards() is
  'Arbitre à J-1 les demandes de Wild Card Elite selon la nationalité de l’équipe, celle du sponsor, la réputation et le meilleur coureur aligné pour le profil.';

commit;
