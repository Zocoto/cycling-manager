begin;

create or replace function public.is_rider_protected_by_stage_race_for_international_selection(
  p_rider_id uuid,
  p_target_race_edition_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.race_editions as target_edition
    join public.race_rosters as roster
      on roster.rider_id = p_rider_id
     and roster.status in ('selected', 'confirmed')
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = registration.race_edition_id
     and other_edition.id <> target_edition.id
     and other_edition.season_id = target_edition.season_id
    join public.races as other_race
      on other_race.id = other_edition.race_id
     and other_race.race_format = 'stage_race'
    where target_edition.id = p_target_race_edition_id
      and exists (
        select 1
        from public.stages as unfinished_stage
        where unfinished_stage.race_edition_id = other_edition.id
          and unfinished_stage.status <> 'completed'
      )
      and (
        other_edition.withdrawal_closes_at is null
        or other_edition.withdrawal_closes_at <= p_at
        or exists (
          select 1
          from public.stages as started_stage
          where started_stage.race_edition_id = other_edition.id
            and started_stage.departure_at is not null
            and started_stage.departure_at <= p_at
        )
      )
      and exists (
        select 1
        from public.stages as target_stage
        join public.stages as other_stage
          on other_stage.season_day_id = target_stage.season_day_id
         and other_stage.race_edition_id = other_edition.id
        where target_stage.race_edition_id = target_edition.id
      )
  );
$$;

revoke all
on function public.is_rider_protected_by_stage_race_for_international_selection(
  uuid,
  uuid,
  timestamptz
)
from public, anon, authenticated;

grant execute
on function public.is_rider_protected_by_stage_race_for_international_selection(
  uuid,
  uuid,
  timestamptz
)
to service_role;

create or replace function public.exclude_locked_stage_race_rider_from_international_selection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_race_edition_id uuid;
begin
  if new.response_status in (
    'declined',
    'ineligible_injury',
    'unavailable'
  ) then
    return new;
  end if;

  select selection.race_edition_id
  into v_target_race_edition_id
  from public.international_championship_nation_selections as selection
  where selection.id = new.nation_selection_id;

  if v_target_race_edition_id is not null
    and public.is_rider_protected_by_stage_race_for_international_selection(
      new.rider_id,
      v_target_race_edition_id,
      now()
    )
  then
    new.response_status := 'unavailable';
    new.is_selected := false;
  end if;

  return new;
end;
$$;

drop trigger if exists exclude_locked_stage_race_rider_from_international_selection
  on public.international_championship_rider_selections;

create trigger exclude_locked_stage_race_rider_from_international_selection
before insert or update of is_selected, response_status
on public.international_championship_rider_selections
for each row
execute function public.exclude_locked_stage_race_rider_from_international_selection();

