begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- The existing final podium rows use a null stage number. Award each stage win once.
alter table public.development_race_podium_progression
  add column stage_number smallint,
  drop constraint development_podium_progression_unique,
  add constraint development_podium_progression_unique
    unique nulls not distinct (race_edition_id, academy_rider_id, stage_number),
  add constraint development_podium_progression_stage_win
    check (stage_number is null or (stage_number > 0 and final_rank = 1));

comment on column public.development_race_podium_progression.stage_number is
  'Null pour un podium final, numéro de l’étape pour une victoire d’étape.';

create or replace function public.award_development_podium_progression()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_edition public.development_race_editions%rowtype;
  v_academy public.youth_academy_riders%rowtype;
  v_weight record;
  v_stage_number smallint;
  v_profile_type text;
  v_reward_id uuid;
  v_primary_rating_key text;
  v_place_factor numeric;
  v_raw_before numeric;
  v_raw_gain numeric;
  v_projected_before numeric;
  v_projected_gain numeric;
  v_projected_after numeric;
  v_rating_factor numeric;
  v_raw_changes jsonb := '{}'::jsonb;
  v_projected_changes jsonb := '{}'::jsonb;
  v_ratings_before jsonb := '{}'::jsonb;
  v_ratings_after jsonb := '{}'::jsonb;
