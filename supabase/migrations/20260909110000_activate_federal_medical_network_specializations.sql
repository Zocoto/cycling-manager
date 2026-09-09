begin;

alter table public.rider_injuries
  add column if not exists federal_specialization_recovery_hours_reduced smallint
    not null default 0
    check (federal_specialization_recovery_hours_reduced >= 0),
  add column if not exists federal_specialization_form_loss_reduction numeric(5, 2)
    not null default 0
    check (federal_specialization_form_loss_reduction between 0 and 10);

alter table public.rider_daily_condition_effects
  add column if not exists federal_medical_rest_bonus numeric(5, 2)
    not null default 0
    check (federal_medical_rest_bonus between 0 and 10);

create or replace function public.get_team_federal_medical_specialization_power(
  p_team_id uuid,
  p_specialization_code text
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when public.get_federation_infrastructure_specialization(
        team_season.registration_country_id,
        'federal_medical_network'
      ) = p_specialization_code
      then public.get_infrastructure_specialization_power_multiplier(
        infrastructure.level
      )
      else 0
    end
    from public.team_seasons as team_season
    join public.seasons as season
      on season.id = team_season.season_id
     and season.status = 'active'
    join public.national_federation_infrastructures as infrastructure
      on infrastructure.country_id = team_season.registration_country_id
     and infrastructure.infrastructure_code = 'federal_medical_network'
    where team_season.team_id = p_team_id
    limit 1
  ), 0)::numeric;
$$;

-- Les soins de base, les médecins, la cryothérapie puis la spécialisation
-- fédérale s'appliquent successivement sur la convalescence restante.
create or replace function public.apply_team_doctor_to_new_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_doctor_reduction_percentage numeric;
  v_federal_reduction_percentage numeric;
  v_doctor_reduction_hours integer;
  v_total_reduction_hours integer;
  v_cryo_reduction_hours integer := 0;
  v_federal_specialization_reduction_hours integer := 0;
  v_rehab_power numeric := 0;
  v_federal_rehab_power numeric := 0;
  v_form_protection integer;
  v_form_loss_before_federal numeric;
begin
  -- Cette blessure de fatigue reste toujours fixée à 72 heures et ne doit
  -- afficher aucun faux bonus de soin.
  if new.diagnosis_code = 'fatigue_exhaustion' then
    new.doctor_recovery_hours_reduced := 0;
    new.federal_recovery_hours_reduced := 0;
    new.cryotherapy_recovery_hours_reduced := 0;
    new.federal_specialization_recovery_hours_reduced := 0;
    new.federal_specialization_form_loss_reduction := 0;
    return new;
  end if;

  select contract.team_id into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  order by contract.signed_at desc
  limit 1;
  if v_team_id is null then return new; end if;

  v_doctor_reduction_percentage := least(
    80,
    public.get_active_team_staff_base_strength(v_team_id, 'doctor', 6)
      + public.get_active_team_staff_talent_strength(
          v_team_id,
          'doctor_recovery_time',
          3
        )
  );
  v_federal_reduction_percentage := coalesce(
    public.get_team_national_federation_infrastructure_level(
      v_team_id,
      'federal_medical_network'
    ),
    0
  );
  v_doctor_reduction_hours := ceil(
    new.recovery_hours * v_doctor_reduction_percentage / 100.0
  )::integer;
  v_total_reduction_hours := ceil(
    new.recovery_hours * least(
      85,
      v_doctor_reduction_percentage + v_federal_reduction_percentage
    ) / 100.0
  )::integer;
  new.doctor_recovery_hours_reduced := v_doctor_reduction_hours;
  new.federal_recovery_hours_reduced := greatest(
    0,
    v_total_reduction_hours - v_doctor_reduction_hours
  );

  if new.severity in ('minor', 'moderate') then
    v_rehab_power := public.get_team_specialization_power(
      v_team_id,
      'cryotherapy_center',
      'rehabilitation'
    );
    v_cryo_reduction_hours := ceil(
      greatest(0, new.recovery_hours - v_total_reduction_hours)
      * 0.08 * v_rehab_power
    )::integer;
  end if;
  new.cryotherapy_recovery_hours_reduced := v_cryo_reduction_hours;

  if new.severity = 'moderate' then
    v_federal_rehab_power :=
      public.get_team_federal_medical_specialization_power(
        v_team_id,
        'rehab_network'
      );
    v_federal_specialization_reduction_hours := ceil(
      greatest(
        0,
        new.recovery_hours - v_total_reduction_hours - v_cryo_reduction_hours
      ) * 0.06 * v_federal_rehab_power
    )::integer;
  end if;
  new.federal_specialization_recovery_hours_reduced :=
    v_federal_specialization_reduction_hours;
  new.expected_recovery_at := new.expected_recovery_at - make_interval(
    hours => v_total_reduction_hours
      + v_cryo_reduction_hours
      + v_federal_specialization_reduction_hours
  );

  select count(*)::integer into v_form_protection
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
  if v_rehab_power > 0 then
    new.form_loss_per_day := round(
      new.form_loss_per_day * (1 - 0.05 * v_rehab_power),
      2
    );
  end if;

  if v_federal_rehab_power = 0 then
    v_federal_rehab_power :=
      public.get_team_federal_medical_specialization_power(
        v_team_id,
        'rehab_network'
      );
  end if;
  v_form_loss_before_federal := new.form_loss_per_day;
  if v_federal_rehab_power > 0 then
    new.form_loss_per_day := round(
      new.form_loss_per_day * (1 - 0.04 * v_federal_rehab_power),
      2
    );
  end if;
  new.federal_specialization_form_loss_reduction := greatest(
    0,
    v_form_loss_before_federal - new.form_loss_per_day
  );
  return new;
