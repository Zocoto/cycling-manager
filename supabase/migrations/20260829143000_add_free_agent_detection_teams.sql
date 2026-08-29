begin;

-- Les équipes de détection sont des identités de start-list, pas de vrais
-- clubs. Elles restent donc sans team_season et conservent uniquement un nom
-- historique ainsi qu'un numéro stable au sein de l'édition.
alter table public.race_registrations
  add column detection_team_number smallint;

alter table public.race_registrations
  add constraint race_registrations_detection_team_number_range
    check (
      detection_team_number is null
      or detection_team_number between 1 and 4
    ),
  add constraint race_registrations_detection_team_identity
    check (
      detection_team_number is null
      or (
        team_season_id is null
        and historical_team_name =
          'Équipe de détection ' || detection_team_number::text
        and entry_method = 'automatic'
      )
    );

create unique index race_registrations_detection_team_unique_idx
  on public.race_registrations (race_edition_id, detection_team_number)
  where detection_team_number is not null;

alter table public.race_editions
  add column detection_teams_finalized_at timestamptz;

create index race_editions_detection_fill_due_idx
  on public.race_editions (
    (coalesce(withdrawal_closes_at, registration_closes_at)),
    id
  )
  where detection_teams_finalized_at is null
    and status in ('planned', 'registration_open', 'registration_closed');

comment on column public.race_registrations.detection_team_number is
  'Numéro stable d’une équipe de détection composée d’agents libres, sans club ni Directeur Sportif propriétaire.';

comment on column public.race_editions.detection_teams_finalized_at is
  'Date à laquelle le champ de cinq équipes a été contrôlé après la clôture des inscriptions.';

