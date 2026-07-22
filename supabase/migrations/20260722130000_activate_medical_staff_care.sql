begin;

create table public.rider_nutrition_interventions (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  season_day_id uuid not null references public.season_days(id) on delete cascade,
  nutritionist_contract_id uuid not null
    references public.staff_contracts(id) on delete restrict,
  intervention_code text not null,
  nutritionist_level smallint not null,
  base_form_gain smallint not null,
  level_form_bonus smallint not null,
  actual_form_gain smallint not null,
  base_price numeric(12, 2) not null,
  price_paid numeric(12, 2) not null,
  form_before smallint not null,
  form_after smallint not null,
  applied_at timestamptz not null default now(),

  constraint rider_nutrition_interventions_one_per_day
    unique (rider_id, season_day_id),
  constraint rider_nutrition_interventions_code_allowed check (
    intervention_code in ('recovery_snack', 'tailored_plan', 'elite_recharge')
  ),
  constraint rider_nutrition_interventions_level_range check (
    nutritionist_level between 1 and 5
  ),
  constraint rider_nutrition_interventions_gain_range check (
    base_form_gain between 1 and 10
    and level_form_bonus between 0 and 2
    and actual_form_gain between 0 and 10
  ),
  constraint rider_nutrition_interventions_price_range check (
    base_price > 0 and price_paid > 0 and price_paid <= base_price
  ),
  constraint rider_nutrition_interventions_form_range check (
    form_before between 0 and 100 and form_after between 0 and 100
  )
);

create index rider_nutrition_interventions_team_day_idx
  on public.rider_nutrition_interventions (
    team_season_id,
    season_day_id,
    nutritionist_contract_id
  );

alter table public.rider_nutrition_interventions enable row level security;

create policy rider_nutrition_interventions_read_managed_team
on public.rider_nutrition_interventions
for select
to authenticated
using (
  exists (
    select 1
    from public.team_manager_assignments as assignment
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
    join public.team_seasons as team_season
      on team_season.team_id = assignment.team_id
    where team_season.id = rider_nutrition_interventions.team_season_id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
      and director.auth_user_id = auth.uid()
      and director.status = 'active'
  )
);

create or replace function public.get_nutritionist_daily_capacity(
  p_level integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select (array[2, 3, 4, 5, 6]::integer[])[
    least(5, greatest(1, coalesce(p_level, 1)))
  ];
$$;

alter table public.rider_daily_condition_effects
  add column nutritionist_level smallint not null default 0,
  add column nutritionist_form_bonus smallint not null default 0,
  add constraint rider_daily_condition_effects_nutritionist_level_range check (
    nutritionist_level between 0 and 5
  ),
  add constraint rider_daily_condition_effects_nutritionist_bonus_range check (
    nutritionist_form_bonus between 0 and 1
  );

alter table public.rider_injury_form_effects
  add column physiotherapist_level smallint not null default 0,
  add column physiotherapist_form_protection smallint not null default 0,
  add constraint rider_injury_form_effects_physio_level_range check (
    physiotherapist_level between 0 and 5
  ),
  add constraint rider_injury_form_effects_physio_protection_range check (
    physiotherapist_form_protection between 0 and 5
  );

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

  if v_team_id is null then
    return new;
  end if;

  select day.day_number
  into v_day_number
  from public.season_days as day
  where day.id = new.season_day_id;

  v_level := public.get_active_team_staff_level(v_team_id, 'nutritionist');
  if v_level <= 0 or v_day_number is null then
    return new;
  end if;

  -- Le gain moyen de niveau / 5 est réparti sans décimales perdues.
  v_bonus := floor(v_day_number * v_level / 5.0)::integer
    - floor((v_day_number - 1) * v_level / 5.0)::integer;
  v_bonus := least(
    v_bonus,
    greatest(0, 10 - new.form_delta),
    greatest(0, 100 - new.form_after)
  );

  new.nutritionist_level := v_level;
  new.nutritionist_form_bonus := v_bonus;
  new.form_delta := new.form_delta + v_bonus;
  new.form_after := least(100, new.form_after + v_bonus);
  return new;
end;
$$;

create trigger rider_daily_recovery_nutritionist_bonus
before insert
on public.rider_daily_condition_effects
for each row execute function public.apply_nutritionist_to_daily_recovery_effect();

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
    v_level,
    greatest(0, new.form_before - new.form_after - 1)
  );
  new.physiotherapist_level := v_level;
  new.physiotherapist_form_protection := v_protection;
  new.form_delta := new.form_delta + v_protection;
  new.form_after := least(100, new.form_after + v_protection);
  return new;
