begin;

-- ============================================================
-- TALENTS DE STAFF
-- Les staffs historiques restent volontairement sans talent.
-- Les trois emplacements préparent les extensions du bâtiment des métiers.
-- ============================================================

create table public.staff_talent_catalog (
  code text primary key,
  role text not null,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint staff_talent_catalog_code_format
    check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint staff_talent_catalog_role_allowed check (
    role in (
      'trainer', 'scout', 'doctor', 'mechanic', 'community_manager',
      'nutritionist', 'physiotherapist', 'race_preparer', 'architect'
    )
  ),
  constraint staff_talent_catalog_name_not_empty
    check (btrim(display_name) <> '')
);

insert into public.staff_talent_catalog (code, role, display_name)
values
  ('physio_race_recovery', 'physiotherapist', 'Récupération après course'),
  ('physio_training_recovery', 'physiotherapist', 'Récupération après entraînement'),
  ('physio_injury_prevention', 'physiotherapist', 'Prévention des blessures'),
  ('mechanic_incident_time', 'mechanic', 'Intervention express'),
  ('mechanic_wheel_efficiency', 'mechanic', 'Expert roues'),
  ('mechanic_frame_efficiency', 'mechanic', 'Expert cadres'),
  ('architect_construction_time', 'architect', 'Chantiers accélérés'),
  ('architect_construction_cost', 'architect', 'Achats optimisés'),
  ('architect_maintenance_cost', 'architect', 'Maintenance raisonnée'),
  ('community_victory_reputation', 'community_manager', 'Victoire médiatisée'),
  ('community_breakaway_reputation', 'community_manager', 'Échappées valorisées'),
  ('community_daily_reputation', 'community_manager', 'Présence quotidienne'),
  ('scout_report_size', 'scout', 'Carnet d’adresses'),
  ('scout_youth_talent', 'scout', 'Œil pour le talent'),
  ('scout_youth_ratings', 'scout', 'Évaluation précise'),
  ('scout_tuition_cost', 'scout', 'Réseau de formation'),
  ('trainer_mountain', 'trainer', 'Domaine montagne'),
  ('trainer_hills', 'trainer', 'Domaine vallons'),
  ('trainer_flat', 'trainer', 'Domaine plaine'),
  ('trainer_sprint', 'trainer', 'Domaine sprint'),
  ('trainer_time_trial', 'trainer', 'Domaine chrono et prologue'),
  ('trainer_cobbles', 'trainer', 'Domaine pavés'),
  ('trainer_endurance', 'trainer', 'Domaine endurance et récupération'),
  ('preparer_duration', 'race_preparer', 'Préparation express'),
  ('preparer_quality', 'race_preparer', 'Repérage minutieux'),
  ('preparer_capacity', 'race_preparer', 'Groupe élargi'),
  ('nutrition_daily_form', 'nutritionist', 'Suivi quotidien'),
  ('nutrition_supplement_cost', 'nutritionist', 'Achats de compléments'),
  ('nutrition_supplement_effectiveness', 'nutritionist', 'Compléments optimisés'),
  ('nutrition_supplement_capacity', 'nutritionist', 'Suivi collectif'),
  ('doctor_recovery_time', 'doctor', 'Diagnostic précoce'),
  ('doctor_care_effectiveness', 'doctor', 'Protocoles renforcés'),
  ('doctor_care_cost', 'doctor', 'Réseau médical'),
  ('doctor_injury_form_loss', 'doctor', 'Maintien de la condition');

create table public.staff_member_talents (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null
    references public.staff_members(id) on delete cascade,
  slot_number smallint not null,
  talent_code text not null
    references public.staff_talent_catalog(code) on delete restrict,
  unlocked_by text not null default 'generation',
  created_at timestamptz not null default now(),
  constraint staff_member_talents_slot_range
    check (slot_number between 1 and 3),
  constraint staff_member_talents_slot_unique
    unique (staff_member_id, slot_number),
  constraint staff_member_talents_code_unique
    unique (staff_member_id, talent_code),
  constraint staff_member_talents_source_allowed
    check (unlocked_by in ('generation', 'professions_building'))
);

create index staff_member_talents_code_idx
  on public.staff_member_talents (talent_code, staff_member_id);

create or replace function public.validate_staff_member_talent_role()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_member_role text;
  v_talent_role text;
begin
  select role into v_member_role
  from public.staff_members
  where id = new.staff_member_id;

  select role into v_talent_role
  from public.staff_talent_catalog
  where code = new.talent_code and is_active;

  if v_member_role is null
    or v_talent_role is null
    or v_member_role <> v_talent_role then
    raise exception 'Ce talent ne correspond pas au métier du membre du staff.';
  end if;

  return new;
end;
$$;

create trigger staff_member_talents_validate_role
before insert or update of staff_member_id, talent_code
on public.staff_member_talents
for each row execute function public.validate_staff_member_talent_role();

alter table public.staff_talent_catalog enable row level security;
alter table public.staff_member_talents enable row level security;

create policy staff_talent_catalog_read_authenticated
on public.staff_talent_catalog
for select to authenticated
using (true);

create policy staff_member_talents_read_authenticated
on public.staff_member_talents
for select to authenticated
using (true);

grant select on table public.staff_talent_catalog to authenticated;
grant select on table public.staff_member_talents to authenticated;
grant all privileges on table public.staff_talent_catalog to service_role;
grant all privileges on table public.staff_member_talents to service_role;

