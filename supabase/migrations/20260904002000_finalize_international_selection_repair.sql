begin;

-- Une course déjà partie, ou dont la composition est verrouillée, protège le
-- coureur contre toute convocation internationale. La règle vaut pour tous
-- les formats, pas uniquement les tours.
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

-- Un conflit modifiable est affiché au DS et ne prend priorité qu'après son
-- acceptation. Il ne doit jamais devenir une désinscription automatique.
create or replace function public.has_rider_calendar_conflict_for_international_selection(
  p_rider_id uuid,
  p_target_race_edition_id uuid
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
    join public.races as target_race
      on target_race.id = target_edition.race_id
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
    where target_edition.id = p_target_race_edition_id
      and not (
        (
          target_race.competition_type = 'world_championship'
          and other_race.competition_type = 'world_championship'
        )
        or (
          target_race.competition_type = 'continental_championship'
          and other_race.competition_type = 'continental_championship'
          and other_race.championship_continent_code =
            target_race.championship_continent_code
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
on function public.has_rider_calendar_conflict_for_international_selection(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.has_rider_calendar_conflict_for_international_selection(uuid, uuid)
to service_role;

-- Cette fonction n'est appelée que pour une réponse confirmée par le DS ou
-- pour une sélection automatique sans conflit au moment du départ.
create or replace function public.prioritize_international_championship_rider(
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
  join public.races as race on race.id = edition.race_id
  where edition.id = v_selection.race_edition_id;

  select min(day.day_number), max(day.day_number)
  into v_target_start_day, v_target_end_day
  from public.stages as stage
  join public.season_days as day on day.id = stage.season_day_id
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
  set status = 'withdrawn', decided_at = now()
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
      from public.race_rosters as remaining_roster
      where remaining_roster.race_registration_id = registration.id
        and remaining_roster.status in ('selected', 'confirmed')
    );

  update public.rider_form_camps as camp
  set status = 'cancelled', completed_at = now()
  where camp.rider_id = p_rider_id
    and camp.status in ('planned', 'active')
    and camp.start_day_number <= v_target_end_day
    and camp.end_day_number >= v_target_start_day
    and camp.season_id = v_target_season_id;
end;
$$;

revoke all
on function public.prioritize_international_championship_rider(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.prioritize_international_championship_rider(uuid, uuid)
to service_role;

create or replace function public.respond_to_international_championship_selection(
  p_candidate_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_candidate public.international_championship_rider_selections%rowtype;
  v_race_edition_id uuid;
  v_departure_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('international-championship-selections', 0)
  );

  if p_accept is null then
    raise exception 'La décision de sélection est invalide.';
  end if;

  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active';

  if v_director_id is null then
    raise exception using
      errcode = '42501',
      message = 'Aucun Directeur Sportif actif n''est associé à ce compte.';
  end if;

  select candidate.*
  into v_candidate
  from public.international_championship_rider_selections as candidate
  where candidate.id = p_candidate_id
  for update;

  if not found
    or v_candidate.sporting_director_id is distinct from v_director_id
  then
    raise exception using
      errcode = '42501',
      message = 'Vous ne pouvez pas répondre pour ce coureur.';
  end if;

  select selection.race_edition_id, min(stage.departure_at)
  into v_race_edition_id, v_departure_at
  from public.international_championship_nation_selections as selection
  join public.stages as stage
    on stage.race_edition_id = selection.race_edition_id
  where selection.id = v_candidate.nation_selection_id
  group by selection.race_edition_id;

  if v_candidate.response_status <> 'pending'
    or v_candidate.is_selected = false
  then
    raise exception
      'Une décision définitive a déjà été enregistrée pour ce coureur.';
  end if;

  if v_departure_at is null or now() >= v_departure_at then
    raise exception
      'Le départ est donné : la sélection est désormais définitive.';
  end if;

  if p_accept and public.is_rider_protected_by_stage_race_for_international_selection(
    v_candidate.rider_id,
    v_race_edition_id,
    now()
  ) then
    update public.international_championship_rider_selections
    set response_status = 'unavailable', is_selected = false, responded_at = now()
    where id = v_candidate.id;

    delete from public.sporting_director_messages
    where sporting_director_id = v_director_id
      and source_reference = 'international-selection:' || v_candidate.id::text;

    perform public.sync_international_championship_lineup(
      v_candidate.nation_selection_id
    );
    return;
  end if;

  if p_accept then
    update public.international_championship_rider_selections
    set response_status = 'confirmed', responded_at = now()
    where id = v_candidate.id;

    perform public.sync_international_championship_lineup(
      v_candidate.nation_selection_id
    );
  else
    update public.international_championship_rider_selections
    set response_status = 'declined', is_selected = false, responded_at = now()
    where id = v_candidate.id;

    perform public.sync_international_championship_lineup(
      v_candidate.nation_selection_id
    );
  end if;
end;
$$;

revoke all
on function public.respond_to_international_championship_selection(uuid, boolean)
from public, anon;

grant execute
on function public.respond_to_international_championship_selection(uuid, boolean)
to authenticated;

alter function public.process_due_international_championship_selections(timestamptz)
rename to process_due_international_championship_selections_before_safe_dispatch;

revoke all
on function public.process_due_international_championship_selections_before_safe_dispatch(timestamptz)
from public, anon, authenticated;

grant execute
on function public.process_due_international_championship_selections_before_safe_dispatch(timestamptz)
to service_role;

create or replace function public.process_due_international_championship_selections(
  p_now timestamptz default now()
)
returns table (
  created_nation_selections integer,
  finalized_nation_selections integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_selection_id uuid;
  v_promoted_count integer;
begin
  -- Sans réponse explicite, une convocation en conflit est abandonnée au
  -- départ. Elle ne peut donc jamais retirer le coureur de l'autre course.
  update public.international_championship_rider_selections as candidate
  set response_status = 'unavailable', is_selected = false
  from public.international_championship_nation_selections as selection
  where selection.id = candidate.nation_selection_id
    and candidate.response_status = 'pending'
    and exists (
      select 1
      from public.stages as stage
      where stage.race_edition_id = selection.race_edition_id
      group by stage.race_edition_id
      having min(stage.departure_at) <= p_now
    )
    and public.has_rider_calendar_conflict_for_international_selection(
      candidate.rider_id,
      selection.race_edition_id
    );

  select *
  into v_result
  from public.process_due_international_championship_selections_before_safe_dispatch(
    p_now
  );

  for v_selection_id in
    select selection.id
    from public.international_championship_nation_selections as selection
    where selection.finalized_at is not null
      and exists (
        select 1
        from public.stages as stage
        where stage.race_edition_id = selection.race_edition_id
        group by stage.race_edition_id
        having min(stage.departure_at) <= p_now
      )
    order by selection.id
  loop
    loop
      perform public.sync_international_championship_lineup(v_selection_id);

      update public.international_championship_rider_selections
      set response_status = 'automatic', responded_at = p_now
      where nation_selection_id = v_selection_id
        and is_selected = true
        and response_status = 'pending'
        and not public.has_rider_calendar_conflict_for_international_selection(
          rider_id,
          (
            select selection.race_edition_id
            from public.international_championship_nation_selections as selection
            where selection.id = v_selection_id
          )
        );

      get diagnostics v_promoted_count = row_count;
      perform public.sync_international_championship_lineup(v_selection_id);
      exit when v_promoted_count = 0;
    end loop;
  end loop;

  delete from public.sporting_director_messages as message
  using public.international_championship_rider_selections as candidate,
        public.international_championship_nation_selections as selection
  where candidate.nation_selection_id = selection.id
    and candidate.sporting_director_id = message.sporting_director_id
    and message.source_reference =
      'international-selection:' || candidate.id::text
    and candidate.response_status in ('unavailable', 'ineligible_injury')
    and exists (
      select 1
      from public.stages as stage
      where stage.race_edition_id = selection.race_edition_id
      group by stage.race_edition_id
      having min(stage.departure_at) <= p_now
    );

  return query
  select
    coalesce(v_result.created_nation_selections, 0),
    coalesce(v_result.finalized_nation_selections, 0);
end;
$$;

revoke all
on function public.process_due_international_championship_selections(timestamptz)
from public, anon, authenticated;

grant execute
on function public.process_due_international_championship_selections(timestamptz)
to service_role;

-- Un cadeau de niveau 8 est rattaché à une source dédiée et auditable.
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

do $finalize_repair$
declare
  v_incident_key constant text :=
    'international-selection-stage-race-withdrawals-2026-09-03';
  v_season_id constant uuid := 'afa6551b-3bb4-41a2-b394-0302f4275623';
  v_target_edition_ids constant uuid[] := array[
    '3fdc6152-3048-4fba-a552-4c28062b5cdb'::uuid,
    '60d3e6e2-484c-4d80-b842-523c2e20a3a7'::uuid,
    'fc8d3254-a704-4857-abb6-5af3ec3df2b0'::uuid
  ];
  v_selected_at_values constant timestamptz[] := array[
    timestamptz '2026-09-03 12:10:18.417704+00',
    timestamptz '2026-09-03 12:14:28.529145+00'
  ];
  v_count integer;
  v_season public.seasons%rowtype;
  v_affected record;
  v_reward record;
  v_grant_id uuid;
  v_nation_selection_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_incident_key, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('international-championship-selections', 0)
  );

  select count(*)::integer
  into v_count
  from public.international_selection_stage_race_repairs as repair
  where repair.incident_key = v_incident_key
    and repair.restore_authorized = false;

  if v_count <> 164 then
    raise exception
      'La finalisation attend 164 restaurations consommées, % trouvées.',
      v_count;
  end if;

  if exists (
    select 1
    from public.international_selection_stage_race_repairs as repair
    join public.race_rosters as roster on roster.id = repair.race_roster_id
    where repair.incident_key = v_incident_key
      and roster.status <> 'confirmed'
  ) then
    raise exception 'Un coureur restauré a de nouveau quitté sa start-list.';
  end if;

  select count(*)::integer
  into v_count
  from public.international_selection_dispatch_pauses as pause
  where pause.released_at is null;

  if v_count <> 5 then
    raise exception
      'La finalisation attend 5 championnats suspendus, % trouvés.',
      v_count;
  end if;

  if exists (
    select 1
    from public.international_championship_rider_selections as candidate
    join public.international_championship_nation_selections as selection
      on selection.id = candidate.nation_selection_id
    join public.international_selection_dispatch_pauses as pause
      on pause.race_edition_id = selection.race_edition_id
     and pause.released_at is null
    where candidate.is_selected = true
  ) then
    raise exception 'Une convocation est encore active pendant la pause.';
  end if;

  -- Chaque coureur restauré doit figurer dans le nouvel input officiel de la
  -- première étape. Le registre d'indisponibilités peut ensuite l'écarter
  -- légitimement d'une étape, sans altérer la start-list réparée.
  if exists (
    select 1
    from public.international_selection_stage_race_repairs as repair
    join lateral (
      select stage.id
      from public.stages as stage
      where stage.race_edition_id = repair.race_edition_id
      order by stage.stage_number
      limit 1
    ) as first_stage on true
    left join public.official_stage_simulations as simulation
      on simulation.stage_id = first_stage.id
    where repair.incident_key = v_incident_key
      and (
        simulation.stage_id is null
        or simulation.created_at < repair.repaired_at
        or not (
          simulation.input_data -> 'riders'
          @> jsonb_build_array(
            jsonb_build_object('id', repair.rider_id::text)
          )
        )
      )
  ) then
    raise exception
      'Une simulation officielle ne couvre pas toutes les restaurations.';
  end if;

  select count(*)::integer
  into v_count
  from public.stages as stage
  where stage.race_edition_id = any(v_target_edition_ids)
    and stage.departure_at <= now()
    and exists (
      select 1
      from public.official_stage_simulations as simulation
      where simulation.stage_id = stage.id
        and simulation.created_at >= timestamptz '2026-09-03 13:30:00+00'
        and jsonb_array_length(simulation.simulation_data -> 'results') = (
          select count(*)
          from public.stage_results as result
          where result.stage_id = stage.id
        )
    );

  if v_count <> 11 then
    raise exception
      'La finalisation attend 11 étapes resimulées et complètes, % validées.',
      v_count;
  end if;

  select * into v_season
  from public.seasons
  where id = v_season_id and status = 'active';

  if v_season.id is null then
    raise exception 'La saison active de la réparation est introuvable.';
  end if;

  for v_affected in
    select
      candidate.sporting_director_id,
      registration.team_season_id,
      team_season.team_id,
      array_agg(
        distinct edition.display_name
        order by edition.display_name
      ) as affected_races,
      count(distinct candidate.rider_id)::smallint as affected_rider_count
    from public.international_championship_rider_selections as candidate
    join public.race_rosters as roster
      on roster.rider_id = candidate.rider_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.race_edition_id = any(v_target_edition_ids)
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
     and edition.season_id = v_season_id
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
    where candidate.selected_at = any(v_selected_at_values)
      and candidate.sporting_director_id is not null
    group by
      candidate.sporting_director_id,
      registration.team_season_id,
      team_season.team_id
    order by candidate.sporting_director_id
  loop
    if not exists (
      select 1
      from public.sporting_directors as director
      join public.team_manager_assignments as assignment
        on assignment.sporting_director_id = director.id
       and assignment.team_id = v_affected.team_id
       and assignment.role = 'general_manager'
       and assignment.status = 'active'
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
      'Compensation pour le retrait incorrect de coureurs inscrits sur une course verrouillée ou déjà commencée.'
    )
    on conflict (incident_key, sporting_director_id) do nothing
    returning id into v_grant_id;

    insert into public.daily_reward_inventory (
      sporting_director_id,
      team_season_id,
      source_international_selection_compensation_id,
      reward_key,
      expires_after_game_year
    ) values (
      v_affected.sporting_director_id,
      v_affected.team_season_id,
      v_grant_id,
      v_reward.reward_key,
      v_season.game_year + 1
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
      'Un objet de niveau 8 vous a été attribué après l’incident des courses en cours.',
      format(
        E'Une anomalie survenue lors de la préparation des sélections continentales du 3 septembre 2026 a retiré %s de vos coureurs de %s alors que la composition n’était plus modifiable. Nous vous présentons nos excuses.\n\nLa règle a été corrigée : une convocation internationale ne pourra plus écarter un coureur d’une course déjà commencée ou verrouillée.\n\nEn compensation, vous recevez un objet de niveau 8 : « %s ». Il est disponible dans votre inventaire.',
        v_affected.affected_rider_count,
        array_to_string(v_affected.affected_races, ', '),
        v_reward.name
      ),
      '/jeu/inventaire',
      'Voir mon objet',
      'international-selection-tour-correction:2026-09-03',
      true
    );

    v_grant_id := null;
  end loop;

  select count(*)::integer into v_count
  from public.international_selection_compensation_grants
  where incident_key = v_incident_key;

  if v_count <> 30 then
    raise exception 'La réparation attend 30 cadeaux, % créés.', v_count;
  end if;

  select count(*)::integer into v_count
  from public.daily_reward_inventory as inventory
  join public.international_selection_compensation_grants as grant_row
    on grant_row.id = inventory.source_international_selection_compensation_id
  where grant_row.incident_key = v_incident_key;

  if v_count <> 30 then
    raise exception 'La réparation attend 30 objets en inventaire, % créés.', v_count;
  end if;

  select count(*)::integer into v_count
  from public.sporting_director_messages
  where source_reference =
    'international-selection-tour-correction:2026-09-03';

  if v_count <> 30 then
    raise exception 'La réparation attend 30 messages d’excuses, % créés.', v_count;
  end if;

  -- Les décisions précédentes ont été annulées. Chaque convocation repart à
  -- zéro, sous le contrôle des nouvelles règles de disponibilité.
  update public.international_championship_rider_selections as candidate
  set
    response_status = case
      when candidate.team_id is null then 'unavailable'
      when exists (
        select 1
        from public.international_championship_nation_selections as selection
        join public.stages as stage
          on stage.race_edition_id = selection.race_edition_id
        join public.rider_injuries as injury
          on injury.rider_id = candidate.rider_id
         and injury.status = 'active'
         and injury.started_at < stage.departure_at
         and injury.expected_recovery_at > stage.departure_at
        where selection.id = candidate.nation_selection_id
      ) then 'ineligible_injury'
      else 'pending'
    end,
    is_selected = false,
    selected_at = null,
    responded_at = null
  where candidate.id in (
    select state.candidate_id
    from public.international_selection_suspended_candidate_states as state
    where state.incident_key = v_incident_key
  );

  update public.international_championship_nation_selections as selection
  set finalized_at = null
  where selection.race_edition_id in (
    select pause.race_edition_id
    from public.international_selection_dispatch_pauses as pause
    where pause.released_at is null
  );

  update public.international_selection_dispatch_pauses
  set released_at = now()
  where released_at is null;

  for v_nation_selection_id in
    select selection.id
    from public.international_championship_nation_selections as selection
    join public.international_selection_dispatch_pauses as pause
      on pause.race_edition_id = selection.race_edition_id
    where pause.released_at is not null
    order by selection.nation_rank, selection.id
  loop
    perform public.sync_international_championship_lineup(
      v_nation_selection_id
    );
  end loop;

  if exists (
    select 1
    from public.international_championship_rider_selections as candidate
    join public.international_championship_nation_selections as selection
      on selection.id = candidate.nation_selection_id
    join public.international_selection_dispatch_pauses as pause
      on pause.race_edition_id = selection.race_edition_id
    where candidate.is_selected = true
      and public.is_rider_protected_by_stage_race_for_international_selection(
        candidate.rider_id,
        selection.race_edition_id,
        now()
      )
  ) then
    raise exception 'Une nouvelle convocation vise encore une course protégée.';
  end if;

  if exists (
    select 1
    from public.international_championship_rider_selections as candidate
    join public.international_championship_nation_selections as selection
      on selection.id = candidate.nation_selection_id
    join public.international_selection_dispatch_pauses as pause
      on pause.race_edition_id = selection.race_edition_id
    join public.race_registrations as registration
      on registration.race_edition_id = selection.race_edition_id
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
     and roster.rider_id = candidate.rider_id
     and roster.status in ('selected', 'confirmed')
    where candidate.is_selected = true
      and candidate.response_status = 'pending'
  ) then
    raise exception 'Une convocation en attente possède déjà une start-list.';
  end if;
end;
$finalize_repair$;

drop function if exists public.prioritize_international_championship_rider_base(uuid, uuid);

notify pgrst, 'reload schema';

commit;