end;
$$;

create trigger rider_injury_form_assigned_physio_reduction
before insert
on public.rider_injury_form_effects
for each row execute function public.apply_physio_to_injury_form_effect();

create or replace function public.sync_medical_staff_condition_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bonus integer := 0;
begin
  if new.source in ('rest', 'form_camp') then
    select coalesce(effect.nutritionist_form_bonus, 0)
    into v_bonus
    from public.season_days as state_day
    join public.season_days as effect_day
      on effect_day.season_id = state_day.season_id
     and effect_day.day_number = state_day.day_number - 1
    join public.rider_daily_condition_effects as effect
      on effect.season_day_id = effect_day.id
     and effect.rider_id = new.rider_id
    where state_day.id = new.season_day_id
    limit 1;
  elsif new.source = 'injury' then
    select coalesce(effect.physiotherapist_form_protection, 0)
    into v_bonus
    from public.rider_injury_form_effects as effect
    where effect.rider_id = new.rider_id
      and effect.season_day_id = new.season_day_id
    order by effect.applied_at desc
    limit 1;
  end if;

  new.form := least(100, new.form + coalesce(v_bonus, 0));
  return new;
end;
$$;

create trigger rider_condition_apply_medical_staff
before insert or update of form, source
on public.rider_condition_states
for each row execute function public.sync_medical_staff_condition_effects();

