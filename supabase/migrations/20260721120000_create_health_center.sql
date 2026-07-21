begin;

-- Les blessures historiques restent lisibles. Les nouveaux diagnostics utilisent
-- un code stable et une durée exacte en heures.
alter table public.rider_injuries
  add column diagnosis_code text,
  add column recovery_hours smallint,
  add column base_expected_recovery_at timestamptz,
  add column form_loss_per_day smallint,
  add column protocol_code text;

update public.rider_injuries
set
  diagnosis_code = case injury_type
    when 'fracture' then 'legacy_fracture'
    when 'concussion' then 'legacy_concussion'
    when 'contusion' then 'legacy_contusion'
    else 'legacy_abrasions'
  end,
  recovery_hours = recovery_days * 24,
  base_expected_recovery_at = expected_recovery_at,
  form_loss_per_day = 0;

alter table public.rider_injuries
  alter column diagnosis_code set not null,
  alter column recovery_hours set not null,
  alter column base_expected_recovery_at set not null,
  alter column form_loss_per_day set not null,
  alter column form_loss_per_day set default 10,
  add constraint rider_injuries_diagnosis_allowed check (
    diagnosis_code in (
      'rib_fracture',
      'wrist_fracture',
      'clavicle_fracture',
      'legacy_fracture',
      'legacy_concussion',
      'legacy_contusion',
      'legacy_abrasions'
    )
  ),
  add constraint rider_injuries_recovery_hours_positive
    check (recovery_hours > 0),
  add constraint rider_injuries_form_loss_range
    check (form_loss_per_day between 0 and 10),
  add constraint rider_injuries_protocol_allowed check (
    protocol_code is null
    or protocol_code in (
      'accelerated_recovery',
      'form_preservation',
      'complete_care'
    )
  );

-- Une blessure n'impose plus nécessairement un abandon sur l'étape.
alter table public.stage_results
  drop constraint if exists stage_results_injury_requires_dnf;

alter table public.race_results
  drop constraint if exists race_results_injury_requires_dnf;

create table public.medical_protocol_catalog (
  code text primary key,
  name text not null,
  description text not null,
  price numeric(12, 2) not null,
  duration_reduction_pct smallint not null default 0,
  form_loss_per_day smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medical_protocol_price_non_negative check (price >= 0),
  constraint medical_protocol_duration_reduction_range
    check (duration_reduction_pct between 0 and 25),
  constraint medical_protocol_form_loss_range
    check (form_loss_per_day between 0 and 10)
);

insert into public.medical_protocol_catalog (
  code,
  name,
  description,
  price,
  duration_reduction_pct,
  form_loss_per_day
)
values
  (
    'accelerated_recovery',
    'Récupération accélérée',
    'Réduit la durée initiale de convalescence de 10 %, sans protéger la forme.',
    5000,
    10,
    10
  ),
  (
    'form_preservation',
    'Préservation de la forme',
    'Ramène la perte quotidienne de forme de 10 à 7 points.',
    6000,
    0,
    7
  ),
  (
    'complete_care',
    'Protocole complet',
    'Réduit la convalescence de 5 % et la perte quotidienne à 8 points.',
    9000,
    5,
    8
  );

create table public.rider_injury_treatments (
  id uuid primary key default gen_random_uuid(),
  rider_injury_id uuid not null unique
    references public.rider_injuries(id) on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id) on delete restrict,
  protocol_code text not null
    references public.medical_protocol_catalog(code) on delete restrict,
  price_paid numeric(12, 2) not null,
  recovery_hours_reduced smallint not null default 0,
  previous_expected_recovery_at timestamptz not null,
  adjusted_expected_recovery_at timestamptz not null,
  applied_at timestamptz not null default now(),
  constraint rider_injury_treatments_price_non_negative check (price_paid >= 0),
  constraint rider_injury_treatments_reduction_non_negative
    check (recovery_hours_reduced >= 0),
  constraint rider_injury_treatments_adjusted_date
    check (adjusted_expected_recovery_at <= previous_expected_recovery_at)
);