-- ============================================================
-- AFFINITÉ NATIONALE ET VALEURS RÉUTILISABLES
-- ============================================================

create or replace function public.get_staff_contract_nationality_multiplier(
  p_contract_id uuid,
  p_rider_id uuid default null
)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.staff_contracts as contract
      join public.staff_members as member
        on member.id = contract.staff_member_id
      left join public.riders as rider
        on rider.id = p_rider_id
      left join public.seasons as season
        on season.status = 'active'
      left join public.team_seasons as team_season
        on team_season.team_id = contract.team_id
       and team_season.season_id = season.id
      where contract.id = p_contract_id
        and contract.status = 'active'
        and member.country_id = case
          when member.role = 'trainer' and p_rider_id is not null
            then rider.country_id
          else team_season.registration_country_id
        end
    ) then 1.10
    else 1.00
  end::numeric;
$$;

create or replace function public.get_active_team_staff_base_strength(
  p_team_id uuid,
  p_role text,
  p_points_per_level numeric
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(
    member.level
    * p_points_per_level
    * case
        when member.country_id = team_season.registration_country_id
          then 1.10
        else 1.00
      end
  ), 0)::numeric
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
   and team_season.season_id = season.id
  where contract.team_id = p_team_id
    and contract.status = 'active'
    and member.role = p_role;
$$;

create or replace function public.get_active_team_staff_talent_strength(
  p_team_id uuid,
  p_talent_code text,
  p_points_per_level numeric
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(
    member.level
    * p_points_per_level
    * case
        when member.country_id = team_season.registration_country_id
          then 1.10
        else 1.00
      end
  ), 0)::numeric
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
  join public.staff_member_talents as talent
    on talent.staff_member_id = member.id
   and talent.talent_code = p_talent_code
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
   and team_season.season_id = season.id
  where contract.team_id = p_team_id
    and contract.status = 'active';
$$;

create or replace function public.get_staff_contract_talent_percentage(
  p_contract_id uuid,
  p_talent_code text,
  p_points_per_level numeric,
  p_rider_id uuid default null
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce((
    select member.level
      * p_points_per_level
      * public.get_staff_contract_nationality_multiplier(
          contract.id,
          p_rider_id
        )
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
    join public.staff_member_talents as talent
      on talent.staff_member_id = member.id
     and talent.talent_code = p_talent_code
    where contract.id = p_contract_id
      and contract.status = 'active'
    limit 1
  ), 0)::numeric;
$$;

create or replace function public.get_staff_contract_talent_flat_bonus(
  p_contract_id uuid,
  p_talent_code text,
  p_bonus integer
)
returns integer
language sql
stable
set search_path = public
as $$
  select case when exists (
    select 1
    from public.staff_contracts as contract
    join public.staff_member_talents as talent
      on talent.staff_member_id = contract.staff_member_id
     and talent.talent_code = p_talent_code
    where contract.id = p_contract_id
      and contract.status = 'active'
  ) then greatest(0, p_bonus) else 0 end;
$$;

create or replace function public.get_rider_physio_form_protection(
  p_team_id uuid,
  p_rider_id uuid,
  p_source text
)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(round(sum(
    (
      member.level
      + case
          when p_source = 'race' and exists (
            select 1 from public.staff_member_talents as talent
            where talent.staff_member_id = member.id
              and talent.talent_code = 'physio_race_recovery'
          ) then 1
          when p_source = 'training' and exists (
            select 1 from public.staff_member_talents as talent
            where talent.staff_member_id = member.id
              and talent.talent_code = 'physio_training_recovery'
          ) then 1
          else 0
        end
    )
    * case
        when member.country_id = team_season.registration_country_id
          then 1.10
        else 1.00
      end
  )), 0)::integer
  from public.staff_rider_assignments as staff_assignment
  join public.staff_contracts as contract
    on contract.id = staff_assignment.staff_contract_id
   and contract.status = 'active'
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'physiotherapist'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
   and team_season.season_id = season.id
  where contract.team_id = p_team_id
    and staff_assignment.rider_id = p_rider_id
    and staff_assignment.status = 'active';
$$;

create or replace function public.get_trainer_talent_progress_multiplier(
  p_contract_id uuid,
  p_rider_id uuid,
  p_stat_code text
)
returns numeric
language sql
stable
set search_path = public
as $$
  select (1 + coalesce((
    select member.level
      * 0.04
      * public.get_staff_contract_nationality_multiplier(
          contract.id,
          p_rider_id
        )
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'trainer'
    join public.staff_member_talents as talent
      on talent.staff_member_id = member.id
    where contract.id = p_contract_id
      and contract.status = 'active'
      and (
        (talent.talent_code = 'trainer_mountain' and p_stat_code = 'mountain')
        or (talent.talent_code = 'trainer_hills' and p_stat_code = 'hills')
        or (talent.talent_code = 'trainer_flat' and p_stat_code = 'flat')
        or (
          talent.talent_code = 'trainer_sprint'
          and p_stat_code = any(array['sprint', 'acceleration'])
        )
        or (
          talent.talent_code = 'trainer_time_trial'
          and p_stat_code = any(array['time_trial', 'prologue'])
        )
        or (talent.talent_code = 'trainer_cobbles' and p_stat_code = 'cobbles')
        or (
          talent.talent_code = 'trainer_endurance'
          and p_stat_code = any(
            array['endurance', 'resistance', 'recovery', 'breakaway', 'downhill']
          )
        )
      )
    limit 1
  ), 0))::numeric;
$$;

-- ============================================================
-- NOUVEAUX PROFILS : UN TALENT INITIAL, AUCUN RATTRAPAGE
-- ============================================================

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
  v_trainer_specialty text;
  v_architect_specialty text;
  v_talent_code text;
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
    v_trainer_specialty :=
      nullif(btrim(v_candidate ->> 'trainer_specialty'), '');
    v_architect_specialty :=
      nullif(btrim(v_candidate ->> 'architect_specialty'), '');
    v_talent_code := nullif(btrim(v_candidate ->> 'talent_code'), '');
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

    if (v_role = 'trainer' and v_trainer_specialty not in (
      'mountain', 'hills', 'flat', 'sprint', 'time_trial', 'cobbles', 'endurance'
    )) or (v_role <> 'trainer' and v_trainer_specialty is not null) then
      raise exception 'Spécialité d’entraîneur invalide à la position %.', v_slot;
    end if;

    if (v_role = 'architect' and v_architect_specialty not in (
      'economist', 'foreman', 'balanced'
    )) or (v_role <> 'architect' and v_architect_specialty is not null) then
      raise exception 'Spécialité d’architecte invalide à la position %.', v_slot;
    end if;

    if not exists (
      select 1
      from public.staff_talent_catalog as talent
      where talent.code = v_talent_code
        and talent.role = v_role
        and talent.is_active
    ) then
      raise exception 'Talent de staff invalide à la position %.', v_slot;
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
      trainer_specialty,
      architect_specialty
    ) values (
      v_country_id,
      btrim(v_candidate ->> 'first_name'),
      btrim(v_candidate ->> 'last_name'),
      v_role,
      v_level,
      v_trainer_specialty,
      v_architect_specialty
    )
    returning id into v_staff_member_id;

    insert into public.staff_member_talents (
      staff_member_id,
      slot_number,
      talent_code,
      unlocked_by
    ) values (
      v_staff_member_id,
      1,
      v_talent_code,
      'generation'
    );

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

