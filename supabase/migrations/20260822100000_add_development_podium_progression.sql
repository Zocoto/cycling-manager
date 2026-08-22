begin;

create table public.development_race_podium_progression (
  id uuid primary key default gen_random_uuid(),
  race_edition_id uuid not null
    references public.development_race_editions(id) on delete cascade,
  academy_rider_id uuid not null
    references public.youth_academy_riders(id) on delete restrict,
  final_rank smallint not null,
  profile_type text not null,
  primary_rating_key text not null,
  projected_rating_changes jsonb not null default '{}'::jsonb,
  ratings_before jsonb not null default '{}'::jsonb,
  ratings_after jsonb not null default '{}'::jsonb,
  awarded_at timestamptz not null default now(),
  constraint development_podium_progression_unique
    unique (race_edition_id, academy_rider_id),
  constraint development_podium_progression_rank_range
    check (final_rank between 1 and 3),
  constraint development_podium_progression_profile_allowed
    check (profile_type in (
      'flat', 'sprint', 'hilly', 'mountain', 'cobbles', 'time_trial', 'mixed'
    )),
  constraint development_podium_progression_primary_rating_allowed
    check (primary_rating_key in (
      'mountain', 'hills', 'recovery', 'endurance', 'resistance',
      'breakaway', 'downhill', 'acceleration', 'sprint', 'flat',
      'cobbles', 'prologue', 'timeTrial'
    ))
);

create index development_podium_progression_rider_idx
  on public.development_race_podium_progression (
    academy_rider_id,
    awarded_at desc
  );

alter table public.development_race_podium_progression enable row level security;

create policy development_podium_progression_read_managed
on public.development_race_podium_progression
for select
to authenticated
using (
  exists (
    select 1
    from public.youth_academy_riders as academy
    where academy.id = development_race_podium_progression.academy_rider_id
      and public.current_user_manages_team(academy.team_id)
  )
);

grant select on table public.development_race_podium_progression
to authenticated;
grant all privileges on table public.development_race_podium_progression
to service_role;

create or replace function public.get_development_podium_profile_weights(
  p_profile_type text
)
returns table (
  rating_key text,
  rating_weight numeric,
  is_primary boolean
)
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select weights.rating_key, weights.rating_weight, weights.is_primary
  from (
    values
      ('flat', 'flat', 1.00, true),
      ('flat', 'sprint', 0.26, false),
      ('flat', 'acceleration', 0.18, false),
      ('flat', 'endurance', 0.12, false),
      ('flat', 'resistance', 0.10, false),
      ('sprint', 'sprint', 1.00, true),
      ('sprint', 'acceleration', 0.24, false),
      ('sprint', 'flat', 0.18, false),
      ('sprint', 'resistance', 0.13, false),
      ('sprint', 'endurance', 0.11, false),
      ('hilly', 'hills', 1.00, true),
      ('hilly', 'acceleration', 0.18, false),
      ('hilly', 'endurance', 0.17, false),
      ('hilly', 'resistance', 0.14, false),
      ('hilly', 'mountain', 0.10, false),
      ('hilly', 'sprint', 0.05, false),
      ('mountain', 'mountain', 1.00, true),
      ('mountain', 'recovery', 0.18, false),
      ('mountain', 'endurance', 0.17, false),
      ('mountain', 'resistance', 0.13, false),
      ('mountain', 'downhill', 0.10, false),
      ('cobbles', 'cobbles', 1.00, true),
      ('cobbles', 'flat', 0.19, false),
      ('cobbles', 'resistance', 0.18, false),
      ('cobbles', 'endurance', 0.14, false),
      ('cobbles', 'acceleration', 0.10, false),
      ('time_trial', 'timeTrial', 1.00, true),
      ('time_trial', 'prologue', 0.16, false),
      ('time_trial', 'flat', 0.14, false),
      ('time_trial', 'endurance', 0.10, false),
      ('time_trial', 'resistance', 0.08, false),
      ('mixed', 'endurance', 1.00, true),
      ('mixed', 'hills', 0.18, false),
      ('mixed', 'mountain', 0.16, false),
      ('mixed', 'flat', 0.14, false),
      ('mixed', 'timeTrial', 0.14, false),
      ('mixed', 'recovery', 0.10, false),
      ('mixed', 'resistance', 0.10, false)
  ) as weights(profile_type, rating_key, rating_weight, is_primary)
  where weights.profile_type = p_profile_type;
$$;

create or replace function public.get_development_podium_rating_factor(
  p_projected_rating numeric
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select case
    when p_projected_rating < 70 then 1.00
    when p_projected_rating < 74 then 0.65
    when p_projected_rating < 77 then 0.40
    else 0.25
  end;
$$;

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
  if new.result_scope <> 'general'
    or new.rank not between 1 and 3
    or new.academy_rider_id is null
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
    v_edition.profile_type
  ) as profile
  where profile.is_primary
  limit 1;

  if v_primary_rating_key is null then
    raise exception 'Le profil junior % ne possède pas de statistique principale.',
      v_edition.profile_type;
  end if;

  insert into public.development_race_podium_progression (
    race_edition_id,
    academy_rider_id,
    final_rank,
    profile_type,
    primary_rating_key
  ) values (
    new.race_edition_id,
    new.academy_rider_id,
    new.rank,
    v_edition.profile_type,
    v_primary_rating_key
  )
  on conflict (race_edition_id, academy_rider_id) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    return new;
  end if;

  v_place_factor := case new.rank
    when 1 then 1.00
    when 2 then 0.60
    when 3 then 0.35
    else 0
  end;

  for v_weight in
    select *
    from public.get_development_podium_profile_weights(v_edition.profile_type)
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

drop trigger if exists development_result_awards_podium_progression
on public.development_race_results;

create trigger development_result_awards_podium_progression
after insert
on public.development_race_results
for each row
execute function public.award_development_podium_progression();

revoke execute
on function public.get_development_podium_profile_weights(text)
from public, anon, authenticated;
revoke execute
on function public.get_development_podium_rating_factor(numeric)
from public, anon, authenticated;
revoke execute
on function public.award_development_podium_progression()
from public, anon, authenticated;

comment on table public.development_race_podium_progression is
  'Journal idempotent des gains de statistiques accordés aux trois premiers du classement final des courses juniors. Les anciens résultats ne sont pas recalculés.';
comment on function public.award_development_podium_progression() is
  'Récompense uniquement le podium général junior : gain principal dégressif selon la place et la note, complété par les statistiques secondaires du profil.';

notify pgrst, 'reload schema';

commit;