create table public.rider_form_camps (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete restrict,
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  camp_type text not null,
  start_day_number smallint not null,
  end_day_number smallint not null,
  form_gain_per_day smallint not null,
  price_per_day numeric(12, 2) not null,
  total_price numeric(12, 2) not null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint rider_form_camps_type_allowed
    check (camp_type in ('classic', 'premium')),
  constraint rider_form_camps_day_range
    check (
      start_day_number between 1 and 28
      and end_day_number between start_day_number and 28
      and end_day_number - start_day_number between 0 and 2
    ),
  constraint rider_form_camps_gain_allowed
    check (
      (camp_type = 'classic' and form_gain_per_day = 5)
      or (camp_type = 'premium' and form_gain_per_day = 10)
    ),
  constraint rider_form_camps_prices_non_negative
    check (price_per_day >= 0 and total_price >= 0),
  constraint rider_form_camps_status_allowed
    check (status in ('planned', 'active', 'completed', 'cancelled'))
);

create index rider_form_camps_rider_season_idx
  on public.rider_form_camps (rider_id, season_id, start_day_number, end_day_number);

create table public.rider_daily_condition_effects (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  season_day_id uuid not null references public.season_days(id) on delete cascade,
  effect_type text not null,
  form_delta smallint not null,
  form_before smallint not null,
  form_after smallint not null,
  applied_at timestamptz not null default now(),
  constraint rider_daily_condition_effects_unique
    unique (rider_id, season_day_id),
  constraint rider_daily_condition_effects_type_allowed check (
    effect_type in ('rest', 'race', 'injury', 'form_camp')
  ),
  constraint rider_daily_condition_effects_delta_range
    check (form_delta between 0 and 10),
  constraint rider_daily_condition_effects_form_range
    check (form_before between 0 and 100 and form_after between 0 and 100)
);