-- Ce règlement est volontairement borné : une édition, quatre équipes et
-- vingt-huit coureurs au maximum. Les pages interactives ne l'appellent
-- jamais ; il est raccordé à la maintenance périodique existante.
create or replace function public.settle_due_free_agent_detection_teams(
  p_now timestamptz default now()
)
returns table (
  processed_editions integer,
  created_teams integer,
  selected_riders integer,
  skipped_without_managed_team integer,
  editions_with_insufficient_pool integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edition record;
  v_candidate record;
  v_real_team_count integer;
  v_existing_detection_count integer;
  v_missing_team_count integer;
  v_teams_to_create integer;
  v_candidate_limit integer;
  v_candidate_count integer;
  v_usable_candidate_count integer;
  v_team_index integer;
  v_candidate_index integer;
  v_round integer;
  v_offset integer;
  v_assigned_team_index integer;
  v_detection_slot integer;
  v_profile_type text;
  v_registration_id uuid;
  v_registration_ids uuid[];
  v_detection_slots smallint[];
  v_candidate_ids uuid[];
  v_team_roster_counts integer[];
  v_processed integer := 0;
  v_created integer := 0;
  v_selected integer := 0;
  v_skipped_zero integer := 0;
  v_insufficient integer := 0;
begin
  for v_edition in
    select
      edition.id,
      edition.season_id,
      race.country_id as race_country_id,
      race_country.continent_code as race_continent_code,
      category.code as category_code,
      greatest(coalesce(category.minimum_roster_size, 1), 1)::integer
        as minimum_roster_size,
      greatest(
        coalesce(
          category.maximum_roster_size,
          category.minimum_roster_size,
          1
        ),
        greatest(coalesce(category.minimum_roster_size, 1), 1)
      )::integer as maximum_roster_size
    from public.race_editions as edition
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'standard'
    join public.countries as race_country
      on race_country.id = race.country_id
    join public.race_categories as category
      on category.id = edition.race_category_id
     and category.code in ('national', 'continental', 'world')
    where edition.detection_teams_finalized_at is null
      and edition.status in (
        'planned',
        'registration_open',
        'registration_closed'
      )
      and coalesce(
        edition.withdrawal_closes_at,
        edition.registration_closes_at
      ) is not null
      and coalesce(
        edition.withdrawal_closes_at,
        edition.registration_closes_at
      ) <= p_now
      and exists (
        select 1
        from public.stages as future_stage
        where future_stage.race_edition_id = edition.id
          and future_stage.departure_at > p_now
      )
    order by
      coalesce(edition.withdrawal_closes_at, edition.registration_closes_at),
      edition.id
    for update of edition skip locked
  loop
    v_processed := v_processed + 1;

    -- Un seul traitement peut matérialiser une édition, y compris si la
    -- maintenance est relancée ou chevauche un autre appel.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_edition.id::text, 9417)
    );

    select count(*)::integer
    into v_real_team_count
    from public.race_registrations as registration
    where registration.race_edition_id = v_edition.id
      and registration.status = 'accepted'
      and registration.team_season_id is not null
      and exists (
        select 1
        from public.race_rosters as roster
        where roster.race_registration_id = registration.id
          and roster.status in ('selected', 'confirmed')
      );

    select count(*)::integer
    into v_existing_detection_count
    from public.race_registrations as registration
    where registration.race_edition_id = v_edition.id
      and registration.status = 'accepted'
      and registration.detection_team_number is not null
      and exists (
        select 1
        from public.race_rosters as roster
        where roster.race_registration_id = registration.id
          and roster.status in ('selected', 'confirmed')
      );

    -- Sans équipe gérée par un membre, la course n'engendre pas cinq équipes
    -- artificielles et un replay sans public concerné.
    if v_real_team_count = 0 then
      update public.race_editions
      set detection_teams_finalized_at = p_now
      where id = v_edition.id;
      v_skipped_zero := v_skipped_zero + 1;
      continue;
    end if;

    v_missing_team_count := greatest(
      0,
      5 - v_real_team_count - v_existing_detection_count
    );

    if v_missing_team_count = 0 then
      update public.race_editions
      set detection_teams_finalized_at = p_now
      where id = v_edition.id;
      continue;
    end if;

    select coalesce(stage.profile_type, 'mixed')
    into v_profile_type
    from public.stages as stage
    where stage.race_edition_id = v_edition.id
    order by stage.distance_km desc, stage.stage_number
    limit 1;

    v_profile_type := coalesce(v_profile_type, 'mixed');
    v_candidate_ids := array[]::uuid[];
    v_candidate_limit :=
      v_missing_team_count * v_edition.maximum_roster_size + 32;

    for v_candidate in
      select rider.id
      from public.riders as rider
      join public.countries as rider_country
        on rider_country.id = rider.country_id
      join public.rider_season_ratings as rating
        on rating.rider_id = rider.id
       and rating.season_id = v_edition.season_id
      where rider.status = 'free_agent'
        and not exists (
          select 1
          from public.rider_contracts as contract
          where contract.rider_id = rider.id
            and contract.status = 'active'
        )
        and not exists (
          select 1
          from public.race_rosters as same_edition_roster
          join public.race_registrations as same_edition_registration
            on same_edition_registration.id =
              same_edition_roster.race_registration_id
          where same_edition_registration.race_edition_id = v_edition.id
            and same_edition_roster.rider_id = rider.id
            and same_edition_roster.status in ('selected', 'confirmed')
        )
        and not exists (
          select 1
          from public.rider_injuries as injury
          join public.stages as target_stage
            on target_stage.race_edition_id = v_edition.id
          join public.season_days as target_day
            on target_day.id = target_stage.season_day_id
          where injury.rider_id = rider.id
            and injury.started_at < coalesce(
              target_stage.departure_at,
              ((target_day.calendar_date::timestamp + time '12:00')
                at time zone 'Europe/Paris')
            ) + interval '8 hours'
            and injury.expected_recovery_at > coalesce(
              target_stage.departure_at,
              ((target_day.calendar_date::timestamp + time '12:00')
                at time zone 'Europe/Paris')
            )
        )
        and not exists (
          select 1
          from public.rider_form_camps as camp
          join public.stages as target_stage
            on target_stage.race_edition_id = v_edition.id
          join public.season_days as target_day
            on target_day.id = target_stage.season_day_id
          where camp.rider_id = rider.id
            and camp.season_id = v_edition.season_id
            and camp.status <> 'cancelled'
            and target_day.day_number between
              camp.start_day_number and camp.end_day_number
        )
        and not exists (
          select 1
          from public.race_rosters as other_roster
          join public.race_registrations as other_registration
            on other_registration.id = other_roster.race_registration_id
           and other_registration.status in ('accepted', 'pending')
          join public.race_editions as other_edition
            on other_edition.id = other_registration.race_edition_id
           and other_edition.id <> v_edition.id
          where other_roster.rider_id = rider.id
            and other_roster.status in ('selected', 'confirmed')
            and exists (
              select 1
              from public.stages as target_stage
              join public.stages as other_stage
                on other_stage.season_day_id = target_stage.season_day_id
               and other_stage.day_slot = target_stage.day_slot
               and other_stage.race_edition_id = other_edition.id
              where target_stage.race_edition_id = v_edition.id
            )
        )
      order by
        (
          -- Une course nationale privilégie très fortement son vivier local,
          -- puis continental. Une épreuve continentale privilégie son
          -- continent ; le niveau mondial reste plus ouvert.
          case v_edition.category_code
            when 'national' then
              case
                when rider.country_id = v_edition.race_country_id then 650
                when rider_country.continent_code =
                  v_edition.race_continent_code then 260
                else 0
              end
            when 'continental' then
              case
                when rider.country_id = v_edition.race_country_id then 420
                when rider_country.continent_code =
                  v_edition.race_continent_code then 360
                else 0
              end
            else
              case
                when rider.country_id = v_edition.race_country_id then 90
                when rider_country.continent_code =
                  v_edition.race_continent_code then 45
                else 0
              end
          end
          +
          case v_profile_type
            when 'mountain' then
              rating.mountain * 4 + rating.hills * 2 + rating.endurance * 2
            when 'hilly' then
              rating.hills * 4 + rating.mountain * 2 + rating.acceleration * 2
            when 'sprint' then
              rating.sprint * 4 + rating.acceleration * 2 + rating.flat * 2
            when 'flat' then
              rating.flat * 3 + rating.sprint * 2 + rating.endurance * 2
            when 'cobbles' then
              rating.cobbles * 4 + rating.flat * 2 + rating.resistance * 2
            when 'time_trial' then
              rating.time_trial * 4 + rating.prologue * 2 + rating.flat * 2
            else
              rating.mountain + rating.hills + rating.flat
              + rating.time_trial + rating.cobbles + rating.sprint
              + rating.endurance + rating.resistance
          end
          + (
            pg_catalog.hashtextextended(
              v_edition.id::text || ':' || rider.id::text,
              0
            ) & 2147483647::bigint
          ) % 61
        ) desc,
        rider.id
      for update of rider skip locked
      limit v_candidate_limit
    loop
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_candidate.id::text, 0)
      );

      -- Le verrou advisory est le même que celui du trigger anti-conflit. Une
      -- réservation concurrente terminée pendant la sélection est donc visible
      -- avant d'ajouter le coureur au tableau final.
      if exists (
        select 1
        from public.race_rosters as other_roster
        join public.race_registrations as other_registration
          on other_registration.id = other_roster.race_registration_id
         and other_registration.status in ('accepted', 'pending')
        join public.race_editions as other_edition
          on other_edition.id = other_registration.race_edition_id
         and other_edition.id <> v_edition.id
        where other_roster.rider_id = v_candidate.id
          and other_roster.status in ('selected', 'confirmed')
          and exists (
            select 1
            from public.stages as target_stage
            join public.stages as other_stage
              on other_stage.season_day_id = target_stage.season_day_id
             and other_stage.day_slot = target_stage.day_slot
             and other_stage.race_edition_id = other_edition.id
            where target_stage.race_edition_id = v_edition.id
          )
      ) then
        continue;
      end if;

      v_candidate_ids := array_append(v_candidate_ids, v_candidate.id);
      exit when cardinality(v_candidate_ids) >=
        v_missing_team_count * v_edition.maximum_roster_size;
    end loop;

    v_candidate_count := cardinality(v_candidate_ids);
    v_teams_to_create := least(
      v_missing_team_count,
      floor(
        v_candidate_count::numeric / v_edition.minimum_roster_size
      )::integer
    );

    if v_teams_to_create < v_missing_team_count then
      v_insufficient := v_insufficient + 1;
    end if;

    if v_teams_to_create = 0 then
      update public.race_editions
      set detection_teams_finalized_at = p_now
      where id = v_edition.id;
      continue;
    end if;

    select array_agg(available.slot_number order by available.slot_number)
    into v_detection_slots
    from (
      select slot_number::smallint
      from generate_series(1, 4) as slot(slot_number)
      where not exists (
        select 1
        from public.race_registrations as existing
        where existing.race_edition_id = v_edition.id
          and existing.detection_team_number = slot.slot_number
      )
      order by slot_number
      limit v_teams_to_create
    ) as available;

    if cardinality(coalesce(v_detection_slots, array[]::smallint[]))
      <> v_teams_to_create
    then
      raise exception 'Les numéros d’équipes de détection sont incohérents pour l’édition %.',
        v_edition.id;
    end if;

    v_registration_ids := array[]::uuid[];
    v_team_roster_counts := array_fill(0, array[v_teams_to_create]);

    for v_team_index in 1..v_teams_to_create loop
      v_detection_slot := v_detection_slots[v_team_index];

      insert into public.race_registrations (
        race_edition_id,
        team_season_id,
        historical_team_name,
        detection_team_number,
        entry_method,
        status,
        registered_at,
        decided_at
      )
      values (
        v_edition.id,
        null,
        'Équipe de détection ' || v_detection_slot::text,
        v_detection_slot,
        'automatic',
        'accepted',
        p_now,
        p_now
      )
      on conflict (race_edition_id, detection_team_number)
        where detection_team_number is not null
      do update set
        historical_team_name = excluded.historical_team_name,
        entry_method = 'automatic',
        status = 'accepted',
        decided_at = p_now
      returning id into v_registration_id;

      v_registration_ids := array_append(
        v_registration_ids,
        v_registration_id
      );
      v_created := v_created + 1;
    end loop;

    v_usable_candidate_count := least(
      v_candidate_count,
      v_teams_to_create * v_edition.maximum_roster_size
    );

    -- Distribution en serpentin : les meilleurs profils alternent entre les
    -- équipes et aucune sélection n'accapare les premiers candidats.
    for v_candidate_index in 1..v_usable_candidate_count loop
      v_round := (v_candidate_index - 1) / v_teams_to_create;
      v_offset := mod(v_candidate_index - 1, v_teams_to_create);
      v_assigned_team_index := case
        when mod(v_round, 2) = 0 then v_offset + 1
        else v_teams_to_create - v_offset
      end;
      v_team_roster_counts[v_assigned_team_index] :=
        v_team_roster_counts[v_assigned_team_index] + 1;
      v_detection_slot := v_detection_slots[v_assigned_team_index];

      insert into public.race_rosters (
        race_registration_id,
        rider_id,
        bib_number,
        race_role,
        status,
        selected_at
      )
      values (
        v_registration_ids[v_assigned_team_index],
        v_candidate_ids[v_candidate_index],
        (
          900
          + v_detection_slot * 10
          + v_team_roster_counts[v_assigned_team_index]
        )::smallint,
        'auto',
        'confirmed',
        p_now
      )
      on conflict (race_registration_id, rider_id)
      do update set
        bib_number = excluded.bib_number,
        race_role = 'auto',
        status = 'confirmed',
        selected_at = p_now;

      v_selected := v_selected + 1;
    end loop;

    update public.race_editions
    set detection_teams_finalized_at = p_now
    where id = v_edition.id;
  end loop;

  return query
  select
    v_processed,
    v_created,
    v_selected,
    v_skipped_zero,
    v_insufficient;