-- ============================================================
-- ENTRAÎNEURS ET KINÉS
-- ============================================================

do $migration$
declare
  v_definition text;
  v_marker_count integer;
begin
  select pg_get_functiondef(
    'public.settle_due_training_sessions()'::regprocedure
  ) into v_definition;

  v_marker_count := (
    length(v_definition)
    - length(replace(
        v_definition,
        'v_trainer_factor := v_trainer_factor + 0.05;',
        ''
      ))
  ) / length('v_trainer_factor := v_trainer_factor + 0.05;');
  if v_marker_count <> 1 then
    raise exception 'Formule d’affinité entraîneur inattendue (% marqueurs).', v_marker_count;
  end if;
  v_definition := replace(
    v_definition,
    'v_trainer_factor := v_trainer_factor + 0.05;',
    'v_trainer_factor := v_trainer_factor + 0.10;'
  );

  v_marker_count := (
    length(v_definition)
    - length(replace(v_definition, '* v_trainer_factor', ''))
  ) / length('* v_trainer_factor');
  if v_marker_count <> 1 then
    raise exception 'Formule entraîneur inattendue (% marqueurs).', v_marker_count;
  end if;
  v_definition := replace(
    v_definition,
    '* v_trainer_factor',
    E'* v_trainer_factor\n            * public.get_trainer_talent_progress_multiplier(v_plan.trainer_contract_id, v_rider.id, v_stat.stat_code)'
  );

  v_marker_count := (
    length(v_definition)
    - length(replace(
        v_definition,
        'v_form_delta := least(-1, v_form_delta + v_physio_level);',
        ''
      ))
  ) / length('v_form_delta := least(-1, v_form_delta + v_physio_level);');
  if v_marker_count <> 1 then
    raise exception 'Formule kiné d’entraînement inattendue (% marqueurs).', v_marker_count;
  end if;
  v_definition := replace(
    v_definition,
    'v_form_delta := least(-1, v_form_delta + v_physio_level);',
    'v_form_delta := least(-1, v_form_delta + public.get_rider_physio_form_protection(v_rider.team_id, v_rider.id, ''training''));'
  );

  execute v_definition;
end;
$migration$;

alter table public.stage_rider_condition_effects
  drop constraint if exists stage_rider_condition_effects_physio_protection_range;
alter table public.stage_rider_condition_effects
  add constraint stage_rider_condition_effects_physio_protection_range
  check (physiotherapist_form_protection between 0 and 10);

create or replace function public.apply_assigned_physio_to_race_condition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_physio_level integer;
  v_protection integer;
  v_original_form_delta integer := new.form_delta;
begin
  new.physiotherapist_level := 0;
  new.physiotherapist_form_protection := 0;

  select team_season.team_id
  into v_team_id
  from public.stages as stage
  join public.race_registrations as registration
    on registration.race_edition_id = stage.race_edition_id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.rider_id = new.rider_id
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  where stage.id = new.stage_id
  limit 1;

  if v_team_id is null then
    return new;
  end if;

  v_physio_level := public.get_active_rider_physiotherapist_level(
    v_team_id,
    new.rider_id
  );
  if v_physio_level <= 0 then
    return new;
  end if;

  v_protection := public.get_rider_physio_form_protection(
    v_team_id,
    new.rider_id,
    'race'
  );
  new.form_delta := least(-1, new.form_delta + v_protection);
  new.form_after := greatest(0, new.form_before + new.form_delta);
  new.physiotherapist_level := least(5, v_physio_level);
  new.physiotherapist_form_protection := greatest(
    0,
    new.form_delta - v_original_form_delta
  );
  return new;