begin
  if new.academy_rider_id is null or not coalesce(
    (new.result_scope = 'general' and new.rank between 1 and 3)
    or (new.result_scope = 'stage' and new.rank = 1), false
  )
  then
    return new;
  end if;

  select *
  into v_edition
  from public.development_race_editions
  where id = new.race_edition_id;

  if v_edition.id is null then
    return new;
  end if;

  v_profile_type := v_edition.profile_type;
  if new.result_scope = 'stage' then
    if v_edition.race_format <> 'stage_race' then
      return new;
    end if;

    select stage.stage_number, stage.profile_type
    into v_stage_number, v_profile_type
    from public.development_race_stages as stage
    where stage.id = new.stage_id and stage.race_edition_id = v_edition.id;
    if not found then
      return new;
    end if;
  end if;

  select *
  into v_academy
  from public.youth_academy_riders
  where id = new.academy_rider_id
  for update;

  if v_academy.id is null then
    return new;
  end if;

  select profile.rating_key
  into v_primary_rating_key
  from public.get_development_podium_profile_weights(
    v_profile_type
  ) as profile
  where profile.is_primary
  limit 1;

  if v_primary_rating_key is null then
    raise exception 'Le profil junior % ne possède pas de statistique principale.',
      v_profile_type;
  end if;

  insert into public.development_race_podium_progression (
    race_edition_id,
    academy_rider_id,
    final_rank,
    stage_number,
    profile_type,
    primary_rating_key
  ) values (
    new.race_edition_id,
    new.academy_rider_id,
    new.rank,
    v_stage_number,
    v_profile_type,
    v_primary_rating_key
  )
  on conflict (race_edition_id, academy_rider_id, stage_number) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    return new;
  end if;

  v_place_factor := case
    when v_stage_number is not null then 0.25
    when new.rank = 1 then 1.00
    when new.rank = 2 then 0.60
    when new.rank = 3 then 0.35
    else 0
  end;

  for v_weight in
    select *
    from public.get_development_podium_profile_weights(v_profile_type) as profile
    where v_stage_number is null or profile.is_primary
  loop
    v_raw_before := case v_weight.rating_key
      when 'mountain' then v_academy.mountain
      when 'hills' then v_academy.hills
      when 'recovery' then v_academy.recovery
      when 'endurance' then v_academy.endurance
      when 'resistance' then v_academy.resistance
      when 'breakaway' then v_academy.breakaway
      when 'downhill' then v_academy.downhill
      when 'acceleration' then v_academy.acceleration
      when 'sprint' then v_academy.sprint
      when 'flat' then v_academy.flat
      when 'cobbles' then v_academy.cobbles
      when 'prologue' then v_academy.prologue
      when 'timeTrial' then v_academy.time_trial
      else null
    end;

    if v_raw_before is null then
      continue;
    end if;

    v_projected_before := least(
      100,
      greatest(0, 34 + v_raw_before * 8)
    );
    v_rating_factor := public.get_development_podium_rating_factor(
      v_projected_before
    );
    if v_stage_number is not null then
      v_raw_gain := public.get_youth_training_next_raw_rating(
        v_raw_before,
        v_place_factor * v_weight.rating_weight * v_rating_factor,
        v_academy.potential_steps
      ) - v_raw_before;
    else
      v_raw_gain := greatest(
        0,
        least(
          8.25 - v_raw_before,
          round(
            (
              v_place_factor
              * v_weight.rating_weight
              * v_rating_factor
            ) / 8,
            3
          )
        )
      );
    end if;
    v_projected_gain := round(v_raw_gain * 8, 3);
    v_projected_after := least(
      100,
      v_projected_before + v_projected_gain
    );

    v_ratings_before := jsonb_set(
      v_ratings_before,
      array[v_weight.rating_key],
      to_jsonb(round(v_projected_before, 3)),
      true
    );
    v_ratings_after := jsonb_set(
      v_ratings_after,
      array[v_weight.rating_key],
      to_jsonb(round(v_projected_after, 3)),
      true
    );

    if v_raw_gain > 0 then
      v_raw_changes := jsonb_set(
        v_raw_changes,
        array[v_weight.rating_key],
        to_jsonb(v_raw_gain),
        true
      );
      v_projected_changes := jsonb_set(
        v_projected_changes,
        array[v_weight.rating_key],
        to_jsonb(v_projected_gain),
        true
      );
    end if;
  end loop;

  update public.youth_academy_riders
  set
    mountain = least(8.25, mountain + coalesce((v_raw_changes ->> 'mountain')::numeric, 0)),
    hills = least(8.25, hills + coalesce((v_raw_changes ->> 'hills')::numeric, 0)),
    recovery = least(8.25, recovery + coalesce((v_raw_changes ->> 'recovery')::numeric, 0)),
    endurance = least(8.25, endurance + coalesce((v_raw_changes ->> 'endurance')::numeric, 0)),
    resistance = least(8.25, resistance + coalesce((v_raw_changes ->> 'resistance')::numeric, 0)),
    breakaway = least(8.25, breakaway + coalesce((v_raw_changes ->> 'breakaway')::numeric, 0)),
    downhill = least(8.25, downhill + coalesce((v_raw_changes ->> 'downhill')::numeric, 0)),
    acceleration = least(8.25, acceleration + coalesce((v_raw_changes ->> 'acceleration')::numeric, 0)),
    sprint = least(8.25, sprint + coalesce((v_raw_changes ->> 'sprint')::numeric, 0)),
    flat = least(8.25, flat + coalesce((v_raw_changes ->> 'flat')::numeric, 0)),
    cobbles = least(8.25, cobbles + coalesce((v_raw_changes ->> 'cobbles')::numeric, 0)),
    prologue = least(8.25, prologue + coalesce((v_raw_changes ->> 'prologue')::numeric, 0)),
    time_trial = least(8.25, time_trial + coalesce((v_raw_changes ->> 'timeTrial')::numeric, 0)),
    updated_at = now()
  where id = new.academy_rider_id;

  update public.development_race_podium_progression
  set
    projected_rating_changes = v_projected_changes,
    ratings_before = v_ratings_before,
    ratings_after = v_ratings_after
  where id = v_reward_id;

  return new;
end;
$$;

comment on function public.award_development_podium_progression() is
  'Attribue la progression des podiums finaux et un gain réduit sur la note principale des étapes juniors remportées.';

notify pgrst, 'reload schema';

commit;
