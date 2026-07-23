begin;

create or replace function public.book_current_team_stage_reconnaissance(
  p_stage_id uuid,
  p_rider_ids uuid[],
  p_start_day_number integer,
  p_preparer_contract_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_target record;
  v_preparer record;
  v_reconnaissance_id uuid := gen_random_uuid();
  v_rider_id uuid;
  v_form_camp_id uuid;
  v_rider_ids uuid[];
  v_start_day integer;
  v_end_day integer;
  v_edition_start_day integer;
  v_edition_end_day integer;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_total_price numeric(12, 2);
  v_preparer_level integer := 0;
  v_preparer_bonus numeric(5, 2) := 0;
  v_bonus_points numeric(5, 2) := 2;
begin
  if p_stage_id is null then
    raise exception 'L’étape à reconnaître est obligatoire.';
  end if;

  if p_start_day_number is null or p_start_day_number not between 1 and 27 then
    raise exception 'La date de début de la reconnaissance est invalide.';
  end if;

  select coalesce(array_agg(distinct requested.rider_id), '{}'::uuid[])
  into v_rider_ids
  from unnest(coalesce(p_rider_ids, '{}'::uuid[])) as requested(rider_id)
  where requested.rider_id is not null;

  if cardinality(v_rider_ids) = 0 then
    raise exception 'Sélectionnez au moins un coureur.';
  end if;

  perform public.settle_current_team_finances();
  perform public.settle_current_health_and_form();
  perform public.settle_current_race_reconnaissances();

  select
    assignment.team_id,
    team_season.id as team_season_id,
    team_season.cash_balance,
    team_season.season_id,
    team_season.currency,
    season.game_year,
    coalesce(season.current_day_number, 1) as current_day_number,
    current_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.season_days as current_day
    on current_day.season_id = season.id
   and current_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform 1
  from public.team_seasons
  where id = v_context.team_season_id
  for update;

  select
    stage.id,
    stage.status as stage_status,
    day.day_number as target_day_number,
    edition.id as edition_id,
    edition.display_name as race_name,
    edition.status as edition_status,
    race.race_format,
    category.code as category_code
  into v_target
  from public.stages as stage
  join public.season_days as day on day.id = stage.season_day_id
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.races as race on race.id = edition.race_id
  join public.race_categories as category
    on category.id = edition.race_category_id
  where stage.id = p_stage_id
    and edition.season_id = v_context.season_id;

  if v_target is null
    or v_target.stage_status <> 'planned'
    or v_target.edition_status = 'cancelled'
  then
    raise exception 'Cette course ne peut plus être reconnue.';
  end if;

  v_start_day := p_start_day_number;
  v_end_day := v_start_day + 1;

  if v_start_day <= v_context.current_day_number then
    raise exception 'La reconnaissance doit commencer après la journée actuelle.';
  end if;

  if v_end_day > 28 then
    raise exception 'La saison se termine avant la fin de cette reconnaissance.';
  end if;

  if v_target.target_day_number <= v_end_day then
    raise exception 'La reconnaissance de deux jours doit se terminer avant le départ de la course.';
  end if;

  select
    min(edition_day.day_number),
    max(edition_day.day_number)
  into
    v_edition_start_day,
    v_edition_end_day
  from public.stages as edition_stage
  join public.season_days as edition_day
    on edition_day.id = edition_stage.season_day_id
  where edition_stage.race_edition_id = v_target.edition_id
    and edition_stage.status <> 'cancelled';

  if v_edition_start_day is null or v_edition_end_day is null then
    raise exception 'Le calendrier de la course ciblée est incomplet.';
  end if;

  if v_start_day <= v_edition_end_day and v_end_day >= v_edition_start_day then
    if v_target.race_format = 'stage_race' then
      raise exception
        'Impossible : la reconnaissance J%–J% chevauche % (J%–J%), le tour qui englobe l’étape ciblée.',
        v_start_day,
        v_end_day,
        v_target.race_name,
        v_edition_start_day,
        v_edition_end_day;
    end if;

    raise exception
      'Impossible : la reconnaissance J%–J% chevauche la course ciblée % (J%).',
      v_start_day,
      v_end_day,
      v_target.race_name,
      v_edition_start_day;
  end if;

  select
    (start_day.calendar_date::timestamp at time zone 'Europe/Paris'),
    ((end_day.calendar_date::timestamp + interval '1 day') at time zone 'Europe/Paris')
  into v_start_at, v_end_at
  from public.season_days as start_day
  join public.season_days as end_day
    on end_day.season_id = start_day.season_id
  where start_day.season_id = v_context.season_id
    and start_day.day_number = v_start_day
    and end_day.day_number = v_end_day;

  if v_start_at is null or v_end_at is null then
    raise exception 'Les journées choisies ne figurent pas dans le calendrier de la saison.';
  end if;

  if (
    select count(distinct contract.rider_id)
    from public.rider_contracts as contract
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
     and start_season.game_year <= v_context.game_year
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
     and end_season.game_year >= v_context.game_year
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
      and contract.rider_id = any(v_rider_ids)
  ) <> cardinality(v_rider_ids) then
    raise exception 'Au moins un coureur ne fait pas partie de votre effectif actif.';
  end if;

  if p_preparer_contract_id is not null then
    select
      contract.id,
      member.level,
      member.first_name,
      member.last_name
    into v_preparer
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'race_preparer'
    where contract.id = p_preparer_contract_id
      and contract.team_id = v_context.team_id
      and contract.status = 'active';

    if v_preparer is null then
      raise exception 'Ce préparateur de parcours n’est pas disponible pour votre équipe.';
    end if;

    v_preparer_level := v_preparer.level;
    v_preparer_bonus := v_preparer_level * 5;
    v_bonus_points := round(2 * (1 + v_preparer_bonus / 100.0), 2);
  end if;

  if exists (
    select 1
    from public.rider_injuries as injury
    where injury.rider_id = any(v_rider_ids)
      and injury.started_at < v_end_at
      and injury.expected_recovery_at > v_start_at
  ) then
    raise exception 'Au moins un coureur sera blessé pendant la reconnaissance.';
  end if;

  if exists (
    select 1
    from public.rider_form_camps as camp
    where camp.rider_id = any(v_rider_ids)
      and camp.season_id = v_context.season_id
      and camp.status <> 'cancelled'
      and camp.start_day_number <= v_end_day
      and camp.end_day_number >= v_start_day
  ) then
    raise exception 'Au moins un coureur est déjà indisponible pendant cette période.';
  end if;

  if exists (
    select 1
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
     and edition.season_id = v_context.season_id
    join public.stages as stage on stage.race_edition_id = edition.id
    join public.season_days as day on day.id = stage.season_day_id
    where roster.rider_id = any(v_rider_ids)
      and roster.status in ('selected', 'confirmed')
      and day.day_number between v_start_day and v_end_day
  ) then
    raise exception 'Au moins un coureur est déjà engagé en course pendant la reconnaissance.';
  end if;

  if exists (
    select 1
    from public.stage_reconnaissance_riders as participant
    join public.stage_reconnaissances as reconnaissance
      on reconnaissance.id = participant.reconnaissance_id
    where reconnaissance.team_season_id = v_context.team_season_id
      and reconnaissance.target_stage_id = p_stage_id
      and reconnaissance.status <> 'cancelled'
      and participant.rider_id = any(v_rider_ids)
  ) then
    raise exception 'Au moins un coureur connaît déjà cette étape grâce à une reconnaissance.';
  end if;

  v_total_price := public.calculate_stage_reconnaissance_cost(
    v_target.category_code,
    v_target.race_format
  );

  if v_total_price is null then
    raise exception 'La catégorie de cette course ne permet pas de calculer le coût.';
  end if;

  if v_context.cash_balance < v_total_price then
    raise exception 'La trésorerie de l’équipe est insuffisante pour cette reconnaissance.';
  end if;

  insert into public.stage_reconnaissances (
    id,
    team_season_id,
    season_id,
    target_stage_id,
    preparer_contract_id,
    preparer_level,
    preparer_bonus_percentage,
    base_bonus_points,
    bonus_points,
    category_code,
    race_format,
    start_day_number,
    end_day_number,
    total_price
  ) values (
    v_reconnaissance_id,
    v_context.team_season_id,
    v_context.season_id,
    p_stage_id,
    p_preparer_contract_id,
    v_preparer_level,
    v_preparer_bonus,
    2,
    v_bonus_points,
    v_target.category_code,
    v_target.race_format,
    v_start_day,
    v_end_day,
    v_total_price
  );

  foreach v_rider_id in array v_rider_ids
  loop
    insert into public.rider_form_camps (
      rider_id,
      team_season_id,
      season_id,
      camp_type,
      start_day_number,
      end_day_number,
      form_gain_per_day,
      price_per_day,
      total_price
    ) values (
      v_rider_id,
      v_context.team_season_id,
      v_context.season_id,
      'reconnaissance',
      v_start_day,
      v_end_day,
      0,
      0,
      0
    )
    returning id into v_form_camp_id;

    insert into public.stage_reconnaissance_riders (
      reconnaissance_id,
      rider_id,
      form_camp_id
    ) values (
      v_reconnaissance_id,
      v_rider_id,
      v_form_camp_id
    );
  end loop;

  update public.team_seasons
  set cash_balance = cash_balance - v_total_price
  where id = v_context.team_season_id;

  insert into public.team_finance_transactions (
    team_season_id,
    season_day_id,
    day_number,
    amount,
    category,
    status,
    description,
    source_reference,
    posted_at
  ) values (
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.current_day_number,
    -v_total_price,
    'training',
    'posted',
    'Reconnaissance · ' || v_target.race_name,
    'race-reconnaissance:' || v_reconnaissance_id::text,
    now()
  );

  return v_reconnaissance_id;
end;
$$;

revoke all on function public.book_current_team_stage_reconnaissance(
  uuid,
  uuid[],
  uuid
) from authenticated;

revoke all on function public.book_current_team_stage_reconnaissance(
  uuid,
  uuid[],
  integer,
  uuid
) from public, anon;

grant execute on function public.book_current_team_stage_reconnaissance(
  uuid,
  uuid[],
  integer,
  uuid
) to authenticated;

comment on function public.book_current_team_stage_reconnaissance(
  uuid,
  uuid[],
  integer,
  uuid
) is
  'Programme une reconnaissance de deux jours aux dates choisies, avant et hors de la course ciblée.';

notify pgrst, 'reload schema';

commit;