end;
$$;

alter table public.rider_injury_form_effects
  drop constraint if exists rider_injury_form_effects_physio_protection_range;
alter table public.rider_injury_form_effects
  add constraint rider_injury_form_effects_physio_protection_range check (
    physiotherapist_form_protection between 0 and 10
  );

create or replace function public.apply_physio_to_injury_form_effect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_level integer;
  v_protection integer;
begin
  select contract.team_id
  into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  order by contract.signed_at desc
  limit 1;

  if v_team_id is null then
    return new;
  end if;

  v_level := public.get_active_rider_physiotherapist_level(
    v_team_id,
    new.rider_id
  );
  if v_level <= 0 then
    return new;
  end if;

  v_protection := least(
    public.get_rider_physio_form_protection(v_team_id, new.rider_id, 'injury'),
    greatest(0, new.form_before - new.form_after - 1)
  );
  new.physiotherapist_level := least(5, v_level);
  new.physiotherapist_form_protection := v_protection;
  new.form_delta := new.form_delta + v_protection;
  new.form_after := least(100, new.form_after + v_protection);
  return new;
end;
$$;

-- ============================================================
-- MÉDECINS
-- ============================================================

create or replace function public.apply_team_doctor_to_new_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_reduction_percentage numeric;
  v_reduction_hours integer;
  v_form_protection integer;
begin
  select contract.team_id
  into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  order by contract.signed_at desc
  limit 1;

  if v_team_id is null then
    return new;
  end if;

  v_reduction_percentage :=
    public.get_active_team_staff_base_strength(v_team_id, 'doctor', 6)
    + public.get_active_team_staff_talent_strength(
        v_team_id,
        'doctor_recovery_time',
        3
      );
  v_reduction_percentage := least(80, v_reduction_percentage);

  if v_reduction_percentage > 0 then
    v_reduction_hours := ceil(
      new.recovery_hours * v_reduction_percentage / 100.0
    )::integer;
    new.doctor_recovery_hours_reduced := v_reduction_hours;
    new.expected_recovery_at := new.expected_recovery_at
      - make_interval(hours => v_reduction_hours);
  end if;

  select count(*)::integer
  into v_form_protection
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'doctor'
  join public.staff_member_talents as talent
    on talent.staff_member_id = member.id
   and talent.talent_code = 'doctor_injury_form_loss'
  where contract.team_id = v_team_id
    and contract.status = 'active';

  new.form_loss_per_day := greatest(
    0,
    new.form_loss_per_day - coalesce(v_form_protection, 0)
  );
  return new;
end;
$$;

create or replace function public.get_team_doctor_protocol_price(
  p_team_season_id uuid,
  p_base_price numeric
)
returns numeric
language sql
stable
set search_path = public
as $$
  select round(
    greatest(0, p_base_price)
    * (
      1 - least(
        60,
        public.get_active_team_staff_talent_strength(
          team_season.team_id,
          'doctor_care_cost',
          3
        )
      ) / 100.0
    ),
    2
  )
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id;
$$;

create or replace function public.get_team_doctor_protocol_effectiveness(
  p_team_season_id uuid,
  p_base_percentage numeric
)
returns numeric
language sql
stable
set search_path = public
as $$
  select least(
    90,
    greatest(0, p_base_percentage)
      + public.get_active_team_staff_talent_strength(
          team_season.team_id,
          'doctor_care_effectiveness',
          3
        )
  )
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id;
$$;

create or replace function public.get_team_doctor_protocol_form_loss(
  p_team_season_id uuid,
  p_base_form_loss integer
)
returns integer
language sql
stable
set search_path = public
as $$
  select greatest(
    0,
    p_base_form_loss - (
      select count(*)::integer
      from public.staff_contracts as contract
      join public.staff_members as member
        on member.id = contract.staff_member_id
       and member.role = 'doctor'
      join public.staff_member_talents as talent
        on talent.staff_member_id = member.id
       and talent.talent_code = 'doctor_injury_form_loss'
      where contract.team_id = team_season.team_id
        and contract.status = 'active'
    )
  )
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id;
$$;

do $migration$
declare
  v_definition text;
  v_count integer;
begin
  select pg_get_functiondef(
    'public.apply_current_team_injury_protocol(uuid,text)'::regprocedure
  ) into v_definition;

  v_count := (
    length(v_definition) - length(replace(v_definition, 'v_protocol.price', ''))
  ) / length('v_protocol.price');
  if v_count <> 4 then
    raise exception 'Formule de coût des soins inattendue (% marqueurs).', v_count;
  end if;
  v_definition := replace(
    v_definition,
    'v_protocol.price',
    'public.get_team_doctor_protocol_price(v_context.team_season_id, v_protocol.price)'
  );

  v_count := (
    length(v_definition)
    - length(replace(
        v_definition,
        'v_context.recovery_hours * v_protocol.duration_reduction_pct / 100.0',
        ''
      ))
  ) / length('v_context.recovery_hours * v_protocol.duration_reduction_pct / 100.0');
  if v_count <> 1 then
    raise exception 'Formule d’efficacité des soins inattendue (% marqueurs).', v_count;
  end if;
  v_definition := replace(
    v_definition,
    'v_context.recovery_hours * v_protocol.duration_reduction_pct / 100.0',
    'v_context.recovery_hours * public.get_team_doctor_protocol_effectiveness(v_context.team_season_id, v_protocol.duration_reduction_pct) / 100.0'
  );

  v_count := (
    length(v_definition)
    - length(replace(
        v_definition,
        'form_loss_per_day = v_protocol.form_loss_per_day',
        ''
      ))
  ) / length('form_loss_per_day = v_protocol.form_loss_per_day');
  if v_count <> 1 then
    raise exception 'Formule de forme des soins inattendue (% marqueurs).', v_count;
  end if;
  v_definition := replace(
    v_definition,
    'form_loss_per_day = v_protocol.form_loss_per_day',
    'form_loss_per_day = public.get_team_doctor_protocol_form_loss(v_context.team_season_id, v_protocol.form_loss_per_day)'
  );

  execute v_definition;
