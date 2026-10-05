begin;

create table if not exists public.nations_cup_rider_popularity_rewards (
  race_edition_id uuid not null
    references public.race_editions(id) on delete cascade,
  race_roster_id uuid not null
    references public.race_rosters(id) on delete cascade,
  rider_id uuid not null
    references public.riders(id) on delete cascade,
  result_status text not null,
  final_rank integer,
  popularity_awarded numeric(8, 2) not null default 0
    check (popularity_awarded >= 0),
  awarded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (race_edition_id, race_roster_id)
);

create index if not exists nations_cup_popularity_rewards_rider_idx
  on public.nations_cup_rider_popularity_rewards (rider_id, awarded_at desc);

alter table public.nations_cup_rider_popularity_rewards
  enable row level security;

grant all privileges
  on public.nations_cup_rider_popularity_rewards
  to service_role;

create or replace function public.calculate_nations_cup_rider_popularity(
  p_status text,
  p_final_rank integer
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status = 'classified' and p_final_rank = 1 then 8.00
    when p_status = 'classified' and p_final_rank = 2 then 6.00
    when p_status = 'classified' and p_final_rank = 3 then 5.00
    when p_status = 'classified' and p_final_rank between 4 and 5 then 4.00
    when p_status = 'classified' and p_final_rank between 6 and 10 then 2.00
    when p_status = 'classified' and p_final_rank between 11 and 16 then 1.00
    when p_status = 'classified' then 0.50
    when p_status in ('did_not_finish', 'outside_time_limit') then 0.25
    else 0.00
  end::numeric(8, 2);
$$;

create or replace function public.reward_nations_cup_rider_popularity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_id uuid;
  v_new_reward numeric(8, 2);
  v_previous_reward numeric(8, 2);
  v_reward_delta numeric(8, 2);
  v_inserted integer;
begin
  select roster.rider_id
  into v_rider_id
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  join public.race_rosters as roster on roster.id = new.race_roster_id
  where edition.id = new.race_edition_id
    and race.competition_type = 'nations_cup';

  if v_rider_id is null then
    return new;
  end if;

  v_new_reward := public.calculate_nations_cup_rider_popularity(
    new.status,
    new.final_rank
  );

  insert into public.nations_cup_rider_popularity_rewards (
    race_edition_id,
    race_roster_id,
    rider_id,
    result_status,
    final_rank,
    popularity_awarded
  ) values (
    new.race_edition_id,
    new.race_roster_id,
    v_rider_id,
    new.status,
    new.final_rank,
    v_new_reward
  )
  on conflict (race_edition_id, race_roster_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    v_previous_reward := 0;
  else
    select reward.popularity_awarded
    into v_previous_reward
    from public.nations_cup_rider_popularity_rewards as reward
    where reward.race_edition_id = new.race_edition_id
      and reward.race_roster_id = new.race_roster_id
    for update;

    update public.nations_cup_rider_popularity_rewards
    set
      rider_id = v_rider_id,
      result_status = new.status,
      final_rank = new.final_rank,
      popularity_awarded = v_new_reward,
      updated_at = now()
    where race_edition_id = new.race_edition_id
      and race_roster_id = new.race_roster_id;
  end if;

  v_reward_delta := v_new_reward - coalesce(v_previous_reward, 0);

  if v_reward_delta > 0 then
    insert into public.rider_popularity_profiles (
      rider_id,
      popularity_points,
      updated_at
    ) values (
      v_rider_id,
      v_reward_delta,
      now()
    )
    on conflict (rider_id) do update
    set
      popularity_points = public.rider_popularity_profiles.popularity_points
        + excluded.popularity_points,
      updated_at = now();
  elsif v_reward_delta < 0 then
    update public.rider_popularity_profiles
    set
      popularity_points = greatest(0, popularity_points + v_reward_delta),
      updated_at = now()
    where rider_id = v_rider_id;
  end if;

  return new;
end;
$$;

drop trigger if exists reward_nations_cup_rider_popularity_trigger
  on public.race_results;
create trigger reward_nations_cup_rider_popularity_trigger
after insert or update of status, final_rank
on public.race_results
for each row execute function public.reward_nations_cup_rider_popularity();

with candidates as (
  select
    result.race_edition_id,
    result.race_roster_id,
    roster.rider_id,
    result.status,
    result.final_rank,
    public.calculate_nations_cup_rider_popularity(
      result.status,
      result.final_rank
    ) as popularity_awarded
  from public.race_results as result
  join public.race_editions as edition
    on edition.id = result.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  where race.competition_type = 'nations_cup'
),
inserted as (
  insert into public.nations_cup_rider_popularity_rewards (
    race_edition_id,
    race_roster_id,
    rider_id,
    result_status,
    final_rank,
    popularity_awarded
  )
  select
    candidate.race_edition_id,
    candidate.race_roster_id,
    candidate.rider_id,
    candidate.status,
    candidate.final_rank,
    candidate.popularity_awarded
  from candidates as candidate
  on conflict (race_edition_id, race_roster_id) do nothing
  returning rider_id, popularity_awarded
),
reward_totals as (
  select rider_id, sum(popularity_awarded) as popularity_awarded
  from inserted
  where popularity_awarded > 0
  group by rider_id
)
insert into public.rider_popularity_profiles (
  rider_id,
  popularity_points,
  updated_at
)
select
  reward.rider_id,
  reward.popularity_awarded,
  now()
from reward_totals as reward
on conflict (rider_id) do update
set
  popularity_points = public.rider_popularity_profiles.popularity_points
    + excluded.popularity_points,
  updated_at = now();

comment on table public.nations_cup_rider_popularity_rewards is
  'Registre idempotent des gains de popularité obtenus par les coureurs en Nations Cup.';
comment on function public.calculate_nations_cup_rider_popularity(text, integer) is
  'Barème de popularité Nations Cup : participation effective et bonus progressifs du top 16.';

notify pgrst, 'reload schema';

commit;