end;
$$;

revoke all
on function public.settle_due_free_agent_detection_teams(timestamptz)
from public, anon, authenticated;

grant execute
on function public.settle_due_free_agent_detection_teams(timestamptz)
to service_role;

comment on function public.settle_due_free_agent_detection_teams(timestamptz) is
  'Complète une fois les courses standard Nationale, Continentale et Mondiale à cinq équipes avec des agents libres disponibles.';

-- Les résultats individuels d'un agent libre alimentent son propre palmarès
-- et son classement UCI, sans créditer de club, de DS ou de trésorerie.
create or replace function public.apply_detection_rider_competition_reward(
  p_source_reference text,
  p_source_type text,
  p_race_roster_id uuid,
  p_stage_id uuid,
  p_uci_points integer,
  p_is_victory boolean,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_reward_id uuid;
begin
  select
    roster.rider_id,
    rider.country_id,
    edition.season_id
  into v_context
  from public.race_rosters as roster
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
   and registration.team_season_id is null
   and registration.detection_team_number is not null
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.stages as stage
    on stage.id = p_stage_id
   and stage.race_edition_id = edition.id
  where roster.id = p_race_roster_id
  limit 1;

  if v_context is null then
    raise exception 'Le coureur ne possède pas de contexte de détection valide.';
  end if;

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    rider_id,
    country_id,
    reputation_points,
    experience_points,
    cash_prize,
    uci_points,
    description
  )
  values (
    btrim(p_source_reference),
    p_source_type,
    null,
    null,
    v_context.rider_id,
    v_context.country_id,
    0,
    0,
    0,
    greatest(0, p_uci_points),
    btrim(p_description)
  )
  on conflict (source_reference) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    select event.id
    into v_reward_id
    from public.reward_events as event
    where event.source_reference = btrim(p_source_reference);
    return v_reward_id;
  end if;

  insert into public.rider_season_summaries (
    rider_id,
    season_id,
    victories,
    points
  )
  values (
    v_context.rider_id,
    v_context.season_id,
    case when p_is_victory then 1 else 0 end,
    greatest(0, p_uci_points)
  )
  on conflict (rider_id, season_id)
  do update set
    victories = coalesce(public.rider_season_summaries.victories, 0)
      + excluded.victories,
    points = coalesce(public.rider_season_summaries.points, 0)
      + excluded.points,
    updated_at = now();

  return v_reward_id;