end;
$migration$;

-- ============================================================
-- NUTRITIONNISTES
-- ============================================================

create or replace function public.get_nutritionist_intervention_price(
  p_contract_id uuid,
  p_base_price numeric,
  p_level integer
)
returns numeric
language sql
stable
set search_path = public
as $$
  select greatest(0, p_base_price) * (
    1 - least(
      70,
      (
        greatest(0, p_level) * 5
        * public.get_staff_contract_nationality_multiplier(p_contract_id)
      )
      + public.get_staff_contract_talent_percentage(
          p_contract_id,
          'nutrition_supplement_cost',
          2
        )
    ) / 100.0
  );
$$;

create or replace function public.apply_nutritionist_to_daily_recovery_effect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_day_number integer;
  v_level integer;
  v_effective_level numeric;
  v_talent_active boolean;
  v_bonus integer;
begin
  if new.effect_type not in ('rest', 'form_camp') then
    return new;
  end if;

  select contract.team_id
  into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  order by contract.signed_at desc
  limit 1;

  select day.day_number
  into v_day_number
  from public.season_days as day
  where day.id = new.season_day_id;

  v_level := public.get_active_team_staff_level(v_team_id, 'nutritionist');
  v_effective_level := public.get_active_team_staff_base_strength(
    v_team_id,
    'nutritionist',
    1
  );
  v_talent_active :=
    public.get_active_team_staff_talent_strength(
      v_team_id,
      'nutrition_daily_form',
      1
    ) > 0;

  if v_level <= 0 or v_day_number is null then
    return new;
  end if;

  v_bonus := floor(v_day_number * v_effective_level / 5.0)::integer
    - floor((v_day_number - 1) * v_effective_level / 5.0)::integer;
  if v_talent_active then
    v_bonus := greatest(1, v_bonus);
  end if;
  v_bonus := least(
    1,
    v_bonus,
    greatest(0, 10 - new.form_delta),
    greatest(0, 100 - new.form_after)
  );

  new.nutritionist_level := least(5, v_level);
  new.nutritionist_form_bonus := v_bonus;
  new.form_delta := new.form_delta + v_bonus;
  new.form_after := least(100, new.form_after + v_bonus);
  return new;
end;
$$;

do $migration$
declare
  v_definition text;
  v_count integer;
begin
  select pg_get_functiondef(
    'public.apply_current_team_nutrition_intervention(uuid,uuid,text)'::regprocedure
  ) into v_definition;

  v_count := (
    length(v_definition)
    - length(replace(
        v_definition,
        'public.get_nutritionist_daily_capacity(' || chr(10) ||
          '    v_nutritionist.level' || chr(10) || '  )',
        ''
      ))
  ) / length(
    'public.get_nutritionist_daily_capacity(' || chr(10) ||
      '    v_nutritionist.level' || chr(10) || '  )'
  );
  if v_count <> 1 then
    raise exception 'Formule de capacité nutrition inattendue (% marqueurs).', v_count;
  end if;
  v_definition := replace(
    v_definition,
    'public.get_nutritionist_daily_capacity(' || chr(10) ||
      '    v_nutritionist.level' || chr(10) || '  )',
    'public.get_nutritionist_daily_capacity(' || chr(10) ||
      '    v_nutritionist.level' || chr(10) || '  )' ||
      ' + public.get_staff_contract_talent_flat_bonus(v_nutritionist.id, ''nutrition_supplement_capacity'', 2)'
  );

  v_count := (
    length(v_definition)
    - length(replace(v_definition, 'v_base_gain + v_level_bonus', ''))
  ) / length('v_base_gain + v_level_bonus');
  if v_count <> 1 then
    raise exception 'Formule d’efficacité nutrition inattendue (% marqueurs).', v_count;
  end if;
  v_definition := replace(
    v_definition,
    'v_base_gain + v_level_bonus',
    'v_base_gain + v_level_bonus + public.get_staff_contract_talent_flat_bonus(v_nutritionist.id, ''nutrition_supplement_effectiveness'', 1)'
  );

  v_count := (
    length(v_definition)
    - length(replace(
        v_definition,
        'v_base_price * (100 - v_nutritionist.level * 5) / 100.0',
        ''
      ))
  ) / length('v_base_price * (100 - v_nutritionist.level * 5) / 100.0');
  if v_count <> 1 then
    raise exception 'Formule de prix nutrition inattendue (% marqueurs).', v_count;
  end if;
  v_definition := replace(
    v_definition,
    'v_base_price * (100 - v_nutritionist.level * 5) / 100.0',
    'public.get_nutritionist_intervention_price(v_nutritionist.id, v_base_price, v_nutritionist.level)'
  );

  execute v_definition;
end;
$migration$;

-- ============================================================
-- COMMUNITY MANAGERS
-- ============================================================

alter table public.reward_events
  drop constraint if exists reward_events_source_type_allowed;