end;
$$;

-- Le dernier trigger alphabétique reste l'autorité absolue sur les 72 heures
-- de fatigue et remet aussi à zéro les nouveaux marqueurs fédéraux.
create or replace function public.enforce_exact_fatigue_injury_duration()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.diagnosis_code <> 'fatigue_exhaustion' then return new; end if;

  new.injury_type := 'fatigue';
  new.severity := 'minor';
  new.recovery_days := 3;
  new.recovery_hours := 72;
  new.base_expected_recovery_at := new.started_at + interval '3 days';
  new.expected_recovery_at := new.started_at + interval '3 days';
  new.form_loss_per_day := 0;
  new.protocol_code := null;
  new.doctor_recovery_hours_reduced := 0;
  new.federal_recovery_hours_reduced := 0;
  new.cryotherapy_recovery_hours_reduced := 0;
  new.federal_specialization_recovery_hours_reduced := 0;
  new.federal_specialization_form_loss_reduction := 0;
  return new;
end;
$$;

-- L'orientation Urgence coordonnée réduit le prix déjà remisé par le talent
-- du médecin, afin que les deux sources se cumulent sans s'écraser.
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
    )
    * (
      1 - 0.04 * public.get_team_federal_medical_specialization_power(
        team_season.team_id,
        'emergency_network'
      )
    ),
    2
  )
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id;
$$;

create or replace function public.get_team_medical_protocol_form_loss(
  p_team_season_id uuid,
  p_base_form_loss numeric
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    greatest(
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
    * (
      1 - 0.05 * public.get_team_specialization_power(
        team_season.team_id,
        'cryotherapy_center',
        'rehabilitation'
      )
    )
    * (
      1 - 0.04 * public.get_team_federal_medical_specialization_power(
        team_season.team_id,
        'rehab_network'
      )
    ),
    2
  )
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id;
$$;

do $migration$
declare
  v_definition text;
  v_needle constant text :=
    'public.get_team_doctor_protocol_form_loss(v_context.team_season_id, v_protocol.form_loss_per_day)';
begin
  select pg_get_functiondef(
    'public.apply_current_team_injury_protocol(uuid,text)'::regprocedure
  ) into v_definition;
  if position('get_team_medical_protocol_form_loss' in v_definition) = 0 then
    if position(v_needle in v_definition) = 0 then
      raise exception 'Point d’intégration de la protection de forme fédérale introuvable.';
    end if;
    v_definition := replace(
      v_definition,
      v_needle,
      'public.get_team_medical_protocol_form_loss(v_context.team_season_id, v_protocol.form_loss_per_day)'
    );
    execute v_definition;
  end if;
end;
$migration$;

create or replace function public.apply_federal_medical_rest_recovery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_power numeric;
  v_original_delta numeric;
begin
  if new.effect_type <> 'rest' or new.form_delta <= 0 then return new; end if;
  select contract.team_id into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  order by contract.signed_at desc
  limit 1;
  if v_team_id is null then return new; end if;

  v_power := public.get_team_federal_medical_specialization_power(
    v_team_id,
    'prevention_network'
  );
  if v_power <= 0 then return new; end if;
  v_original_delta := new.form_delta;
  new.form_delta := round(new.form_delta * (1 + 0.04 * v_power), 2);
  new.form_after := least(100, new.form_before + new.form_delta);
  new.federal_medical_rest_bonus := greatest(
    0,
    new.form_delta - v_original_delta
  );
  return new;
end;
$$;

drop trigger if exists apply_federal_medical_rest_recovery_trigger
  on public.rider_daily_condition_effects;
create trigger apply_federal_medical_rest_recovery_trigger
before insert on public.rider_daily_condition_effects
for each row execute function public.apply_federal_medical_rest_recovery();

revoke all on function public.get_team_federal_medical_specialization_power(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_team_medical_protocol_form_loss(uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.apply_federal_medical_rest_recovery()
  from public, anon, authenticated;

grant execute on function public.get_team_federal_medical_specialization_power(uuid, text)
  to service_role;

comment on function public.get_team_federal_medical_specialization_power(uuid, text) is
  'Puissance progressive de l’orientation du Réseau médical de la fédération d’affiliation.';
comment on column public.rider_injuries.federal_specialization_recovery_hours_reduced is
  'Heures supplémentaires retranchées par l’orientation Réseau de rééducation.';
comment on column public.rider_daily_condition_effects.federal_medical_rest_bonus is
  'Gain de forme supplémentaire d’un vrai jour de repos grâce à Médecine préventive.';

notify pgrst, 'reload schema';

commit;
