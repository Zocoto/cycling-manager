begin;

alter table public.staff_market_batches
  drop constraint if exists staff_market_batches_count;
alter table public.staff_market_batches
  add constraint staff_market_batches_count
  check (staff_count in (25, 50));

alter table public.staff_market_listings
  drop constraint if exists staff_market_listings_slot_range;
alter table public.staff_market_listings
  add constraint staff_market_listings_slot_range
  check (daily_slot between 1 and 50);

create or replace function public.append_daily_staff_market(
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
  v_slot integer := 25;
  v_existing_count integer := 0;
  v_role text;
  v_level integer;
  v_trainer_specialty text;
  v_architect_specialty text;
  v_talent_code text;
  v_country_id uuid;
begin
  if jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) <> 25 then
    raise exception 'La vague du marché du staff exige exactement 25 profils.';
  end if;

  select batch.id
  into v_batch_id
  from public.staff_market_batches as batch
  where batch.market_date = v_market_date
  for update;

  if v_batch_id is null then
    return 0;
  end if;

  select count(*)::integer
  into v_existing_count
  from public.staff_market_listings as listing
  where listing.batch_id = v_batch_id;

  if v_existing_count >= 50 then
    update public.staff_market_batches
    set staff_count = 50
    where id = v_batch_id
      and staff_count <> 50;
    return 0;
  end if;

  if v_existing_count <> 25 then
    raise exception
      'Le marché du staff contient % profils avant la vague de midi, 25 attendus.',
      v_existing_count;
  end if;

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
      'nutritionist', 'physiotherapist', 'race_preparer', 'architect',
      'research_engineer', 'educator'
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
      select 1
      from public.countries as country
      where country.id = v_country_id
        and country.is_active = true
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

  update public.staff_market_batches
  set staff_count = 50
  where id = v_batch_id;

  return 25;
end;
$$;

revoke all on function public.append_daily_staff_market(date, jsonb)
  from public, anon, authenticated;
grant execute on function public.append_daily_staff_market(date, jsonb)
  to service_role;

comment on function public.append_daily_staff_market(date, jsonb) is
  'Ajoute atomiquement et une seule fois les 25 profils de midi aux 25 profils initiaux du marché quotidien.';

comment on column public.staff_market_batches.staff_count is
  'Nombre de profils générés pour la journée : 25 après minuit, puis 50 après la vague de midi.';

notify pgrst, 'reload schema';

commit;
