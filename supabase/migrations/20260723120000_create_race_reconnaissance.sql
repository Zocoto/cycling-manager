-- ============================================================
-- CYCLING MANAGER — Stages de reconnaissance
-- ============================================================

begin;

-- Le préparateur de parcours rejoint le marché du staff.
alter table public.staff_members
  drop constraint if exists staff_members_role_allowed;

alter table public.staff_members
  add constraint staff_members_role_allowed check (role in (
    'trainer', 'scout', 'doctor', 'mechanic', 'community_manager',
    'nutritionist', 'physiotherapist', 'race_preparer', 'architect'
  ));

create or replace function public.calculate_staff_salary(
  p_role text,
  p_level integer
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_base numeric;
  v_multiplier numeric;
  v_level integer := least(5, greatest(1, coalesce(p_level, 1)));
begin
  v_base := case p_role
    when 'trainer' then 18000
    when 'scout' then 15000
    when 'doctor' then 13000
    when 'race_preparer' then 12000
    when 'mechanic' then 11000
    when 'nutritionist' then 10000
    when 'physiotherapist' then 9500
    when 'architect' then 9000
    when 'community_manager' then 8000
    else null
  end;

  if v_base is null then
    raise exception 'Métier de staff invalide.';
  end if;

  v_multiplier := (array[1.00, 1.35, 1.75, 2.25, 3.00]::numeric[])[v_level];
  return round((v_base * v_multiplier) / 500) * 500;
end;
$$;

create or replace function public.create_daily_staff_market(
  p_market_date date,
  p_candidates jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market_date date := coalesce(
    p_market_date,
    (now() at time zone 'Europe/Paris')::date
  );
  v_batch_id uuid;
  v_candidate jsonb;
  v_staff_member_id uuid;
  v_slot integer := 0;
  v_role text;
  v_level integer;
  v_specialty text;
  v_country_id uuid;
begin
  if jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) <> 25 then
    raise exception 'Le marché du staff exige exactement 25 profils.';
  end if;

  insert into public.staff_market_batches (market_date)
  values (v_market_date)
  on conflict (market_date) do nothing
  returning id into v_batch_id;

  if v_batch_id is null then
    return 0;
  end if;

  update public.staff_market_listings as listing
  set status = 'expired'
  from public.staff_market_batches as batch
  where listing.batch_id = batch.id
    and batch.market_date < v_market_date
    and listing.status = 'available';

  for v_candidate in select value from jsonb_array_elements(p_candidates)
  loop
    v_slot := v_slot + 1;
    v_role := btrim(v_candidate ->> 'role');
    v_level := (v_candidate ->> 'level')::integer;
    v_specialty := nullif(btrim(v_candidate ->> 'trainer_specialty'), '');
    v_country_id := (v_candidate ->> 'country_id')::uuid;

    if v_role not in (
      'trainer', 'scout', 'doctor', 'mechanic', 'community_manager',
      'nutritionist', 'physiotherapist', 'race_preparer', 'architect'
    ) then
      raise exception 'Métier de staff invalide à la position %.', v_slot;
    end if;

    if v_level not between 1 and 5 then
      raise exception 'Niveau de staff invalide à la position %.', v_slot;
    end if;

    if (v_role = 'trainer' and v_specialty not in (
      'mountain', 'hills', 'flat', 'sprint', 'time_trial', 'cobbles', 'endurance'
    )) or (v_role <> 'trainer' and v_specialty is not null) then
      raise exception 'Spécialité de staff invalide à la position %.', v_slot;
    end if;

    if not exists (
      select 1 from public.countries
      where id = v_country_id and is_active = true
    ) then
      raise exception 'Nationalité de staff invalide à la position %.', v_slot;
    end if;

    insert into public.staff_members (
      country_id,
      first_name,
      last_name,
      role,
      level,
      trainer_specialty
    ) values (
      v_country_id,
      btrim(v_candidate ->> 'first_name'),
      btrim(v_candidate ->> 'last_name'),
      v_role,
      v_level,
      v_specialty
    )
    returning id into v_staff_member_id;

    insert into public.staff_market_listings (
      batch_id,
      staff_member_id,
      daily_slot,
      signing_fee,
      salary_per_season
    ) values (
      v_batch_id,
      v_staff_member_id,
      v_slot,
      public.calculate_staff_signing_fee(v_role, v_level),
      public.calculate_staff_salary(v_role, v_level)
    );
  end loop;

  return v_slot;
end;
$$;

-- Les prochains marchés sont générés par l'application. Pour le marché déjà
-- ouvert aujourd'hui, deux profils encore libres deviennent préparateurs afin
-- que le métier soit testable sans attendre le renouvellement quotidien.
do $$
declare
  v_listing record;
begin
  for v_listing in
    select
      listing.id,
      listing.staff_member_id,
      member.level
    from public.staff_market_listings as listing
    join public.staff_market_batches as batch on batch.id = listing.batch_id
    join public.staff_members as member on member.id = listing.staff_member_id
    where batch.market_date = (now() at time zone 'Europe/Paris')::date
      and listing.status = 'available'
      and member.role in ('scout', 'community_manager')
    order by
      case member.role when 'community_manager' then 0 else 1 end,
      listing.daily_slot desc
    limit 2
  loop
    update public.staff_members
    set role = 'race_preparer'
    where id = v_listing.staff_member_id;

    update public.staff_market_listings
    set
      salary_per_season = public.calculate_staff_salary(
        'race_preparer',
        v_listing.level
      ),
      signing_fee = public.calculate_staff_signing_fee(
        'race_preparer',
        v_listing.level
      )
    where id = v_listing.id;
  end loop;
end;
$$;

-- Une reconnaissance utilise le registre commun des indisponibilités. Le gain
-- de forme nul empêche à la fois le repos quotidien (+2) et l'entraînement.
alter table public.rider_form_camps
  drop constraint if exists rider_form_camps_type_allowed,
  drop constraint if exists rider_form_camps_gain_allowed;

alter table public.rider_form_camps
  add constraint rider_form_camps_type_allowed
    check (camp_type in ('classic', 'premium', 'reconnaissance')),
  add constraint rider_form_camps_gain_allowed
    check (
      (camp_type = 'classic' and form_gain_per_day = 5)
      or (camp_type = 'premium' and form_gain_per_day = 10)
      or (camp_type = 'reconnaissance' and form_gain_per_day = 0)
    );

create table public.stage_reconnaissances (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  target_stage_id uuid not null references public.stages(id) on delete restrict,
  preparer_contract_id uuid
    references public.staff_contracts(id) on delete set null,
  preparer_level smallint not null default 0,
  preparer_bonus_percentage numeric(5, 2) not null default 0,
  base_bonus_points numeric(5, 2) not null default 2,
  bonus_points numeric(5, 2) not null default 2,
  category_code text not null,
  race_format text not null,
  start_day_number smallint not null,
  end_day_number smallint not null,
  total_price numeric(12, 2) not null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint stage_reconnaissances_preparer_level_range
    check (preparer_level between 0 and 5),
  constraint stage_reconnaissances_preparer_bonus_range
    check (preparer_bonus_percentage between 0 and 25),
  constraint stage_reconnaissances_bonus_range
    check (
      base_bonus_points = 2
      and bonus_points between 2 and 2.5
    ),
  constraint stage_reconnaissances_category_allowed
    check (category_code in ('elite', 'world', 'continental', 'national')),
  constraint stage_reconnaissances_format_allowed
    check (race_format in ('one_day', 'stage_race')),
  constraint stage_reconnaissances_day_range
    check (
      start_day_number between 1 and 27
      and end_day_number = start_day_number + 1
      and end_day_number <= 28
    ),
  constraint stage_reconnaissances_price_positive check (total_price > 0),
  constraint stage_reconnaissances_status_allowed
    check (status in ('planned', 'active', 'completed', 'cancelled'))
);

create index stage_reconnaissances_team_season_idx
  on public.stage_reconnaissances (
    team_season_id,
    start_day_number,
    end_day_number
  );

create index stage_reconnaissances_target_stage_idx
  on public.stage_reconnaissances (target_stage_id, status);

create table public.stage_reconnaissance_riders (
  id uuid primary key default gen_random_uuid(),
  reconnaissance_id uuid not null
    references public.stage_reconnaissances(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete restrict,
  form_camp_id uuid not null
    references public.rider_form_camps(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint stage_reconnaissance_riders_unique
    unique (reconnaissance_id, rider_id),
  constraint stage_reconnaissance_form_camp_unique unique (form_camp_id)
);

create index stage_reconnaissance_riders_rider_idx
  on public.stage_reconnaissance_riders (rider_id, reconnaissance_id);

alter table public.stage_reconnaissances enable row level security;
alter table public.stage_reconnaissance_riders enable row level security;

create policy stage_reconnaissances_select_managed
on public.stage_reconnaissances
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
    where team_season.id = stage_reconnaissances.team_season_id
      and director.auth_user_id = auth.uid()
  )
);

create policy stage_reconnaissance_riders_select_managed
on public.stage_reconnaissance_riders
for select
to authenticated
using (
  exists (
    select 1
    from public.stage_reconnaissances as reconnaissance
    join public.team_seasons as team_season
      on team_season.id = reconnaissance.team_season_id
    join public.team_manager_assignments as assignment
      on assignment.team_id = team_season.team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
    where reconnaissance.id = stage_reconnaissance_riders.reconnaissance_id
      and director.auth_user_id = auth.uid()
  )
);

create or replace function public.calculate_stage_reconnaissance_cost(
  p_category_code text,
  p_race_format text
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_race_format not in ('one_day', 'stage_race') then
    raise exception 'Format de course invalide.';
  end if;

  return case p_category_code
    when 'elite' then case p_race_format when 'one_day' then 20000 else 15000 end
    when 'world' then case p_race_format when 'one_day' then 12000 else 9000 end
    when 'continental' then case p_race_format when 'one_day' then 7000 else 5000 end
    when 'national' then case p_race_format when 'one_day' then 4000 else 3000 end
    else null
  end;
end;
$$;

create or replace function public.settle_current_race_reconnaissances()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer;
begin
  update public.stage_reconnaissances as reconnaissance
  set
    status = case
      when reconnaissance.end_day_number < coalesce(season.current_day_number, 1)
        then 'completed'
      when reconnaissance.start_day_number <= coalesce(season.current_day_number, 1)
        then 'active'
      else 'planned'
    end,
    completed_at = case
      when reconnaissance.end_day_number < coalesce(season.current_day_number, 1)
        then coalesce(reconnaissance.completed_at, now())
      else reconnaissance.completed_at
    end
  from public.seasons as season
  where season.id = reconnaissance.season_id
    and reconnaissance.status <> 'cancelled';

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

create or replace function public.book_current_team_stage_reconnaissance(
  p_stage_id uuid,
  p_rider_ids uuid[],
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
    edition.display_name as race_name,
    edition.status as edition_status,
    race.race_format,
    category.code as category_code
  into v_target
  from public.stages as stage
  join public.season_days as day on day.id = stage.season_day_id
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.races as race on race.id = edition.race_id
  join public.race_categories as category on category.id = edition.race_category_id
  where stage.id = p_stage_id
    and edition.season_id = v_context.season_id;

  if v_target is null
    or v_target.stage_status <> 'planned'
    or v_target.edition_status = 'cancelled'
  then
    raise exception 'Cette course ne peut plus être reconnue.';
  end if;

  v_start_day := v_context.current_day_number + 1;
  v_end_day := v_start_day + 1;

  if v_end_day > 28 then
    raise exception 'La saison se termine avant la fin de cette reconnaissance.';
  end if;

  if v_target.target_day_number <= v_end_day then
    raise exception 'La reconnaissance de deux jours doit se terminer avant le départ de la course.';
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

-- Le rapport d'entraînement distingue explicitement la reconnaissance d'un
-- stage de remise en forme, tout en conservant le moteur existant.
alter table public.rider_training_sessions
  drop constraint if exists rider_training_sessions_status_allowed;

alter table public.rider_training_sessions
  add constraint rider_training_sessions_status_allowed check (
    status in (
      'completed',
      'skipped_low_form',
      'skipped_injury',
      'skipped_form_camp',
      'skipped_reconnaissance'
    )
  );

create or replace function public.label_reconnaissance_training_skip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'skipped_form_camp'
    and exists (
      select 1
      from public.rider_form_camps as camp
      join public.season_days as day on day.id = new.season_day_id
      where camp.rider_id = new.rider_id
        and camp.season_id = new.season_id
        and camp.camp_type = 'reconnaissance'
        and camp.status <> 'cancelled'
        and day.day_number between camp.start_day_number and camp.end_day_number
    )
  then
    update public.rider_training_sessions
    set status = 'skipped_reconnaissance'
    where id = new.id;
  end if;

  return null;
end;
$$;

create trigger label_reconnaissance_training_skip_after_insert
after insert on public.rider_training_sessions
for each row
when (new.status = 'skipped_form_camp')
execute function public.label_reconnaissance_training_skip();

-- Les écrans d'inscription distinguent une reconnaissance des stages de forme.
alter function public.get_current_team_race_roster_options(uuid)
  rename to get_current_team_race_roster_options_before_reconnaissance;

revoke all on function public.get_current_team_race_roster_options_before_reconnaissance(uuid)
  from public, anon, authenticated;
grant execute on function public.get_current_team_race_roster_options_before_reconnaissance(uuid)
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
    option.is_available,
    case
      when reconnaissance.camp_id is not null then 'reconnaissance'
      else option.unavailability_type
    end,
    coalesce(
      'Stage de reconnaissance · J'
        || reconnaissance.start_day_number
        || '–J'
        || reconnaissance.end_day_number,
      option.unavailability_label
    ),
    option.unavailable_until,
    option.conflicting_race_slug,
    option.conflicting_race_name,
    option.conflicting_start_day,
    option.conflicting_end_day
  from public.get_current_team_race_roster_options_before_reconnaissance(
    p_race_edition_id
  ) as option
  left join lateral (
    select
      camp.id as camp_id,
      camp.start_day_number,
      camp.end_day_number
    from public.rider_form_camps as camp
    join public.race_editions as edition
      on edition.id = p_race_edition_id
     and edition.season_id = camp.season_id
    where camp.rider_id = option.rider_id
      and camp.camp_type = 'reconnaissance'
      and camp.status <> 'cancelled'
      and exists (
        select 1
        from public.stages as target_stage
        join public.season_days as target_day
          on target_day.id = target_stage.season_day_id
        where target_stage.race_edition_id = p_race_edition_id
          and target_day.day_number
            between camp.start_day_number and camp.end_day_number
      )
    limit 1
  ) as reconnaissance on true;
$$;

revoke all on function public.get_current_team_race_roster_options(uuid)
  from public, anon;
grant execute on function public.get_current_team_race_roster_options(uuid)
  to authenticated, service_role;

create or replace function public.enforce_rider_health_availability_on_roster()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_edition_id uuid;
  v_camp_type text;
begin
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

grant select on table public.stage_reconnaissances to authenticated;
grant select on table public.stage_reconnaissance_riders to authenticated;
grant all privileges on table public.stage_reconnaissances to service_role;
grant all privileges on table public.stage_reconnaissance_riders to service_role;

revoke all on function public.calculate_stage_reconnaissance_cost(text, text)
  from public, anon;
grant execute on function public.calculate_stage_reconnaissance_cost(text, text)
  to authenticated, service_role;

revoke all on function public.settle_current_race_reconnaissances()
  from public, anon;
grant execute on function public.settle_current_race_reconnaissances()
  to authenticated, service_role;

revoke all on function public.book_current_team_stage_reconnaissance(uuid, uuid[], uuid)
  from public, anon;
grant execute on function public.book_current_team_stage_reconnaissance(uuid, uuid[], uuid)
  to authenticated;

comment on table public.stage_reconnaissances is
  'Missions de deux jours donnant un bonus temporaire sur une étape précise.';
comment on column public.stage_reconnaissances.bonus_points is
  'Bonus appliqué aux treize statistiques pendant l’étape reconnue.';

notify pgrst, 'reload schema';

commit;