alter table public.reward_events
  add constraint reward_events_source_type_allowed check (
    source_type in (
      'race_result', 'stage_result', 'mountain_prime',
      'intermediate_sprint', 'secondary_classification',
      'game_objective', 'sponsor_objective', 'division_bonus',
      'special_ability', 'staff_daily'
    )
  );

create or replace function public.apply_community_manager_reputation_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_percentage numeric := 0;
  v_bonus numeric(12, 2);
begin
  if new.source_type = 'staff_daily'
    or new.team_season_id is null
    or new.sporting_director_id is null
    or coalesce(new.reputation_points, 0) <= 0 then
    return new;
  end if;

  select team_id into v_team_id
  from public.team_seasons
  where id = new.team_season_id;

  v_percentage := public.get_active_team_staff_base_strength(
    v_team_id,
    'community_manager',
    2
  );
  if new.description ilike '%victoire%' then
    v_percentage := v_percentage
      + public.get_active_team_staff_talent_strength(
          v_team_id,
          'community_victory_reputation',
          3
        );
  end if;
  if new.description ilike '%échapp%' then
    v_percentage := v_percentage
      + public.get_active_team_staff_talent_strength(
          v_team_id,
          'community_breakaway_reputation',
          3
        );
  end if;

  v_bonus := round(new.reputation_points * v_percentage / 100.0, 2);
  if v_bonus <= 0 then
    return new;
  end if;

  update public.reward_events
  set reputation_points = reputation_points + v_bonus
  where id = new.id;

  update public.sporting_directors
  set reputation_points = reputation_points + v_bonus
  where id = new.sporting_director_id;

  return new;
end;
$$;

create or replace function public.settle_current_team_staff_daily_reputation()
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_day record;
  v_amount numeric(12, 2);
  v_reward_id uuid;
  v_total numeric(12, 2) := 0;
begin
  select
    director.id as director_id,
    assignment.team_id,
    team_season.id as team_season_id,
    team_season.registration_country_id,
    season.id as season_id,
    coalesce(season.current_day_number, 1) as day_number
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
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    return 0;
  end if;

  for v_day in
    select day.day_number, day.calendar_date
    from public.season_days as day
    where day.season_id = v_context.season_id
      and day.day_number <= v_context.day_number
    order by day.day_number
  loop
    select round(coalesce(sum(
      member.level
      * 0.2
      * case
          when member.country_id = v_context.registration_country_id
            then 1.10
          else 1.00
        end
    ), 0), 2)
    into v_amount
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'community_manager'
    join public.staff_member_talents as talent
      on talent.staff_member_id = member.id
     and talent.talent_code = 'community_daily_reputation'
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
      and (greatest(contract.signed_at, talent.created_at) at time zone 'Europe/Paris')::date
        <= v_day.calendar_date;

    if v_amount <= 0 then
      continue;
    end if;

    insert into public.reward_events (
      source_reference,
      source_type,
      sporting_director_id,
      team_season_id,
      reputation_points,
      experience_points,
      cash_prize,
      uci_points,
      description
    ) values (
      'staff-daily:' || v_context.team_season_id::text || ':' || v_day.day_number::text,
      'staff_daily',
      v_context.director_id,
      v_context.team_season_id,
      v_amount,
      0,
      0,
      0,
      'Présence quotidienne du community manager · J' || v_day.day_number::text
    )
    on conflict (source_reference) do nothing
    returning id into v_reward_id;

    if v_reward_id is not null then
      update public.sporting_directors
      set reputation_points = reputation_points + v_amount
      where id = v_context.director_id;
      v_total := v_total + v_amount;
    end if;
    v_reward_id := null;
  end loop;

  return v_total;
end;
$$;
-- ============================================================
-- PRÉPARATEURS DE PARCOURS
-- ============================================================