create table public.rider_injury_form_effects (
  id uuid primary key default gen_random_uuid(),
  rider_injury_id uuid not null
    references public.rider_injuries(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  season_day_id uuid not null references public.season_days(id) on delete cascade,
  penalty_number smallint not null,
  form_delta smallint not null,
  form_before smallint not null,
  form_after smallint not null,
  due_at timestamptz not null,
  applied_at timestamptz not null default now(),
  constraint rider_injury_form_effects_unique
    unique (rider_injury_id, penalty_number),
  constraint rider_injury_form_effects_penalty_positive check (penalty_number > 0),
  constraint rider_injury_form_effects_delta_negative check (form_delta <= 0),
  constraint rider_injury_form_effects_form_range
    check (form_before between 0 and 100 and form_after between 0 and 100)
);

alter table public.medical_protocol_catalog enable row level security;
alter table public.rider_injury_treatments enable row level security;
alter table public.rider_form_camps enable row level security;
alter table public.rider_daily_condition_effects enable row level security;
alter table public.rider_injury_form_effects enable row level security;

create policy medical_protocol_catalog_select_authenticated
on public.medical_protocol_catalog
for select
to authenticated
using (is_active);

alter table public.team_finance_transactions
  drop constraint if exists team_finance_transactions_category_allowed;

alter table public.team_finance_transactions
  add constraint team_finance_transactions_category_allowed check (
    category in (
      'sponsor',
      'race_prize',
      'rider_salary',
      'staff_salary',
      'equipment',
      'building',
      'transfer',
      'training',
      'medical_care',
      'other'
    )
  );

create or replace function public.settle_current_health_and_form()
returns table (
  processed_daily_effects integer,
  processed_injury_effects integer,
  current_day_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season record;
  v_day record;
  v_rider record;
  v_injury record;
  v_current_day_id uuid;
  v_previous_form integer;
  v_previous_fatigue integer;
  v_delta integer;
  v_next_form integer;
  v_effect_type text;
  v_inserted_id uuid;
  v_due_penalties integer;
  v_penalty_number integer;
  v_daily_count integer := 0;
  v_injury_count integer := 0;
begin
  -- Les malus de course doivent exister avant de reconstruire la forme jour
  -- après jour, notamment lorsqu'un joueur revient après plusieurs jours.
  perform public.settle_finished_race_conditions();
  perform public.sync_active_season_day();

  select season.*
  into v_season
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season is null then
    return query select 0, 0, null::integer;
    return;
  end if;

  select day.id
  into v_current_day_id
  from public.season_days as day
  where day.season_id = v_season.id
    and day.day_number = coalesce(v_season.current_day_number, 1);

  -- Une journée est réglée seulement lorsqu'elle est entièrement terminée.
  for v_day in
    select
      day.id,
      day.day_number,
      day.calendar_date,
      next_day.id as next_day_id
    from public.season_days as day
    join public.season_days as next_day
      on next_day.season_id = day.season_id
     and next_day.day_number = day.day_number + 1
    where day.season_id = v_season.id
      and day.day_number < coalesce(v_season.current_day_number, 1)
    order by day.day_number
  loop
    for v_rider in
      select distinct rider.id
      from public.riders as rider
      join public.rider_contracts as contract
        on contract.rider_id = rider.id
       and contract.status = 'active'
      join public.seasons as start_season
        on start_season.id = contract.start_season_id
       and start_season.game_year <= v_season.game_year
      join public.seasons as end_season
        on end_season.id = contract.end_season_id
       and end_season.game_year >= v_season.game_year
      where rider.status = 'active'
      order by rider.id
    loop
      if exists (
        select 1
        from public.rider_daily_condition_effects as existing
        where existing.rider_id = v_rider.id
          and existing.season_day_id = v_day.id
      ) then
        continue;
      end if;

      select state.form, state.fatigue
      into v_previous_form, v_previous_fatigue
      from public.rider_condition_states as state
      join public.season_days as state_day on state_day.id = state.season_day_id
      where state.rider_id = v_rider.id
        and state_day.season_id = v_season.id
        and state_day.day_number <= v_day.day_number
      order by state_day.day_number desc
      limit 1;

      v_previous_form := coalesce(v_previous_form, 75);
      v_previous_fatigue := coalesce(v_previous_fatigue, 0);

      if exists (
        select 1
        from public.rider_injuries as injury
        where injury.rider_id = v_rider.id
          and injury.started_at < (
            (v_day.calendar_date::timestamp + interval '1 day')
              at time zone 'Europe/Paris'
          )
          and injury.expected_recovery_at > (
            v_day.calendar_date::timestamp at time zone 'Europe/Paris'
          )
      ) then
        v_effect_type := 'injury';
        v_delta := 0;
      elsif exists (
        select 1
        from public.race_rosters as roster
        join public.race_registrations as registration
          on registration.id = roster.race_registration_id
         and registration.status = 'accepted'
        join public.stages as stage
          on stage.race_edition_id = registration.race_edition_id
        where roster.rider_id = v_rider.id
          and roster.status in ('selected', 'confirmed')
          and stage.season_day_id = v_day.id
      ) then
        v_effect_type := 'race';
        v_delta := 0;
      else
        select camp.form_gain_per_day
        into v_delta
        from public.rider_form_camps as camp
        where camp.rider_id = v_rider.id
          and camp.season_id = v_season.id
          and camp.status <> 'cancelled'
          and v_day.day_number between camp.start_day_number and camp.end_day_number
        limit 1;

        if v_delta is not null then
          v_effect_type := 'form_camp';
        else
          v_effect_type := 'rest';
          v_delta := 2;
        end if;
      end if;

      v_delta := coalesce(v_delta, 0);
      v_next_form := least(100, v_previous_form + v_delta);
      v_inserted_id := null;

      insert into public.rider_daily_condition_effects (
        rider_id,
        season_day_id,
        effect_type,
        form_delta,
        form_before,
        form_after
      )
      values (
        v_rider.id,
        v_day.id,
        v_effect_type,
        v_delta,
        v_previous_form,
        v_next_form
      )
      on conflict (rider_id, season_day_id) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        insert into public.rider_condition_states (
          rider_id,
          season_day_id,
          form,
          fatigue,
          source
        )
        values (
          v_rider.id,
          v_day.next_day_id,
          v_next_form,
          v_previous_fatigue,
          v_effect_type
        )
        on conflict (rider_id, season_day_id)
        do update set
          form = greatest(
            0,
            least(
              100,
              v_next_form + coalesce(
                (
                  select sum(race_effect.form_delta)
                  from public.stage_rider_condition_effects as race_effect
                  where race_effect.rider_id = v_rider.id
                    and race_effect.season_day_id = v_day.next_day_id
                ),
                0
              )
            )
          ),
          source = v_effect_type,
          updated_at = now();

        v_daily_count := v_daily_count + 1;
      end if;
    end loop;
  end loop;

  -- Les malus médicaux mûrissent toutes les 24 heures exactes.
  for v_injury in
    select injury.*
    from public.rider_injuries as injury
    where injury.form_loss_per_day > 0
      and injury.started_at <= now()
      and injury.diagnosis_code in (
        'rib_fracture',
        'wrist_fracture',
        'clavicle_fracture'
      )
    order by injury.started_at, injury.id
  loop
    v_due_penalties := greatest(
      0,
      least(
        floor(v_injury.recovery_hours / 24.0)::integer,
        floor(
          extract(
            epoch from (least(now(), v_injury.expected_recovery_at) - v_injury.started_at)
          ) / 86400
        )::integer
      )
    );

    if v_due_penalties = 0 or v_current_day_id is null then
      continue;
    end if;

    for v_penalty_number in 1..v_due_penalties loop
      if exists (
        select 1
        from public.rider_injury_form_effects as existing
        where existing.rider_injury_id = v_injury.id
          and existing.penalty_number = v_penalty_number
      ) then
        continue;
      end if;

      select state.form, state.fatigue
      into v_previous_form, v_previous_fatigue
      from public.rider_condition_states as state
      join public.season_days as state_day on state_day.id = state.season_day_id
      where state.rider_id = v_injury.rider_id
        and state_day.season_id = v_season.id
        and state_day.day_number <= coalesce(v_season.current_day_number, 1)
      order by state_day.day_number desc
      limit 1;

      v_previous_form := coalesce(v_previous_form, 75);
      v_previous_fatigue := coalesce(v_previous_fatigue, 0);
      v_next_form := greatest(0, v_previous_form - v_injury.form_loss_per_day);
      v_inserted_id := null;

      insert into public.rider_injury_form_effects (
        rider_injury_id,
        rider_id,
        season_day_id,
        penalty_number,
        form_delta,
        form_before,
        form_after,
        due_at
      )
      values (
        v_injury.id,
        v_injury.rider_id,
        v_current_day_id,
        v_penalty_number,
        -v_injury.form_loss_per_day,
        v_previous_form,
        v_next_form,
        v_injury.started_at + make_interval(hours => v_penalty_number * 24)
      )
      on conflict (rider_injury_id, penalty_number) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        insert into public.rider_condition_states (
          rider_id,
          season_day_id,
          form,
          fatigue,
          source
        )
        values (
          v_injury.rider_id,
          v_current_day_id,
          v_next_form,
          v_previous_fatigue,
          'injury'
        )
        on conflict (rider_id, season_day_id)
        do update set
          form = greatest(
            0,
            public.rider_condition_states.form - v_injury.form_loss_per_day
          ),
          source = 'injury',
          updated_at = now();

        v_injury_count := v_injury_count + 1;
      end if;
    end loop;
  end loop;

  update public.rider_injuries
  set
    status = 'recovered',
    recovered_at = coalesce(recovered_at, expected_recovery_at),
    updated_at = now()
  where status = 'active'
    and expected_recovery_at <= now();

  update public.rider_form_camps
  set
    status = case
      when end_day_number < coalesce(v_season.current_day_number, 1) then 'completed'
      when start_day_number <= coalesce(v_season.current_day_number, 1) then 'active'
      else 'planned'
    end,
    completed_at = case
      when end_day_number < coalesce(v_season.current_day_number, 1)
        then coalesce(completed_at, now())
      else completed_at
    end
  where season_id = v_season.id
    and status <> 'cancelled';

  return query
  select
    v_daily_count,
    v_injury_count,
    coalesce(v_season.current_day_number, 1)::integer;
end;
$$;

create or replace function public.apply_current_team_injury_protocol(
  p_injury_id uuid,
  p_protocol_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_protocol record;
  v_treatment_id uuid := gen_random_uuid();
  v_reduction_hours integer;
  v_adjusted_recovery timestamptz;
begin
  perform public.settle_current_health_and_form();

  select protocol.*
  into v_protocol
  from public.medical_protocol_catalog as protocol
  where protocol.code = p_protocol_code
    and protocol.is_active;

  if v_protocol is null then
    raise exception 'Ce protocole médical est indisponible.';
  end if;

  select
    injury.*,
    team_season.id as team_season_id,
    team_season.cash_balance,
    team_season.season_id,
    season.current_day_number,
    day.id as season_day_id
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
  join public.rider_contracts as contract
    on contract.team_id = assignment.team_id
   and contract.status = 'active'
  join public.rider_injuries as injury
    on injury.rider_id = contract.rider_id
   and injury.id = p_injury_id
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
  for update of injury, team_season;

  if v_context is null then
    raise exception 'Cette blessure ne concerne pas un coureur de votre équipe.';
  end if;

  if v_context.status <> 'active' or v_context.expected_recovery_at <= now() then
    raise exception 'La convalescence de ce coureur est déjà terminée.';
  end if;

  if v_context.protocol_code is not null then
    raise exception 'Un protocole médical a déjà été appliqué à cette blessure.';
  end if;

  if v_context.expected_recovery_at - now() < interval '24 hours' then
    raise exception 'Il reste moins de 24 heures de convalescence : aucun protocole ne peut plus être appliqué.';
  end if;

  if v_context.cash_balance < v_protocol.price then
    raise exception 'La trésorerie de l’équipe est insuffisante pour ce protocole.';
  end if;

  v_reduction_hours := ceil(
    v_context.recovery_hours * v_protocol.duration_reduction_pct / 100.0
  )::integer;
  v_adjusted_recovery := v_context.expected_recovery_at
    - make_interval(hours => v_reduction_hours);

  update public.rider_injuries
  set
    expected_recovery_at = v_adjusted_recovery,
    form_loss_per_day = v_protocol.form_loss_per_day,
    protocol_code = v_protocol.code,
    updated_at = now()
  where id = v_context.id;

  insert into public.rider_injury_treatments (
    id,
    rider_injury_id,
    team_season_id,
    protocol_code,
    price_paid,
    recovery_hours_reduced,
    previous_expected_recovery_at,
    adjusted_expected_recovery_at
  )
  values (
    v_treatment_id,
    v_context.id,
    v_context.team_season_id,
    v_protocol.code,
    v_protocol.price,
    v_reduction_hours,
    v_context.expected_recovery_at,
    v_adjusted_recovery
  );

  update public.team_seasons
  set cash_balance = cash_balance - v_protocol.price
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
  )
  values (
    v_context.team_season_id,
    v_context.season_day_id,
    coalesce(v_context.current_day_number, 1),
    -v_protocol.price,
    'medical_care',
    'posted',
    v_protocol.name,
    'medical-treatment:' || v_treatment_id::text,
    now()
  );

  return v_treatment_id;
end;
$$;

create or replace function public.book_current_team_form_camp(
  p_rider_id uuid,
  p_camp_type text,
  p_duration_days integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_camp_id uuid := gen_random_uuid();
  v_start_day integer;
  v_end_day integer;
  v_gain integer;
  v_daily_price numeric(12, 2);
  v_total_price numeric(12, 2);
  v_start_at timestamptz;
  v_end_at timestamptz;
begin
  perform public.settle_current_health_and_form();

  if p_camp_type not in ('classic', 'premium') then
    raise exception 'Le type de stage demandé est invalide.';
  end if;

  if p_duration_days not between 1 and 3 then
    raise exception 'Un stage doit durer entre un et trois jours.';
  end if;

  select
    team_season.id as team_season_id,
    team_season.cash_balance,
    team_season.season_id,
    season.current_day_number,
    season.game_year,
    contract.id as contract_id,
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
  join public.rider_contracts as contract
    on contract.team_id = assignment.team_id
   and contract.rider_id = p_rider_id
   and contract.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
   and start_season.game_year <= season.game_year
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
   and end_season.game_year >= season.game_year
  join public.season_days as current_day
    on current_day.season_id = season.id
   and current_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
  for update of team_season;

  if v_context is null then
    raise exception 'Ce coureur ne fait pas partie de votre effectif actif.';
  end if;

  v_start_day := coalesce(v_context.current_day_number, 1) + 1;
  v_end_day := v_start_day + p_duration_days - 1;

  if v_end_day > 28 then
    raise exception 'La saison se termine avant la fin de ce stage.';
  end if;

  select
    (start_day.calendar_date::timestamp at time zone 'Europe/Paris'),
    ((end_day.calendar_date::timestamp + interval '1 day') at time zone 'Europe/Paris')
  into v_start_at, v_end_at
  from public.season_days as start_day
  join public.season_days as end_day on end_day.season_id = start_day.season_id
  where start_day.season_id = v_context.season_id
    and start_day.day_number = v_start_day
    and end_day.day_number = v_end_day;

  if exists (
    select 1
    from public.rider_injuries as injury
    where injury.rider_id = p_rider_id
      and injury.started_at < v_end_at
      and injury.expected_recovery_at > v_start_at
  ) then
    raise exception 'Ce coureur sera encore en convalescence pendant ce stage.';
  end if;

  if exists (
    select 1
    from public.rider_form_camps as camp
    where camp.rider_id = p_rider_id
      and camp.season_id = v_context.season_id
      and camp.status <> 'cancelled'
      and camp.start_day_number <= v_end_day
      and camp.end_day_number >= v_start_day
  ) then
    raise exception 'Un autre stage est déjà prévu sur cette période.';
  end if;

  if exists (
    select 1
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.stages as stage
      on stage.race_edition_id = registration.race_edition_id
    join public.season_days as day on day.id = stage.season_day_id
    where roster.rider_id = p_rider_id
      and roster.status in ('selected', 'confirmed')
      and day.season_id = v_context.season_id
      and day.day_number between v_start_day and v_end_day
  ) then
    raise exception 'Ce coureur est déjà engagé sur une course pendant le stage.';
  end if;

  v_gain := case when p_camp_type = 'premium' then 10 else 5 end;
  v_daily_price := case when p_camp_type = 'premium' then 6000 else 2000 end;
  v_total_price := v_daily_price * p_duration_days;

  if v_context.cash_balance < v_total_price then
    raise exception 'La trésorerie de l’équipe est insuffisante pour ce stage.';
  end if;

  insert into public.rider_form_camps (
    id,
    rider_id,
    team_season_id,
    season_id,
    camp_type,
    start_day_number,
    end_day_number,
    form_gain_per_day,
    price_per_day,
    total_price
  )
  values (
    v_camp_id,
    p_rider_id,
    v_context.team_season_id,
    v_context.season_id,
    p_camp_type,
    v_start_day,
    v_end_day,
    v_gain,
    v_daily_price,
    v_total_price
  );

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
  )
  values (
    v_context.team_season_id,
    v_context.season_day_id,
    coalesce(v_context.current_day_number, 1),
    -v_total_price,
    'training',
    'posted',
    case when p_camp_type = 'premium' then 'Stage de forme premium' else 'Stage de forme classique' end,
    'form-camp:' || v_camp_id::text,
    now()
  );

  return v_camp_id;
end;
$$;

-- Contrôle central : aucune écriture directe ne peut contourner les indisponibilités.
create or replace function public.enforce_rider_health_availability_on_roster()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_edition_id uuid;
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

  if exists (
    select 1
    from public.rider_form_camps as camp
    join public.race_editions as edition on edition.id = v_edition_id
    join public.stages as stage on stage.race_edition_id = edition.id
    join public.season_days as day on day.id = stage.season_day_id
    where camp.rider_id = new.rider_id
      and camp.season_id = edition.season_id
      and camp.status <> 'cancelled'
      and day.day_number between camp.start_day_number and camp.end_day_number
  ) then
    raise exception 'Ce coureur participe à un stage de remise en forme pendant cette course.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_rider_health_availability_on_roster
on public.race_rosters;

create trigger enforce_rider_health_availability_on_roster
before insert or update of rider_id, status
on public.race_rosters
for each row
execute function public.enforce_rider_health_availability_on_roster();

create or replace function public.get_stage_eligible_race_rosters(
  p_stage_id uuid
)
returns table (
  race_roster_id uuid,
  rider_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select roster.id, roster.rider_id
  from public.stages target_stage
  join public.season_days target_day on target_day.id = target_stage.season_day_id
  join public.race_editions target_edition
    on target_edition.id = target_stage.race_edition_id
  join public.race_registrations registration
    on registration.race_edition_id = target_stage.race_edition_id
   and registration.status = 'accepted'
  join public.race_rosters roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  where target_stage.id = p_stage_id
    and not exists (
      select 1
      from public.stage_results previous_result
      join public.stages previous_stage
        on previous_stage.id = previous_result.stage_id
      where previous_result.race_roster_id = roster.id
        and previous_stage.race_edition_id = target_stage.race_edition_id
        and previous_stage.stage_number < target_stage.stage_number
        and previous_result.status in (
          'did_not_finish',
          'disqualified',
          'outside_time_limit'
        )
    )
    and not exists (
      select 1
      from public.rider_injuries injury
      where injury.rider_id = roster.rider_id
        and injury.started_at < coalesce(target_stage.departure_at, now()) + interval '8 hours'
        and injury.expected_recovery_at > coalesce(target_stage.departure_at, now())
    )
    and not exists (
      select 1
      from public.rider_form_camps camp
      where camp.rider_id = roster.rider_id
        and camp.season_id = target_edition.season_id
        and camp.status <> 'cancelled'
        and target_day.day_number between camp.start_day_number and camp.end_day_number
    );
$$;

drop function if exists public.get_current_team_race_roster_options(uuid);

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
  with current_context as (
    select
      assignment.team_id,
      edition.season_id,
      season.game_year,
      registration.id as registration_id,
      min(day.day_number)::integer as target_start_day,
      max(day.day_number)::integer as target_end_day,
      min(
        coalesce(
          stage.departure_at,
          ((day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
        )
      ) as target_start_at
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.race_editions as edition on edition.id = p_race_edition_id
    join public.seasons as season on season.id = edition.season_id
    join public.stages as stage on stage.race_edition_id = edition.id
    join public.season_days as day on day.id = stage.season_day_id
    left join public.team_seasons as team_season
      on team_season.team_id = assignment.team_id
     and team_season.season_id = edition.season_id
    left join public.race_registrations as registration
      on registration.team_season_id = team_season.id
     and registration.race_edition_id = edition.id
    where director.auth_user_id = auth.uid()
    group by assignment.team_id, edition.season_id, season.game_year, registration.id
    limit 1
  )
  select
    rider.id,
    rider.first_name,
    rider.last_name,
    country.name,
    country.iso_alpha2,
    rider.avatar_profile_key,
    rider.avatar_seed,
    rating.age::integer,
    rating.mountain::integer,
    rating.hills::integer,
    rating.flat::integer,
    rating.time_trial::integer,
    rating.cobbles::integer,
    rating.sprint::integer,
    coalesce(current_roster.status in ('selected', 'confirmed'), false),
    medical.injury_id is null and camp.camp_id is null and conflict.race_slug is null,
    case
      when medical.injury_id is not null then 'injury'
      when camp.camp_id is not null then 'form_camp'
      when conflict.race_slug is not null then 'race'
      else null
    end,
    coalesce(medical.label, camp.label),
    coalesce(medical.expected_recovery_at, camp.ends_at),
    conflict.race_slug,
    conflict.race_name,
    conflict.start_day,
    conflict.end_day
  from current_context as context
  join public.rider_contracts as contract
    on contract.team_id = context.team_id
   and contract.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
   and start_season.game_year <= context.game_year
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
   and end_season.game_year >= context.game_year
  join public.riders as rider
    on rider.id = contract.rider_id
   and rider.status = 'active'
  join public.countries as country on country.id = rider.country_id
  join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = context.season_id
  left join public.race_rosters as current_roster
    on current_roster.race_registration_id = context.registration_id
   and current_roster.rider_id = rider.id
  left join lateral (
    select
      injury.id as injury_id,
      case injury.diagnosis_code
        when 'rib_fracture' then 'Fracture des côtes'
        when 'wrist_fracture' then 'Fracture du poignet'
        when 'clavicle_fracture' then 'Fracture de la clavicule'
        else 'Blessure en cours'
      end as label,
      injury.expected_recovery_at
    from public.rider_injuries as injury
    where injury.rider_id = rider.id
      and injury.expected_recovery_at > context.target_start_at
      and injury.started_at < context.target_start_at + interval '8 hours'
    order by injury.expected_recovery_at desc
    limit 1
  ) as medical on true
  left join lateral (
    select
      form_camp.id as camp_id,
      case form_camp.camp_type
        when 'premium' then 'Stage de forme premium'
        else 'Stage de forme classique'
      end || ' · J' || form_camp.start_day_number || '–J' || form_camp.end_day_number as label,
      ((end_day.calendar_date::timestamp + interval '1 day') at time zone 'Europe/Paris') as ends_at
    from public.rider_form_camps as form_camp
    join public.season_days as end_day
      on end_day.season_id = form_camp.season_id
     and end_day.day_number = form_camp.end_day_number
    where form_camp.rider_id = rider.id
      and form_camp.season_id = context.season_id
      and form_camp.status <> 'cancelled'
      and form_camp.start_day_number <= context.target_end_day
      and form_camp.end_day_number >= context.target_start_day
    limit 1
  ) as camp on true
  left join lateral (
    select
      race.slug as race_slug,
      other_edition.display_name as race_name,
      min(other_day.day_number)::integer as start_day,
      max(other_day.day_number)::integer as end_day
    from public.race_rosters as other_roster
    join public.race_registrations as other_registration
      on other_registration.id = other_roster.race_registration_id
     and other_registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = other_registration.race_edition_id
     and other_edition.season_id = context.season_id
     and other_edition.id <> p_race_edition_id
    join public.races as race on race.id = other_edition.race_id
    join public.stages as other_stage on other_stage.race_edition_id = other_edition.id
    join public.season_days as other_day on other_day.id = other_stage.season_day_id
    where other_roster.rider_id = rider.id
      and other_roster.status in ('selected', 'confirmed')
      and other_day.day_number between context.target_start_day and context.target_end_day
    group by race.slug, other_edition.display_name
    order by min(other_day.day_number)
    limit 1
  ) as conflict on true
  order by rider.last_name, rider.first_name;
$$;

revoke all on function public.settle_current_health_and_form() from public, anon;
revoke all on function public.apply_current_team_injury_protocol(uuid, text) from public, anon;
revoke all on function public.book_current_team_form_camp(uuid, text, integer) from public, anon;
revoke all on function public.get_current_team_race_roster_options(uuid) from public, anon;

grant execute on function public.settle_current_health_and_form()
  to authenticated, service_role;
grant execute on function public.apply_current_team_injury_protocol(uuid, text)
  to authenticated;
grant execute on function public.book_current_team_form_camp(uuid, text, integer)
  to authenticated;
grant execute on function public.get_current_team_race_roster_options(uuid)
  to authenticated;

grant all privileges on table public.medical_protocol_catalog to service_role;
grant all privileges on table public.rider_injury_treatments to service_role;
grant all privileges on table public.rider_form_camps to service_role;
grant all privileges on table public.rider_daily_condition_effects to service_role;
grant all privileges on table public.rider_injury_form_effects to service_role;

comment on function public.settle_current_health_and_form() is
  'Applique une seule fois le repos, les stages et les pénalités médicales arrivés à échéance.';
comment on function public.book_current_team_form_camp(uuid, text, integer) is
  'Planifie un stage individuel dès le lendemain, bloque les conflits et débite sa totalité.';

commit;