-- Une convocation internationale peut prendre la priorite sur une course qui
-- n'a pas encore commence. En revanche, elle ne doit jamais modifier la
-- composition d'un tour dont au moins une etape a deja pris le depart.
--
-- La synchronisation de la selection tentera ensuite d'inscrire le coureur au
-- championnat. La contrainte de chevauchement le marquera indisponible et
-- appellera automatiquement le reserviste suivant, sans toucher au tour.
create or replace function public.prioritize_international_championship_rider_base(
  p_nation_selection_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection public.international_championship_nation_selections%rowtype;
  v_target_start_day integer;
  v_target_end_day integer;
  v_target_competition_type text;
  v_target_season_id uuid;
begin
  select selection.*
  into v_selection
  from public.international_championship_nation_selections as selection
  where selection.id = p_nation_selection_id;

  if not found then
    return;
  end if;

  select race.competition_type, edition.season_id
  into v_target_competition_type, v_target_season_id
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  where edition.id = v_selection.race_edition_id;

  select min(day.day_number), max(day.day_number)
  into v_target_start_day, v_target_end_day
  from public.stages as stage
  join public.season_days as day
    on day.id = stage.season_day_id
  where stage.race_edition_id = v_selection.race_edition_id;

  if public.is_rider_protected_by_stage_race_for_international_selection(
    p_rider_id,
    v_selection.race_edition_id,
    now()
  ) then
    return;
  end if;

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.race_editions as other_edition,
       public.races as other_race
  where registration.id = roster.race_registration_id
    and other_edition.id = registration.race_edition_id
    and other_race.id = other_edition.race_id
    and roster.rider_id = p_rider_id
    and roster.status in ('selected', 'confirmed')
    and registration.status = 'accepted'
    and other_edition.id <> v_selection.race_edition_id
    and not (
      v_target_competition_type = 'world_championship'
      and other_race.competition_type = 'world_championship'
    )
    and exists (
      select 1
      from public.stages as other_stage
      join public.season_days as other_day
        on other_day.id = other_stage.season_day_id
      where other_stage.race_edition_id = other_edition.id
        and other_day.day_number between v_target_start_day and v_target_end_day
        and other_day.season_id = v_target_season_id
    );

  update public.race_registrations as registration
  set
    status = 'withdrawn',
    decided_at = now()
  where registration.race_edition_id <> v_selection.race_edition_id
    and registration.status = 'accepted'
    and exists (
      select 1
      from public.race_rosters as affected_roster
      where affected_roster.race_registration_id = registration.id
        and affected_roster.rider_id = p_rider_id
        and affected_roster.status = 'withdrawn'
    )
    and not exists (
      select 1
      from public.race_rosters as roster
      where roster.race_registration_id = registration.id
        and roster.status in ('selected', 'confirmed')
    );

  update public.rider_form_camps as camp
  set
    status = 'cancelled',
    completed_at = now()
  where camp.rider_id = p_rider_id
    and camp.status in ('planned', 'active')
    and camp.start_day_number <= v_target_end_day
    and camp.end_day_number >= v_target_start_day
    and camp.season_id = v_target_season_id;
end;
$$;

revoke all
on function public.prioritize_international_championship_rider_base(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.prioritize_international_championship_rider_base(uuid, uuid)
to service_role;

comment on function public.prioritize_international_championship_rider_base(uuid, uuid)
is 'Priorise une selection internationale sans jamais retirer un coureur d un tour deja commence ou verrouille.';

create table public.international_selection_dispatch_pauses (
  race_edition_id uuid primary key
    references public.race_editions(id) on delete cascade,
  reason text not null,
  paused_at timestamptz not null default now(),
  released_at timestamptz,
  constraint international_selection_dispatch_pause_reason_present
    check (btrim(reason) <> ''),
  constraint international_selection_dispatch_pause_release_order
    check (released_at is null or released_at >= paused_at)
);

alter table public.international_selection_dispatch_pauses
  enable row level security;

grant all privileges
on table public.international_selection_dispatch_pauses
to service_role;

-- Une candidature en attente est uniquement une convocation. L'autre course
-- n'est retirée et la startlist internationale n'est créée qu'après une
-- confirmation explicite du DS (ou une finalisation sans conflit).
create or replace function public.sync_international_championship_lineup(
  p_nation_selection_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection public.international_championship_nation_selections%rowtype;
  v_candidate record;
  v_team_season_id uuid;
  v_registration_id uuid;
begin
  select selection.*
  into v_selection
  from public.international_championship_nation_selections as selection
  where selection.id = p_nation_selection_id
  for update;

  if not found then
    return;
  end if;

  if exists (
    select 1
    from public.international_selection_dispatch_pauses as pause
    where pause.race_edition_id = v_selection.race_edition_id
      and pause.released_at is null
  ) then
    update public.international_championship_rider_selections as candidate
    set is_selected = false
    where candidate.nation_selection_id = v_selection.id
      and candidate.is_selected = true;

    update public.race_rosters as roster
    set status = 'withdrawn'
    from public.race_registrations as registration
    where registration.id = roster.race_registration_id
      and registration.race_edition_id = v_selection.race_edition_id
      and roster.status in ('selected', 'confirmed');

    update public.race_registrations as registration
    set
      status = 'withdrawn',
      decided_at = now()
    where registration.race_edition_id = v_selection.race_edition_id
      and registration.entry_method = 'automatic'
      and registration.status = 'accepted';

    return;
  end if;

  with eligible as (
    select
      candidate.id,
      row_number() over (
        order by candidate.rider_rank, candidate.rider_id
      ) as eligible_rank
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.response_status not in (
        'declined',
        'ineligible_injury',
        'unavailable'
      )
  )
  update public.international_championship_rider_selections as candidate
  set
    is_selected = coalesce(eligible.eligible_rank <= 8, false),
    selected_at = case
      when eligible.eligible_rank <= 8
        then coalesce(candidate.selected_at, now())
      else candidate.selected_at
    end
  from eligible
  where candidate.id = eligible.id;

  update public.international_championship_rider_selections as candidate
  set is_selected = false
  where candidate.nation_selection_id = v_selection.id
    and candidate.response_status in (
      'declined',
      'ineligible_injury',
      'unavailable'
    );

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.international_championship_rider_selections as candidate
  where registration.id = roster.race_registration_id
    and registration.race_edition_id = v_selection.race_edition_id
    and candidate.nation_selection_id = v_selection.id
    and candidate.rider_id = roster.rider_id
    and (
      candidate.is_selected = false
      or candidate.response_status = 'pending'
    )
    and roster.status in ('selected', 'confirmed');

  for v_candidate in
    select candidate.*
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.is_selected = true
    order by candidate.rider_rank
  loop
    -- Le DS n'a encore rien validé : aucune autre inscription ne bouge.
    if v_candidate.response_status = 'pending' then
      continue;
    end if;

    select team_season.id
    into v_team_season_id
    from public.race_editions as edition
    join public.team_seasons as team_season
      on team_season.season_id = edition.season_id
     and team_season.team_id = v_candidate.team_id
     and team_season.status in ('planned', 'active')
    where edition.id = v_selection.race_edition_id
    limit 1;

    if v_team_season_id is null then
      update public.international_championship_rider_selections
      set
        response_status = 'unavailable',
        is_selected = false
      where id = v_candidate.id;
      continue;
    end if;

    begin
      perform public.prioritize_international_championship_rider(
        v_selection.id,
        v_candidate.rider_id
      );

      insert into public.race_registrations (
        race_edition_id,
        team_season_id,
        entry_method,
        status,
        registered_at,
        decided_at
      )
      values (
        v_selection.race_edition_id,
        v_team_season_id,
        'automatic',
        'accepted',
        now(),
        now()
      )
      on conflict (race_edition_id, team_season_id)
      do update set
        entry_method = 'automatic',
        status = 'accepted',
        registered_at = coalesce(
          public.race_registrations.registered_at,
          excluded.registered_at
        ),
        decided_at = excluded.decided_at
      returning id into v_registration_id;

      insert into public.race_rosters (
        race_registration_id,
        rider_id,
        race_role,
        status,
        selected_at
      )
      values (
        v_registration_id,
        v_candidate.rider_id,
        'auto',
        'confirmed',
        now()
      )
      on conflict (race_registration_id, rider_id)
      do update set
        race_role = 'auto',
        status = 'confirmed',
        selected_at = excluded.selected_at;
    exception
      when sqlstate 'P0001' then
        update public.international_championship_rider_selections
        set
          response_status = case
            when position('bless' in lower(sqlerrm)) > 0
              then 'ineligible_injury'
            else 'unavailable'
          end,
          is_selected = false
        where id = v_candidate.id;
    end;
  end loop;

  update public.race_registrations as registration
  set
    status = 'withdrawn',
    decided_at = now()
  where registration.race_edition_id = v_selection.race_edition_id
    and registration.entry_method = 'automatic'
    and not exists (
      select 1
      from public.race_rosters as roster
      where roster.race_registration_id = registration.id
        and roster.status in ('selected', 'confirmed')
    );

  if (
    select count(*)
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.is_selected = true
  ) < 8 and exists (
    select 1
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.is_selected = false
      and candidate.response_status not in (
        'declined',
        'ineligible_injury',
        'unavailable'
      )
  ) then
    perform public.sync_international_championship_lineup(v_selection.id);
  end if;
end;
$$;

revoke all
on function public.sync_international_championship_lineup(uuid)
from public, anon, authenticated;

grant execute
on function public.sync_international_championship_lineup(uuid)
to service_role;

drop function if exists public.get_international_championship_selections_for_auth_user(uuid);

create function public.get_international_championship_selections_for_auth_user(
  p_auth_user_id uuid
)
returns table (
  candidate_id uuid,
  rider_id uuid,
  rider_name text,
  rider_rank integer,
  uci_points integer,
  overall_rating numeric,
  response_status text,
  is_selected boolean,
  was_selected boolean,
  responded_at timestamptz,
  country_name text,
  country_code text,
  nation_rank integer,
  continent_code text,
  championship_name text,
  championship_slug text,
  competition_type text,
  race_edition_id uuid,
  day_number integer,
  departure_at timestamptz,
  conflicting_race_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate.id as candidate_id,
    candidate.rider_id,
    concat_ws(' ', rider.first_name, rider.last_name) as rider_name,
    candidate.rider_rank,
    candidate.uci_points,
    candidate.overall_rating,
    candidate.response_status,
    candidate.is_selected,
    candidate.selected_at is not null as was_selected,
    candidate.responded_at,
    country.name as country_name,
    country.iso_alpha2 as country_code,
    selection.nation_rank::integer,
    selection.continent_code,
    edition.display_name as championship_name,
    race.slug as championship_slug,
    race.competition_type,
    edition.id as race_edition_id,
    first_stage.day_number,
    first_stage.departure_at,
    coalesce(conflicts.race_names, array[]::text[])
      as conflicting_race_names
  from public.sporting_directors as director
  join public.international_championship_rider_selections as candidate
    on candidate.sporting_director_id = director.id
  join public.international_championship_nation_selections as selection
    on selection.id = candidate.nation_selection_id
  join public.riders as rider
    on rider.id = candidate.rider_id
  join public.countries as country
    on country.id = selection.country_id
  join public.race_editions as edition
    on edition.id = selection.race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in (
     'continental_championship',
     'world_championship'
   )
  join lateral (
    select
      day.day_number::integer as day_number,
      stage.departure_at
    from public.stages as stage
    join public.season_days as day
      on day.id = stage.season_day_id
    where stage.race_edition_id = edition.id
      and stage.departure_at is not null
    order by stage.departure_at, stage.stage_number
    limit 1
  ) as first_stage on true
  left join lateral (
    select array_agg(
      distinct other_edition.display_name
      order by other_edition.display_name
    ) as race_names
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = registration.race_edition_id
     and other_edition.id <> edition.id
     and other_edition.season_id = edition.season_id
    join public.races as other_race
      on other_race.id = other_edition.race_id
    where roster.rider_id = candidate.rider_id
      and roster.status in ('selected', 'confirmed')
      and not (
        (
          race.competition_type = 'world_championship'
          and other_race.competition_type = 'world_championship'
        )
        or (
          race.competition_type = 'continental_championship'
          and other_race.competition_type = 'continental_championship'
          and other_race.championship_continent_code =
            race.championship_continent_code
        )
      )
      and exists (
        select 1
        from public.stages as target_stage
        join public.stages as other_stage
          on other_stage.season_day_id = target_stage.season_day_id
         and other_stage.race_edition_id = other_edition.id
        where target_stage.race_edition_id = edition.id
      )
  ) as conflicts on true
  where director.auth_user_id = p_auth_user_id
    and director.status = 'active'
    and (
      candidate.is_selected
      or candidate.selected_at is not null
      or candidate.response_status in (
        'confirmed',
        'automatic',
        'declined'
      )
    )
  order by
    first_stage.departure_at,
    candidate.rider_rank,
    rider.last_name,
    rider.first_name;
$$;

revoke all
on function public.get_international_championship_selections_for_auth_user(uuid)
from public, anon, authenticated;

grant execute
on function public.get_international_championship_selections_for_auth_user(uuid)
to service_role;

create or replace function public.sync_director_international_selection_message(
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type,
    sender_name, subject, preview, body, action_href, action_label,
    source_reference, is_important, sent_at
  )
  select
    candidate.sporting_director_id,
    edition.season_id,
    team_season.id,
    'international_selection',
    'Sélection nationale',
    concat_ws(' ', rider.first_name, rider.last_name) || ' appelé en sélection',
    edition.display_name || ' · ' || country.name,
    format(
      '%s est retenu avec %s pour %s. Vous pouvez confirmer sa priorité ou le retirer avant la clôture de la sélection.',
      concat_ws(' ', rider.first_name, rider.last_name),
      country.name,
      edition.display_name
    ) || case
      when cardinality(coalesce(conflicts.race_names, array[]::text[])) = 1
        then E'\n\nSi vous acceptez la convocation, votre coureur sera désinscrit de la course '
          || conflicts.race_names[1] || '.'
      when cardinality(coalesce(conflicts.race_names, array[]::text[])) > 1
        then E'\n\nSi vous acceptez la convocation, votre coureur sera désinscrit des courses '
          || array_to_string(conflicts.race_names, ', ') || '.'
      else ''
    end,
    '/jeu/selections-internationales#selection-' || candidate.id,
    'Répondre à la sélection',
    'international-selection:' || candidate.id,
    candidate.response_status = 'pending',
    coalesce(candidate.selected_at, candidate.created_at)
  from public.international_championship_rider_selections as candidate
  join public.international_championship_nation_selections as nation_selection
    on nation_selection.id = candidate.nation_selection_id
  join public.race_editions as edition
    on edition.id = nation_selection.race_edition_id
  join public.races as race on race.id = edition.race_id
  join public.countries as country on country.id = nation_selection.country_id
  join public.riders as rider on rider.id = candidate.rider_id
  left join public.team_seasons as team_season
    on team_season.team_id = candidate.team_id
   and team_season.season_id = edition.season_id
  left join lateral (
    select array_agg(
      distinct other_edition.display_name
      order by other_edition.display_name
    ) as race_names
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = registration.race_edition_id
     and other_edition.id <> edition.id
     and other_edition.season_id = edition.season_id
    join public.races as other_race
      on other_race.id = other_edition.race_id
    where roster.rider_id = candidate.rider_id
      and roster.status in ('selected', 'confirmed')
      and not (
        (
          race.competition_type = 'world_championship'
          and other_race.competition_type = 'world_championship'
        )
        or (
          race.competition_type = 'continental_championship'
          and other_race.competition_type = 'continental_championship'
          and other_race.championship_continent_code =
            race.championship_continent_code
        )
      )
      and exists (
        select 1
        from public.stages as target_stage
        join public.stages as other_stage
          on other_stage.season_day_id = target_stage.season_day_id
         and other_stage.race_edition_id = other_edition.id
        where target_stage.race_edition_id = edition.id
      )
  ) as conflicts on true
  where candidate.id = p_candidate_id
    and candidate.sporting_director_id is not null
    and candidate.is_selected = true
    and candidate.response_status in ('pending', 'confirmed', 'automatic')
  on conflict (sporting_director_id, source_reference)
  do update set
    subject = excluded.subject,
    preview = excluded.preview,
    body = excluded.body,
    is_important = excluded.is_important;
end;
$$;

revoke all
on function public.sync_director_international_selection_message(uuid)
from public, anon, authenticated;

grant execute
on function public.sync_director_international_selection_message(uuid)
to service_role;

-- Chaque objet correctif possède sa propre source afin qu'il ne puisse être
-- distribué qu'une fois et qu'il reste identifiable dans l'inventaire.
create table public.international_selection_compensation_grants (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  season_id uuid not null
    references public.seasons(id) on delete cascade,
  reward_key text not null
    references public.daily_reward_catalog(reward_key) on delete restrict,
  affected_races text[] not null,
  affected_rider_count smallint not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint international_selection_compensation_incident_present
    check (btrim(incident_key) <> ''),
  constraint international_selection_compensation_races_present
    check (cardinality(affected_races) > 0),
  constraint international_selection_compensation_riders_positive
    check (affected_rider_count > 0),
  constraint international_selection_compensation_reason_present
    check (btrim(reason) <> ''),
  constraint international_selection_compensation_once
    unique (incident_key, sporting_director_id)
);

alter table public.international_selection_compensation_grants
  enable row level security;

grant all privileges
on table public.international_selection_compensation_grants
to service_role;

alter table public.daily_reward_inventory
  add column source_international_selection_compensation_id uuid unique
    references public.international_selection_compensation_grants(id)
    on delete cascade;

alter table public.daily_reward_inventory
  drop constraint daily_reward_inventory_exactly_one_source;

alter table public.daily_reward_inventory
  add constraint daily_reward_inventory_exactly_one_source
  check (
    num_nonnulls(
      source_claim_id,
      source_referral_reward_id,
      source_auction_compensation_id,
      source_longevity_trophy_reward_id,
      source_international_selection_compensation_id
    ) = 1
  );

do $compensation$
declare
  v_incident_key constant text :=
    'international-selection-stage-race-withdrawals-2026-09-03';
  v_season_id constant uuid := 'afa6551b-3bb4-41a2-b394-0302f4275623';
  v_season public.seasons%rowtype;
  v_affected record;
  v_reward record;
  v_grant_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_incident_key, 0)
  );

  select *
  into v_season
  from public.seasons
  where id = v_season_id;

  -- Une base neuve ne contient pas l'incident de production.
  if v_season.id is null then
    return;
  end if;

  for v_affected in
    select *
    from (
      values
        ('8045390d-3d40-4fc3-86fc-e343e9294d23'::uuid, '2b9d32d5-8ce5-4810-82f3-c185b4e2ce18'::uuid, '34026dd0-77b0-46d8-94ba-fd3256c8df79'::uuid, array['Tour des Highlands de Donegal']::text[], 4::smallint),
        ('f1437c24-ad40-44e4-b508-f08d610a3a9d'::uuid, '998ef037-d665-48c1-97bd-6577c5291566'::uuid, 'a81d26fc-5b1f-4267-8c60-073d53389733'::uuid, array['Ruta de las Sierras']::text[], 7::smallint),
        ('629a811f-c275-4716-a762-8a305a1b27f4'::uuid, 'd4e6be5f-7f09-4e7a-a91b-9f0ec0f6a917'::uuid, '89df3cc9-9e81-4c36-8882-c19abb49ea0e'::uuid, array['Mekong Delta Tour', 'Ruta de las Sierras']::text[], 8::smallint),
        ('42ee1bb6-94fb-4b0b-9bfc-9f2f0defc539'::uuid, '34ba6845-5c19-4a97-81d9-00a99ef53a49'::uuid, '20bcbcf8-7f09-42b7-b4be-ce77d4aade10'::uuid, array['Mekong Delta Tour', 'Ruta de las Sierras']::text[], 10::smallint),
        ('3ee368f5-4524-4709-997e-4c3449f3aafd'::uuid, 'c67bc13d-0237-46f0-b383-dfefded651a8'::uuid, 'f2ffb52a-8a36-401d-90a9-ca5270cc8252'::uuid, array['Tour des Highlands de Donegal']::text[], 4::smallint),
        ('64ff2464-c0bd-48c0-b39a-04a600495a76'::uuid, '91217d04-32ab-4244-bb58-f7bc67aaaa8e'::uuid, 'caea0559-e3a6-408b-9e2f-4a7755859dd6'::uuid, array['Mekong Delta Tour']::text[], 4::smallint),
        ('10f97ecf-bac0-4f58-a6be-8c5fd94be4e0'::uuid, '4bc8fd54-9be2-4e00-b9d1-93a1a77685e5'::uuid, 'b6932cdd-3ad3-4475-9509-080c35694f2d'::uuid, array['Ruta de las Sierras']::text[], 3::smallint),
        ('0bde68e3-188d-4ad4-aa1b-a2483684bbf1'::uuid, '17936d7c-0c3c-44a6-a2fc-874abba700da'::uuid, '72c9694f-64d0-491e-a79c-68f655ae6a36'::uuid, array['Ruta de las Sierras']::text[], 8::smallint),
        ('85d06bd7-9ffa-4f56-a604-3a97d4a8dfdc'::uuid, '474a7d8b-cd45-44f7-83b3-10524e61ec0a'::uuid, '7ba5ff3b-d8cf-46ac-b82b-a53b34fed827'::uuid, array['Mekong Delta Tour', 'Ruta de las Sierras']::text[], 8::smallint),
        ('15d73cc5-aaca-4307-ac57-9d59252840e1'::uuid, '80ddf531-6037-489b-82f1-bf96e0cc2178'::uuid, '6a925b45-2838-466b-8cea-a76f3b3b0582'::uuid, array['Tour des Highlands de Donegal', 'Ruta de las Sierras']::text[], 10::smallint),
        ('69334b61-e63a-49fd-8eb6-1ed901c5ec98'::uuid, 'ab36ac83-e940-4860-93c3-720ab18a1cf9'::uuid, 'c9db310c-1a90-4df5-9f78-fd48c8147425'::uuid, array['Ruta de las Sierras']::text[], 8::smallint),
        ('ab81ed03-8dc3-4651-8ddb-a5f8dede37d9'::uuid, 'c52679ed-f95b-4120-a74b-bb7e6898e0ba'::uuid, '088a7b6b-a8cf-4545-b08b-4bff6c42b476'::uuid, array['Mekong Delta Tour']::text[], 5::smallint),
        ('a3f6c191-e2de-4670-bb61-5b73bb1ab60b'::uuid, '3ecb493e-f0b3-4365-9a52-ec6bdedeaaab'::uuid, 'ac3691bf-5539-4243-b0f1-69385f340391'::uuid, array['Ruta de las Sierras', 'Mekong Delta Tour']::text[], 8::smallint),
        ('d7ec0ccf-bcb4-4802-8a14-b458eccf41d7'::uuid, 'b507d5b6-d108-44c8-b5c2-df5a0452697e'::uuid, '803e9755-570b-48ba-9b2d-6bbf5d8312d4'::uuid, array['Tour des Highlands de Donegal']::text[], 5::smallint),
        ('4d6b6328-62d9-4288-a156-7e472603e770'::uuid, '2230ae8d-167a-495f-96ef-9a6f492fbbfd'::uuid, 'ad506cc8-91ff-4306-a30f-b1397e2154a5'::uuid, array['Ruta de las Sierras']::text[], 3::smallint),
        ('c625f372-5109-4862-bb58-2c653d122ac8'::uuid, 'c7e12154-b76a-41cf-8ce3-f0c93b0cc41c'::uuid, '122268e1-66f1-41a6-9b89-1b351f515980'::uuid, array['Tour des Highlands de Donegal']::text[], 2::smallint),
        ('5de1112e-ee6d-4ff1-b004-5f91f6f0646f'::uuid, 'e7c85ae9-4166-4e40-b8e0-a30cdc1c6be1'::uuid, '12277621-b716-4b0c-934a-f1a0b52364ba'::uuid, array['Ruta de las Sierras', 'Mekong Delta Tour']::text[], 8::smallint),
        ('2ac12cfa-b9a5-43ea-bf34-3685e07e0d89'::uuid, 'e7c506b6-a822-4524-8660-1e27c96a50e9'::uuid, '35061203-aa19-4986-83e1-b227cea4ecb5'::uuid, array['Ruta de las Sierras', 'Mekong Delta Tour']::text[], 15::smallint),
        ('9ff6eb03-a403-4247-962c-c84e439240b1'::uuid, 'd56458cb-646e-441b-896a-d15a463b9ba6'::uuid, 'e46bf500-2656-4c5c-85df-57daa6814b96'::uuid, array['Tour des Highlands de Donegal']::text[], 4::smallint),
        ('ef327a08-1a11-4a98-8c9b-c0d9612658af'::uuid, '0a17038e-f0fd-405d-9908-8570d3857f14'::uuid, 'de60b8f0-c3c7-4f8e-bd85-305439b1a482'::uuid, array['Tour des Highlands de Donegal']::text[], 2::smallint),
        ('db546d97-f666-4016-a669-2f2ec0dd1882'::uuid, '868ed801-d0fa-4e54-8fc3-f45a09363bf4'::uuid, 'b5fd7b9a-a254-4e41-9428-3cd1b2bf90fc'::uuid, array['Ruta de las Sierras']::text[], 7::smallint),
        ('68ac37d2-0f42-4601-b892-d6661bd26f1d'::uuid, 'd396650e-abac-4d27-804c-d667ddad0ce9'::uuid, 'ac9c6a66-e4ee-404e-bf9d-0665a6515640'::uuid, array['Ruta de las Sierras']::text[], 2::smallint),
        ('c7a945b1-a041-4352-9de3-ded911af3bf5'::uuid, '94020c1b-90d9-428f-ab10-6974c25e81ae'::uuid, '47b451ce-5f82-48ab-90c1-255b0b5e4c3c'::uuid, array['Ruta de las Sierras']::text[], 7::smallint),
        ('0904e419-8bb7-4460-be71-694f640455ce'::uuid, '392d4ba1-ae7a-4e9b-893c-415732289f01'::uuid, '0ceb562b-737c-4650-8e70-5570a915dc41'::uuid, array['Tour des Highlands de Donegal']::text[], 3::smallint),
        ('96fb299f-20bc-438c-a229-f9f7a421fe0e'::uuid, 'ff0b8e4e-38bc-4d5d-a11d-b9f2896ebe7c'::uuid, '69b20e97-b88b-4c8c-b98b-b0fd28939913'::uuid, array['Tour des Highlands de Donegal']::text[], 4::smallint),
        ('c9cc519e-a13c-4151-9eea-0e5f3f0e7ec7'::uuid, 'a9975f33-bd07-4d1e-b325-e1a51d282404'::uuid, 'cb8d8f3b-65c7-44c5-a3f6-8bf108a4bf2e'::uuid, array['Tour des Highlands de Donegal']::text[], 2::smallint),
        ('8406962e-41b9-4181-a372-3d57043de3a8'::uuid, 'cef2353a-4b38-4964-acde-50a461adcc98'::uuid, '27948dd4-0dac-416d-8f6c-118771bcb6eb'::uuid, array['Tour des Highlands de Donegal']::text[], 4::smallint),
        ('ad790479-dd78-4fe9-a1dc-0648e4bf439d'::uuid, 'a7e3c073-5dc0-4648-ad33-59d1421f31e7'::uuid, 'ca664ee5-06fd-4521-862e-ec20007709ab'::uuid, array['Tour des Highlands de Donegal']::text[], 2::smallint),
        ('3161715a-ad6a-4335-b820-45fc1969a849'::uuid, '723b9ec1-a8bc-42e8-bb0e-e3dc5e7003de'::uuid, 'f2e292c0-0c9e-41a2-8cd8-ed2a6bf83b57'::uuid, array['Ruta de las Sierras']::text[], 6::smallint),
        ('f7b49760-7e4f-45e3-9dc1-7654ee755746'::uuid, '47ec32c5-09e0-47f4-acc5-a16eb1cdb6a1'::uuid, 'bb7c87bd-a474-4260-8f85-f349849683f3'::uuid, array['Ruta de las Sierras']::text[], 2::smallint)
    ) as affected(
      sporting_director_id,
      team_season_id,
      team_id,
      affected_races,
      affected_rider_count
    )
    where false
  loop
    if not exists (
      select 1
      from public.sporting_directors as director
      join public.team_manager_assignments as assignment
        on assignment.sporting_director_id = director.id
       and assignment.team_id = v_affected.team_id
       and assignment.role = 'general_manager'
       and assignment.status = 'active'
      join public.team_seasons as team_season
        on team_season.id = v_affected.team_season_id
       and team_season.team_id = v_affected.team_id
       and team_season.season_id = v_season_id
      where director.id = v_affected.sporting_director_id
        and director.auth_user_id is not null
        and director.status = 'active'
        and not exists (
          select 1
          from public.alpha_bot_managers as bot
          where bot.sporting_director_id = director.id
        )
    ) then
      raise exception
        'Le contexte actif du DS compensé % est introuvable.',
        v_affected.sporting_director_id;
    end if;

    select catalog.reward_key, catalog.name, catalog.importance
    into v_reward
    from public.daily_reward_catalog as catalog
    where catalog.is_active
      and catalog.importance = 8
    order by md5(
      catalog.reward_key || v_incident_key
        || v_affected.sporting_director_id::text
    )
    limit 1;

    if v_reward.reward_key is null then
      raise exception 'Aucun cadeau actif de niveau 8 n’est disponible.';
    end if;

    insert into public.international_selection_compensation_grants (
      incident_key,
      sporting_director_id,
      team_season_id,
      season_id,
      reward_key,
      affected_races,
      affected_rider_count,
      reason
    ) values (
      v_incident_key,
      v_affected.sporting_director_id,
      v_affected.team_season_id,
      v_season_id,
      v_reward.reward_key,
      v_affected.affected_races,
      v_affected.affected_rider_count,
      'Compensation pour le retrait incorrect de coureurs inscrits sur un tour verrouillé ou déjà commencé.'
    )
    on conflict (incident_key, sporting_director_id) do nothing
    returning id into v_grant_id;

    if v_grant_id is null then
      select grant_row.id, catalog.reward_key, catalog.name, catalog.importance
      into v_grant_id, v_reward.reward_key, v_reward.name, v_reward.importance
      from public.international_selection_compensation_grants as grant_row
      join public.daily_reward_catalog as catalog
        on catalog.reward_key = grant_row.reward_key
      where grant_row.incident_key = v_incident_key
        and grant_row.sporting_director_id =
          v_affected.sporting_director_id;
    end if;

    insert into public.daily_reward_inventory (
      sporting_director_id,
      team_season_id,
      source_international_selection_compensation_id,
      reward_key,
      expires_after_game_year
    )
    select
      v_affected.sporting_director_id,
      v_affected.team_season_id,
      v_grant_id,
      v_reward.reward_key,
      v_season.game_year + 1
    where not exists (
      select 1
      from public.daily_reward_inventory as inventory
      where inventory.source_international_selection_compensation_id =
        v_grant_id
    );

    insert into public.sporting_director_messages (
      sporting_director_id,
      season_id,
      team_season_id,
      message_type,
      sender_name,
      subject,
      preview,
      body,
      action_href,
      action_label,
      source_reference,
      is_important
    ) values (
      v_affected.sporting_director_id,
      v_season_id,
      v_affected.team_season_id,
      'system',
      'Direction de Cyclo Stratège',
      'Nos excuses · convocations continentales',
      'Un objet de niveau 8 vous a été attribué après l’incident des tours en cours.',
      format(
        E'Une anomalie survenue lors de la préparation des sélections continentales du 3 septembre 2026 a retiré %s de vos coureurs de %s alors que la composition n’était plus modifiable. Nous vous présentons nos excuses.\n\nLa règle a été corrigée : une convocation internationale ne pourra plus écarter un coureur d’un tour déjà commencé ou verrouillé.\n\nEn compensation, vous recevez un objet de niveau 8 : « %s ». Il est disponible dans votre inventaire.',
        v_affected.affected_rider_count,
        array_to_string(v_affected.affected_races, ', '),
        v_reward.name
      ),
      '/jeu/inventaire',
      'Voir mon objet',
      'international-selection-tour-correction:2026-09-03',
      true
    )
    on conflict (sporting_director_id, source_reference) do nothing;

    v_grant_id := null;
  end loop;
end;
$compensation$;

alter table public.daily_reward_inventory
  drop constraint daily_reward_inventory_exactly_one_source;

alter table public.daily_reward_inventory
  drop column source_international_selection_compensation_id;

drop table public.international_selection_compensation_grants;

alter table public.daily_reward_inventory
  add constraint daily_reward_inventory_exactly_one_source
  check (
    num_nonnulls(
      source_claim_id,
      source_referral_reward_id,
      source_auction_compensation_id,
      source_longevity_trophy_reward_id
    ) = 1
  );

-- Rollback curatif demandé le 3 septembre : les convocations automatiques de
-- 12:10:18 UTC ont retiré 165 coureurs de trois tours dont la composition
-- était déjà verrouillée. Cette table conserve l'état exact réparé.
create table public.international_selection_stage_race_repairs (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null,
  candidate_id uuid not null unique
    references public.international_championship_rider_selections(id)
    on delete restrict,
  nation_selection_id uuid not null
    references public.international_championship_nation_selections(id)
    on delete restrict,
  race_roster_id uuid not null unique
    references public.race_rosters(id) on delete restrict,
  race_registration_id uuid not null
    references public.race_registrations(id) on delete restrict,
  race_edition_id uuid not null
    references public.race_editions(id) on delete restrict,
  rider_id uuid not null references public.riders(id) on delete restrict,
  sporting_director_id uuid
    references public.sporting_directors(id) on delete set null,
  previous_roster_status text not null,
  restore_authorized boolean not null default true,
  repaired_at timestamptz not null default now(),
  constraint international_selection_stage_race_repairs_incident_present
    check (btrim(incident_key) <> ''),
  constraint international_selection_stage_race_repairs_once
    unique (incident_key, race_roster_id)
);

alter table public.international_selection_stage_race_repairs
  enable row level security;

grant all privileges
on table public.international_selection_stage_race_repairs
to service_role;

-- Le rollback doit pouvoir restaurer une composition qui avait déjà été
-- validée, même si un stage de forme ou une blessure existe désormais sur le
-- même créneau. L'exception est limitée à une ligne d'audit explicite, au
-- passage withdrawn -> confirmed, et elle est consommée dans le même DO.
create or replace function public.enforce_rider_health_availability_on_roster()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_edition_id uuid;
  v_camp_type text;
begin
  if tg_op = 'UPDATE'
    and old.status = 'withdrawn'
    and new.status = 'confirmed'
    and exists (
      select 1
      from public.international_selection_stage_race_repairs as repair
      where repair.race_roster_id = new.id
        and repair.incident_key =
          'international-selection-stage-race-withdrawals-2026-09-03'
        and repair.restore_authorized = true
    )
  then
    return new;
  end if;

  if new.status not in ('selected', 'confirmed') then
    return new;
  end if;

  select registration.race_edition_id
  into v_edition_id
  from public.race_registrations as registration
  where registration.id = new.race_registration_id;

  if exists (
    select 1
    from public.rider_injuries as injury
    join public.stages as stage on stage.race_edition_id = v_edition_id
    join public.season_days as day on day.id = stage.season_day_id
    where injury.rider_id = new.rider_id
      and injury.started_at < coalesce(
        stage.departure_at,
        ((day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
      ) + interval '8 hours'
      and injury.expected_recovery_at > coalesce(
        stage.departure_at,
        ((day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
      )
  ) then
    raise exception 'Ce coureur est blessé pendant cette course.';
  end if;

  select camp.camp_type
  into v_camp_type
  from public.rider_form_camps as camp
  join public.race_editions as edition on edition.id = v_edition_id
  join public.stages as stage on stage.race_edition_id = edition.id
  join public.season_days as day on day.id = stage.season_day_id
  where camp.rider_id = new.rider_id
    and camp.season_id = edition.season_id
    and camp.status <> 'cancelled'
    and day.day_number between camp.start_day_number and camp.end_day_number
  limit 1;

  if v_camp_type = 'reconnaissance' then
    raise exception 'Ce coureur participe à une reconnaissance pendant cette course.';
  elsif v_camp_type is not null then
    raise exception 'Ce coureur participe à un stage de remise en forme pendant cette course.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_pending_race_roster_conflicts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target_edition_id uuid;
  v_conflicting_race_name text;
begin
  if tg_op = 'UPDATE'
    and old.status = 'withdrawn'
    and new.status = 'confirmed'
    and exists (
      select 1
      from public.international_selection_stage_race_repairs as repair
      where repair.race_roster_id = new.id
        and repair.incident_key =
          'international-selection-stage-race-withdrawals-2026-09-03'
        and repair.restore_authorized = true
    )
  then
    return new;
  end if;

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
       and other_stage.day_slot = target_stage.day_slot
       and other_stage.race_edition_id = other_edition.id
      where target_stage.race_edition_id = v_target_edition_id
    )
  limit 1;

  if v_conflicting_race_name is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Ce coureur est deja reserve pour %s sur le meme creneau.',
        v_conflicting_race_name
      );
  end if;

  return new;
end;
$$;

create table public.international_selection_suspended_candidate_states (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null,
  candidate_id uuid not null
    references public.international_championship_rider_selections(id)
    on delete cascade,
  race_edition_id uuid not null
    references public.race_editions(id) on delete cascade,
  was_selected boolean not null,
  previous_response_status text not null,
  previous_selected_at timestamptz,
  previous_responded_at timestamptz,
  suspended_at timestamptz not null default now(),
  constraint international_selection_suspended_state_once
    unique (incident_key, candidate_id)
);

alter table public.international_selection_suspended_candidate_states
  enable row level security;

grant all privileges
on table public.international_selection_suspended_candidate_states
to service_role;

do $repair$
declare
  v_incident_key constant text :=
    'international-selection-stage-race-withdrawals-2026-09-03';
  v_selected_at_values constant timestamptz[] := array[
    timestamptz '2026-09-03 12:10:18.417704+00',
    timestamptz '2026-09-03 12:14:28.529145+00'
  ];
  v_target_edition_ids constant uuid[] := array[
    '3fdc6152-3048-4fba-a552-4c28062b5cdb'::uuid,
    '60d3e6e2-484c-4d80-b842-523c2e20a3a7'::uuid,
    'fc8d3254-a704-4857-abb6-5af3ec3df2b0'::uuid
  ];
  v_detected_count integer;
  v_excluded_count integer;
  v_repaired_count integer;
  v_paused_edition_count integer;
  v_suspended_invitation_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_incident_key, 0)
  );

  select count(*)::integer
  into v_detected_count
  from public.international_championship_rider_selections as candidate
  join public.international_championship_nation_selections as nation_selection
    on nation_selection.id = candidate.nation_selection_id
  join public.race_rosters as roster
    on roster.rider_id = candidate.rider_id
   and roster.status = 'withdrawn'
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
   and registration.race_edition_id = any(v_target_edition_ids)
  where candidate.selected_at = any(v_selected_at_values);

  -- Une base neuve ne contient pas l'incident de production.
  if v_detected_count = 0 then
    return;
  end if;

  if v_detected_count <> 165 then
    raise exception
      'Le rollback attend 165 coureurs touchés, % détectés : opération interrompue.',
      v_detected_count;
  end if;

  select count(distinct roster.id)::integer
  into v_excluded_count
  from public.international_championship_rider_selections as candidate
  join public.race_rosters as roster
    on roster.rider_id = candidate.rider_id
   and roster.status = 'withdrawn'
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
   and registration.race_edition_id = any(v_target_edition_ids)
  where candidate.selected_at = any(v_selected_at_values)
    and (
      exists (
        select 1
        from public.stage_results as result
        where result.race_roster_id = roster.id
          and (
            result.injury_id is not null
            or result.status in (
              'did_not_start',
              'did_not_finish',
              'disqualified',
              'outside_time_limit'
            )
          )
      )
      or exists (
        select 1
        from public.stage_rider_unavailabilities as unavailability
        where unavailability.race_edition_id = registration.race_edition_id
          and unavailability.rider_id = roster.rider_id
          and (
            unavailability.injury_id is not null
            or unavailability.result_status in (
              'did_not_start',
              'did_not_finish',
              'disqualified',
              'outside_time_limit'
            )
          )
      )
    );

  if v_excluded_count <> 1 then
    raise exception
      'Le rollback attend 1 retrait sportif légitime à préserver, % détectés.',
      v_excluded_count;
  end if;

  insert into public.international_selection_dispatch_pauses (
    race_edition_id,
    reason
  )
  select distinct
    nation_selection.race_edition_id,
    'Suspension d’urgence pendant le rollback et la resimulation des courses de 14 h du 3 septembre 2026.'
  from public.international_championship_rider_selections as candidate
  join public.international_championship_nation_selections as nation_selection
    on nation_selection.id = candidate.nation_selection_id
  join public.race_editions as edition
    on edition.id = nation_selection.race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in (
     'continental_championship',
     'world_championship'
   )
  where candidate.is_selected = true
    and candidate.response_status in ('pending', 'confirmed', 'automatic')
    and exists (
      select 1
      from public.stages as stage
      where stage.race_edition_id = edition.id
        and stage.departure_at > now()
    )
  on conflict (race_edition_id) do update
  set
    reason = excluded.reason,
    paused_at = now(),
    released_at = null;

  get diagnostics v_paused_edition_count = row_count;
  if v_paused_edition_count = 0 then
    raise exception 'Aucune convocation active n’a été suspendue.';
  end if;

  insert into public.international_selection_suspended_candidate_states (
    incident_key,
    candidate_id,
    race_edition_id,
    was_selected,
    previous_response_status,
    previous_selected_at,
    previous_responded_at
  )
  select
    v_incident_key,
    candidate.id,
    nation_selection.race_edition_id,
    candidate.is_selected,
    candidate.response_status,
    candidate.selected_at,
    candidate.responded_at
  from public.international_championship_rider_selections as candidate
  join public.international_championship_nation_selections as nation_selection
    on nation_selection.id = candidate.nation_selection_id
  join public.international_selection_dispatch_pauses as pause
    on pause.race_edition_id = nation_selection.race_edition_id
   and pause.released_at is null
  on conflict (incident_key, candidate_id) do nothing;

  select count(*)::integer
  into v_suspended_invitation_count
  from public.international_selection_suspended_candidate_states as state
  where state.incident_key = v_incident_key
    and state.was_selected;

  if v_suspended_invitation_count = 0 then
    raise exception 'Aucune convocation sélectionnée n’a été archivée.';
  end if;

  insert into public.international_selection_stage_race_repairs (
    incident_key,
    candidate_id,
    nation_selection_id,
    race_roster_id,
    race_registration_id,
    race_edition_id,
    rider_id,
    sporting_director_id,
    previous_roster_status
  )
  select
    v_incident_key,
    candidate.id,
    candidate.nation_selection_id,
    roster.id,
    registration.id,
    registration.race_edition_id,
    candidate.rider_id,
    candidate.sporting_director_id,
    roster.status
  from public.international_championship_rider_selections as candidate
  join public.race_rosters as roster
    on roster.rider_id = candidate.rider_id
   and roster.status = 'withdrawn'
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
   and registration.race_edition_id = any(v_target_edition_ids)
  where candidate.selected_at = any(v_selected_at_values)
    and not exists (
      select 1
      from public.stage_results as result
      where result.race_roster_id = roster.id
        and (
          result.injury_id is not null
          or result.status in (
            'did_not_start',
            'did_not_finish',
            'disqualified',
            'outside_time_limit'
          )
        )
    )
    and not exists (
      select 1
      from public.stage_rider_unavailabilities as unavailability
      where unavailability.race_edition_id = registration.race_edition_id
        and unavailability.rider_id = roster.rider_id
        and (
          unavailability.injury_id is not null
          or unavailability.result_status in (
            'did_not_start',
            'did_not_finish',
            'disqualified',
            'outside_time_limit'
          )
        )
    )
  on conflict (incident_key, race_roster_id) do nothing;

  select count(*)::integer
  into v_repaired_count
  from public.international_selection_stage_race_repairs as repair
  where repair.incident_key = v_incident_key;

  if v_repaired_count <> 164 then
    raise exception
      'La trace du rollback attend 164 coureurs à restaurer, % enregistrés.',
      v_repaired_count;
  end if;

  if exists (
    select 1
    from public.international_selection_stage_race_repairs as repair
    join public.stage_results as result
      on result.race_roster_id = repair.race_roster_id
    where repair.incident_key = v_incident_key
      and (
        result.injury_id is not null
        or result.status in (
          'did_not_start',
          'did_not_finish',
          'disqualified',
          'outside_time_limit'
        )
      )
  ) or exists (
    select 1
    from public.international_selection_stage_race_repairs as repair
    join public.stage_rider_unavailabilities as unavailability
      on unavailability.race_edition_id = repair.race_edition_id
     and unavailability.rider_id = repair.rider_id
    where repair.incident_key = v_incident_key
      and (
        unavailability.injury_id is not null
        or unavailability.result_status in (
          'did_not_start',
          'did_not_finish',
          'disqualified',
          'outside_time_limit'
        )
      )
  ) then
    raise exception
      'Le rollback contient un abandon, un non-partant, une blessure de course ou un hors-delais : opération interrompue.';
  end if;

  if exists (
    select 1
    from public.international_selection_stage_race_repairs as repair
    join public.race_registrations as registration
      on registration.id = repair.race_registration_id
    where repair.incident_key = v_incident_key
      and registration.status <> 'accepted'
  ) then
    raise exception
      'Le rollback contient une inscription d’équipe qui n’est plus acceptée : opération interrompue.';
  end if;

  -- Annule toutes les convocations encore actives et leurs startlists. La
  -- pause empêche toute nouvelle invitation avant la fin des resimulations.
  update public.international_championship_rider_selections as candidate
  set is_selected = false
  where candidate.id in (
    select state.candidate_id
    from public.international_selection_suspended_candidate_states as state
    where state.incident_key = v_incident_key
      and state.was_selected
  );

  delete from public.sporting_director_messages as message
  using public.international_selection_suspended_candidate_states as state,
        public.international_championship_rider_selections as candidate
  where state.incident_key = v_incident_key
    and state.candidate_id = candidate.id
    and candidate.sporting_director_id = message.sporting_director_id
    and message.source_reference =
      'international-selection:' || state.candidate_id::text;

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.international_selection_dispatch_pauses as pause
  where registration.id = roster.race_registration_id
    and pause.race_edition_id = registration.race_edition_id
    and pause.released_at is null
    and roster.status in ('selected', 'confirmed');

  update public.race_registrations as registration
  set
    status = 'withdrawn',
    decided_at = now()
  from public.international_selection_dispatch_pauses as pause
  where pause.race_edition_id = registration.race_edition_id
    and pause.released_at is null
    and registration.entry_method = 'automatic'
    and registration.status = 'accepted';

  update public.race_rosters as roster
  set status = 'confirmed'
  where roster.id in (
    select repair.race_roster_id
    from public.international_selection_stage_race_repairs as repair
    where repair.incident_key = v_incident_key
  );

  get diagnostics v_repaired_count = row_count;
  if v_repaired_count <> 164 then
    raise exception
      'Le rollback attend 164 réinscriptions, % effectuées.',
      v_repaired_count;
  end if;

  update public.international_selection_stage_race_repairs as repair
  set restore_authorized = false
  where repair.incident_key = v_incident_key
    and repair.restore_authorized = true;
end;
$repair$;

notify pgrst, 'reload schema';

commit;