create or replace function public.get_race_preparer_duration_days(
  p_contract_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when public.get_staff_contract_talent_flat_bonus(
      p_contract_id,
      'preparer_duration',
      1
    ) > 0 then 1
    else 2
  end;
$$;

create or replace function public.get_race_preparer_rider_capacity(
  p_contract_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  select 3 + public.get_staff_contract_talent_flat_bonus(
    p_contract_id,
    'preparer_capacity',
    2
  );
$$;

create or replace function public.get_race_preparer_bonus_percentage(
  p_contract_id uuid,
  p_level integer
)
returns numeric
language sql
stable
set search_path = public
as $$
  select
    greatest(0, p_level) * 5
      * public.get_staff_contract_nationality_multiplier(p_contract_id)
    + public.get_staff_contract_talent_percentage(
        p_contract_id,
        'preparer_quality',
        3
      );
$$;

do $migration$
declare
  v_definition text;
  v_count integer;
begin
  select pg_get_functiondef(
    'public.book_current_team_stage_reconnaissance(uuid,uuid[],integer,uuid)'::regprocedure
  ) into v_definition;

  v_count := (
    length(v_definition)
    - length(replace(
        v_definition,
        'perform public.settle_current_team_finances();',
        ''
      ))
  ) / length('perform public.settle_current_team_finances();');
  if v_count <> 1 then
    raise exception 'Point de contrôle de capacité inattendu (% marqueurs).', v_count;
  end if;
  v_definition := replace(
    v_definition,
    'perform public.settle_current_team_finances();',
    E'if cardinality(v_rider_ids) > public.get_race_preparer_rider_capacity(p_preparer_contract_id) then\n    raise exception ''Cette reconnaissance accepte % coureurs au maximum avec le préparateur choisi.'', public.get_race_preparer_rider_capacity(p_preparer_contract_id);\n  end if;\n\n  perform public.settle_current_team_finances();'
  );

  v_count := (
    length(v_definition)
    - length(replace(v_definition, 'v_end_day := v_start_day + 1;', ''))
  ) / length('v_end_day := v_start_day + 1;');
  if v_count <> 1 then
    raise exception 'Formule de durée de reconnaissance inattendue (% marqueurs).', v_count;
  end if;
  v_definition := replace(
    v_definition,
    'v_end_day := v_start_day + 1;',
    'v_end_day := v_start_day + public.get_race_preparer_duration_days(p_preparer_contract_id) - 1;'
  );
  v_definition := replace(
    v_definition,
    'La reconnaissance de deux jours doit se terminer avant le départ de la course.',
    'La reconnaissance doit se terminer avant le départ de la course.'
  );

  v_count := (
    length(v_definition)
    - length(replace(
        v_definition,
        'v_preparer_bonus := v_preparer_level * 5;',
        ''
      ))
  ) / length('v_preparer_bonus := v_preparer_level * 5;');
  if v_count <> 1 then
    raise exception 'Formule de qualité de reconnaissance inattendue (% marqueurs).', v_count;
  end if;
  v_definition := replace(
    v_definition,
    'v_preparer_bonus := v_preparer_level * 5;',
    'v_preparer_bonus := public.get_race_preparer_bonus_percentage(p_preparer_contract_id, v_preparer_level);'
  );

  execute v_definition;
end;
$migration$;

-- ============================================================
-- ARCHITECTES
-- ============================================================

alter table public.infrastructure_projects
  add column if not exists maintenance_reduction_percentage smallint
    not null default 0;
alter table public.team_infrastructures
  add column if not exists maintenance_reduction_percentage smallint
    not null default 0;
alter table public.international_youth_centers
  add column if not exists maintenance_reduction_percentage smallint
    not null default 0;

alter table public.infrastructure_projects
  add constraint infrastructure_projects_maintenance_reduction_range
  check (maintenance_reduction_percentage between 0 and 15);
alter table public.team_infrastructures
  add constraint team_infrastructures_maintenance_reduction_range
  check (maintenance_reduction_percentage between 0 and 15);
alter table public.international_youth_centers
  add constraint international_centers_maintenance_reduction_range
  check (maintenance_reduction_percentage between 0 and 15);

alter table public.infrastructure_projects
  drop constraint if exists infrastructure_projects_reductions_valid;
alter table public.infrastructure_projects
  add constraint infrastructure_projects_reductions_valid check (
    cost_reduction_percentage between 0 and 45
    and duration_reduction_percentage between 0 and 45
  );

create or replace function public.get_architect_adjusted_reduction(
  p_contract_id uuid,
  p_current_reduction integer,
  p_kind text
)
returns integer
language sql
stable
set search_path = public
as $$
  select least(
    45,
    round(
      greatest(0, p_current_reduction)
        * public.get_staff_contract_nationality_multiplier(p_contract_id)
      + case p_kind
          when 'cost' then public.get_staff_contract_talent_percentage(
            p_contract_id,
            'architect_construction_cost',
            2
          )
          when 'duration' then public.get_staff_contract_talent_percentage(
            p_contract_id,
            'architect_construction_time',
            2
          )
          else 0
        end
    )
  )::integer;
$$;

create or replace function public.apply_architect_maintenance_talent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.maintenance_reduction_percentage := least(
    15,
    round(public.get_staff_contract_talent_percentage(
      new.architect_contract_id,
      'architect_maintenance_cost',
      2
    ))::integer
  );
  return new;
end;
$$;

create trigger infrastructure_project_architect_maintenance
before insert or update of architect_contract_id
on public.infrastructure_projects
for each row execute function public.apply_architect_maintenance_talent();

create or replace function public.sync_completed_infrastructure_maintenance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'completed' then
    return new;
  end if;

  update public.team_infrastructures
  set maintenance_reduction_percentage =
    new.maintenance_reduction_percentage
  where completed_project_id = new.id;

  update public.international_youth_centers
  set maintenance_reduction_percentage =
    new.maintenance_reduction_percentage
  where completed_project_id = new.id;

  return new;
end;
$$;

create trigger infrastructure_project_sync_maintenance
after update of status
on public.infrastructure_projects
for each row execute function public.sync_completed_infrastructure_maintenance();

do $migration$
declare
  v_definition text;
  v_count integer;
begin
  select pg_get_functiondef(
    'public.start_current_team_infrastructure_project(text,uuid,uuid)'::regprocedure
  ) into v_definition;

  v_count := (
    length(v_definition)
    - length(replace(v_definition, 'v_final_cost := round(', ''))
  ) / length('v_final_cost := round(');
  if v_count <> 1 then
    raise exception 'Formule d’architecte inattendue (% marqueurs).', v_count;
  end if;
  v_definition := replace(
    v_definition,
    'v_final_cost := round(',
    E'v_cost_reduction := public.get_architect_adjusted_reduction(p_architect_contract_id, v_cost_reduction, ''cost'');\n  v_duration_reduction := public.get_architect_adjusted_reduction(p_architect_contract_id, v_duration_reduction, ''duration'');\n\n  v_final_cost := round('
  );

  execute v_definition;
end;
$migration$;

-- Les RPC de simulation conservent désormais le type de pièce dans chaque effet.
do $migration$
declare
  v_definition text;
  v_count integer;
begin
  select pg_get_functiondef(
    'public.get_race_edition_engaged_riders(uuid)'::regprocedure
  ) into v_definition;

  v_count := (
    length(v_definition)
    - length(replace(v_definition, 'end as effect_payload', ''))
  ) / length('end as effect_payload');
  if v_count <> 1 then
    raise exception 'Effets matériel de course inattendus (% marqueurs).', v_count;
  end if;

  v_definition := replace(
    v_definition,
    'end as effect_payload',
    'end || jsonb_build_object(''_slotType'', assignment.slot_type) as effect_payload'
  );
  execute v_definition;
end;
$migration$;

drop function if exists public.get_active_calendar_engaged_riders();
create function public.get_active_calendar_engaged_riders()
returns table (
  race_edition_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_id uuid,
  team_name text,
  team_primary_color text,
  team_secondary_color text,
  age integer,
  form integer,
  race_role text,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  acceleration integer,
  downhill integer,
  endurance integer,
  resistance integer,
  recovery integer,
  breakaway integer,
  prologue integer,
  equipment_effects jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    rider.id,
    rider.first_name,
    rider.last_name,
    team.id,
    team_season.display_name,
    coalesce(team.amateur_jersey_primary_color, '#176951'),
    coalesce(team.amateur_jersey_secondary_color, '#FFFDF4'),
    coalesce(rating.age, 25)::integer,
    coalesce(roster.starting_form, condition.form, 75)::integer,
    roster.race_role,
    coalesce(rating.mountain, 50)::integer,
    coalesce(rating.hills, 50)::integer,
    coalesce(rating.flat, 50)::integer,
    coalesce(rating.time_trial, 50)::integer,
    coalesce(rating.cobbles, 50)::integer,
    coalesce(rating.sprint, 50)::integer,
    coalesce(rating.acceleration, 50)::integer,
    coalesce(rating.downhill, 50)::integer,
    coalesce(rating.endurance, 50)::integer,
    coalesce(rating.resistance, 50)::integer,
    coalesce(rating.recovery, 50)::integer,
    coalesce(rating.breakaway, 50)::integer,
    coalesce(rating.prologue, 50)::integer,
    coalesce(equipment.effects, '[]'::jsonb)
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.teams as team
    on team.id = team_season.team_id
  join public.riders as rider
    on rider.id = roster.rider_id
  left join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = edition.season_id
  left join lateral (
    select state.form
    from public.rider_condition_states as state
    join public.season_days as condition_day
      on condition_day.id = state.season_day_id
     and condition_day.season_id = edition.season_id
    where state.rider_id = rider.id
      and condition_day.day_number <= coalesce(season.current_day_number, 28)
    order by condition_day.day_number desc
    limit 1
  ) as condition on true
  left join lateral (
    select jsonb_agg(resolved.effect_payload order by resolved.slot_type) as effects
    from (
      select
        assignment.slot_type,
        (
          case
            when item.acquisition_channel = 'commercial' then item.effect_payload
            else partner_effect.effect_payload
          end
        ) || jsonb_build_object('_slotType', assignment.slot_type) as effect_payload
      from public.rider_equipment_assignments as assignment
      join public.equipment_catalog_items as item
        on item.id = assignment.equipment_item_id
       and item.status = 'active'
      left join lateral (
        select effect.effect_payload
        from public.equipment_partner_item_effects as effect
        join public.equipment_partner_contracts as contract
          on contract.id = effect.contract_id
         and contract.team_id = team.id
         and contract.supplier_key = item.supplier_key
         and contract.status = 'active'
        join public.seasons as contract_start
          on contract_start.id = contract.start_season_id
        join public.seasons as contract_end
          on contract_end.id = contract.end_season_id
        where effect.equipment_item_id = item.id
          and season.game_year between contract_start.game_year and contract_end.game_year
        limit 1
      ) as partner_effect on true
      where assignment.rider_id = rider.id
        and (
          item.acquisition_channel = 'commercial'
          or partner_effect.effect_payload is not null
        )
    ) as resolved
  ) as equipment on true
  where edition.status <> 'cancelled'
  order by
    edition.id,
    team_season.display_name,
    roster.bib_number nulls last,
    rider.last_name,
    rider.first_name;
$$;

revoke all on function public.get_active_calendar_engaged_riders()
  from public, anon;
grant execute on function public.get_active_calendar_engaged_riders()
  to authenticated, service_role;

revoke all on function public.settle_current_team_staff_daily_reputation()
  from public, anon;
grant execute on function public.settle_current_team_staff_daily_reputation()
  to authenticated;

grant execute on function public.create_daily_staff_market(date, jsonb)
  to service_role;
grant execute on function public.settle_due_training_sessions()
  to authenticated, service_role;
grant execute on function public.book_current_team_stage_reconnaissance(
  uuid,
  uuid[],
  integer,
  uuid
) to authenticated;
grant execute on function public.start_current_team_infrastructure_project(
  text,
  uuid,
  uuid
) to authenticated;

comment on table public.staff_member_talents is
  'Jusqu’à trois talents persistants par membre du staff. Seuls les nouveaux profils reçoivent automatiquement le premier.';
comment on function public.get_staff_contract_nationality_multiplier(uuid, uuid) is
  'Applique +10 % lorsque le staff partage la nationalité de l’équipe, ou lorsque l’entraîneur partage celle du coureur.';

notify pgrst, 'reload schema';

commit;