create or replace function public.apply_current_team_nutrition_intervention(
  p_rider_id uuid,
  p_intervention_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_nutritionist record;
  v_intervention_id uuid := gen_random_uuid();
  v_minimum_level integer;
  v_base_gain integer;
  v_level_bonus integer;
  v_actual_gain integer;
  v_base_price numeric(12, 2);
  v_price numeric(12, 2);
  v_form_before integer;
  v_form_after integer;
  v_fatigue integer;
begin
  if p_rider_id is null then
    raise exception 'Le coureur est obligatoire.';
  end if;

  if p_intervention_code = 'recovery_snack' then
    v_minimum_level := 1;
    v_base_gain := 3;
    v_base_price := 1500;
  elsif p_intervention_code = 'tailored_plan' then
    v_minimum_level := 3;
    v_base_gain := 5;
    v_base_price := 3500;
  elsif p_intervention_code = 'elite_recharge' then
    v_minimum_level := 5;
    v_base_gain := 7;
    v_base_price := 6500;
  else
    raise exception 'Cette intervention nutritionnelle est invalide.';
  end if;

  perform public.settle_current_team_finances();
  perform public.settle_current_health_and_form();

  select
    assignment.team_id,
    team_season.id as team_season_id,
    team_season.cash_balance,
    team_season.currency,
    season.id as season_id,
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
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  join public.rider_contracts as rider_contract
    on rider_contract.team_id = assignment.team_id
   and rider_contract.rider_id = p_rider_id
   and rider_contract.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Ce coureur ne fait pas partie de votre effectif actif.';
  end if;

  perform 1
  from public.team_seasons
  where id = v_context.team_season_id
  for update;

  if exists (
    select 1
    from public.rider_nutrition_interventions as intervention
    where intervention.rider_id = p_rider_id
      and intervention.season_day_id = v_context.season_day_id
  ) then
    raise exception 'Ce coureur a déjà bénéficié d’une intervention nutritionnelle aujourd’hui.';
  end if;

  select contract.id, member.level, member.first_name, member.last_name
  into v_nutritionist
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'nutritionist'
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
    and member.level >= v_minimum_level
    and (
      select count(*)
      from public.rider_nutrition_interventions as used
      where used.nutritionist_contract_id = contract.id
        and used.season_day_id = v_context.season_day_id
    ) < public.get_nutritionist_daily_capacity(member.level)
  order by member.level desc, contract.signed_at
  limit 1
  for update of contract;

  if v_nutritionist is null then
    if public.get_active_team_staff_level(v_context.team_id, 'nutritionist') = 0 then
      raise exception 'Recrutez un nutritionniste pour utiliser cette intervention.';
    end if;
    raise exception 'Aucun nutritionniste disponible ne possède le niveau requis ou une capacité restante aujourd’hui.';
  end if;

  select state.form, state.fatigue
  into v_form_before, v_fatigue
  from public.rider_condition_states as state
  join public.season_days as state_day on state_day.id = state.season_day_id
  where state.rider_id = p_rider_id
    and state_day.season_id = v_context.season_id
    and state_day.day_number <= v_context.current_day_number
  order by state_day.day_number desc, state.updated_at desc
  limit 1;

  v_form_before := coalesce(v_form_before, 75);
  v_fatigue := coalesce(v_fatigue, 0);
  if v_form_before >= 100 then
    raise exception 'La forme de ce coureur est déjà au maximum.';
  end if;

  v_level_bonus := floor((v_nutritionist.level - 1) / 2.0)::integer;
  v_actual_gain := least(100 - v_form_before, v_base_gain + v_level_bonus);
  v_form_after := v_form_before + v_actual_gain;
  v_price := round(v_base_price * (100 - v_nutritionist.level * 5) / 100.0, 2);

  if v_context.cash_balance < v_price then
    raise exception 'La trésorerie de l’équipe est insuffisante pour cette intervention.';
  end if;

  insert into public.rider_nutrition_interventions (
    id,
    rider_id,
    team_season_id,
    season_day_id,
    nutritionist_contract_id,
    intervention_code,
    nutritionist_level,
    base_form_gain,
    level_form_bonus,
    actual_form_gain,
    base_price,
    price_paid,
    form_before,
    form_after
  ) values (
    v_intervention_id,
    p_rider_id,
    v_context.team_season_id,
    v_context.season_day_id,
    v_nutritionist.id,
    p_intervention_code,
    v_nutritionist.level,
    v_base_gain,
    v_level_bonus,
    v_actual_gain,
    v_base_price,
    v_price,
    v_form_before,
    v_form_after
  );

  insert into public.rider_condition_states (
    rider_id,
    season_day_id,
    form,
    fatigue,
    source
  ) values (
    p_rider_id,
    v_context.season_day_id,
    v_form_after,
    v_fatigue,
    'nutrition'
  )
  on conflict (rider_id, season_day_id)
  do update set
    form = least(100, public.rider_condition_states.form + v_actual_gain),
    fatigue = public.rider_condition_states.fatigue,
    source = 'nutrition',
    updated_at = now();

  update public.team_seasons
  set cash_balance = cash_balance - v_price
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
    -v_price,
    'medical_care',
    'posted',
    case p_intervention_code
      when 'recovery_snack' then 'Collation de récupération'
      when 'tailored_plan' then 'Plan nutritionnel personnalisé'
      else 'Recharge haute performance'
    end || ' · ' || v_nutritionist.first_name || ' ' || v_nutritionist.last_name,
    'nutrition-intervention:' || v_intervention_id::text,
    now()
  );

  return v_intervention_id;
end;
$$;

grant select on table public.rider_nutrition_interventions to authenticated;
grant all privileges on table public.rider_nutrition_interventions to service_role;

revoke all on function public.apply_current_team_nutrition_intervention(uuid, text)
  from public, anon;
grant execute on function public.apply_current_team_nutrition_intervention(uuid, text)
  to authenticated;

comment on table public.rider_nutrition_interventions is
  'Interventions ponctuelles de forme réalisées par les nutritionnistes, limitées à une par coureur et par jour.';
comment on function public.apply_current_team_nutrition_intervention(uuid, text) is
  'Applique une intervention nutritionnelle, contrôle le niveau et la capacité du spécialiste, puis débite atomiquement l’équipe.';

notify pgrst, 'reload schema';

commit;