end;
$$;

revoke all on function public.apply_detection_rider_competition_reward(
  text, text, uuid, uuid, integer, boolean, text
) from public, anon, authenticated;

grant execute on function public.apply_detection_rider_competition_reward(
  text, text, uuid, uuid, integer, boolean, text
) to service_role;

create or replace function public.refresh_race_edition_uci_rankings(
  p_race_edition_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
begin
  select edition.season_id
  into v_season_id
  from public.race_editions as edition
  where edition.id = p_race_edition_id;

  if v_season_id is not null then
    perform public.refresh_uci_rankings(v_season_id);
  end if;
end;
$$;

revoke all
on function public.refresh_race_edition_uci_rankings(uuid)
from public, anon, authenticated;

grant execute
on function public.refresh_race_edition_uci_rankings(uuid)
to service_role;

-- Les deux start-lists utilisées par le live doivent donner une identité
-- différente à chaque inscription historique. Le modèle international
-- remplace ensuite cet identifiant par le pays, comme auparavant.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
begin
  foreach v_signature in array array[
    'public.get_active_calendar_engaged_riders()'::regprocedure,
    'public.get_calendar_engaged_riders(uuid[])'::regprocedure
  ]
  loop
    select pg_catalog.pg_get_functiondef(v_signature)
    into v_definition;

    v_patched_definition := replace(
      v_definition,
      'coalesce(team.id, race.country_id),',
      'coalesce(team.id, registration.id),'
    );

    if v_patched_definition = v_definition then
      raise exception 'L’identité historique est introuvable dans %.',
        v_signature;
    end if;

    execute v_patched_definition;
  end loop;
end;
$migration$;

create or replace function public.get_race_engaged_riders(
  p_race_edition_id uuid
)
returns table (
  team_id uuid,
  team_name text,
  team_short_name text,
  team_country_iso_alpha2 text,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  country_iso_alpha2 text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(team_season.team_id, registration.id),
    coalesce(team_season.display_name, registration.historical_team_name),
    coalesce(
      team_season.short_name,
      case
        when registration.detection_team_number is not null
          then 'ED' || registration.detection_team_number::text
        else registration.historical_team_name
      end
    ),
    coalesce(team_country.iso_alpha2, race_country.iso_alpha2),
    rider.id,
    rider.first_name,
    rider.last_name,
    country.iso_alpha2
  from public.race_registrations as registration
  left join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  join public.countries as race_country
    on race_country.id = race.country_id
  left join public.countries as team_country
    on team_country.id = team_season.registration_country_id
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.countries as country
    on country.id = rider.country_id
  where registration.race_edition_id = p_race_edition_id
    and registration.status = 'accepted'
  order by
    coalesce(team_season.display_name, registration.historical_team_name),
    rider.last_name,
    rider.first_name;
$$;

revoke all
on function public.get_race_engaged_riders(uuid)
from public, anon;

grant execute
on function public.get_race_engaged_riders(uuid)
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
