begin;

create or replace function public.rebalance_existing_youth_rating(
  p_rating numeric,
  p_average numeric,
  p_age integer
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select round(
    greatest(
      1,
      least(
        6,
        case
          when p_age <= 15 then 1
          when p_age = 16 then 1
          when p_age = 17 then 1.5
          else 2.6
        end
        + (p_rating - p_average) * 0.28
        + (p_average - 3) * 0.18
      )
    ),
    1
  );
$$;

-- Preserve every gain earned since signing while lowering the original base.
with candidate_baselines as (
  select
    candidate.*,
    (
      candidate.mountain
      + candidate.hills
      + candidate.flat
      + candidate.time_trial
      + candidate.cobbles
      + candidate.sprint
      + candidate.acceleration
      + candidate.downhill
      + candidate.endurance
      + candidate.resistance
      + candidate.recovery
      + candidate.breakaway
      + candidate.prologue
    ) / 13 as average_rating
  from public.youth_scouting_candidates as candidate
  where candidate.status in ('spotted', 'signed')
)
update public.youth_academy_riders as academy
set
  mountain = round(least(6, public.rebalance_existing_youth_rating(
    candidate.mountain, candidate.average_rating, candidate.age
  ) + greatest(0, academy.mountain - candidate.mountain)), 3),
  hills = round(least(6, public.rebalance_existing_youth_rating(
    candidate.hills, candidate.average_rating, candidate.age
  ) + greatest(0, academy.hills - candidate.hills)), 3),
  flat = round(least(6, public.rebalance_existing_youth_rating(
    candidate.flat, candidate.average_rating, candidate.age
  ) + greatest(0, academy.flat - candidate.flat)), 3),
  time_trial = round(least(6, public.rebalance_existing_youth_rating(
    candidate.time_trial, candidate.average_rating, candidate.age
  ) + greatest(0, academy.time_trial - candidate.time_trial)), 3),
  cobbles = round(least(6, public.rebalance_existing_youth_rating(
    candidate.cobbles, candidate.average_rating, candidate.age
  ) + greatest(0, academy.cobbles - candidate.cobbles)), 3),
  sprint = round(least(6, public.rebalance_existing_youth_rating(
    candidate.sprint, candidate.average_rating, candidate.age
  ) + greatest(0, academy.sprint - candidate.sprint)), 3),
  acceleration = round(least(6, public.rebalance_existing_youth_rating(
    candidate.acceleration, candidate.average_rating, candidate.age
  ) + greatest(0, academy.acceleration - candidate.acceleration)), 3),
  downhill = round(least(6, public.rebalance_existing_youth_rating(
    candidate.downhill, candidate.average_rating, candidate.age
  ) + greatest(0, academy.downhill - candidate.downhill)), 3),
  endurance = round(least(6, public.rebalance_existing_youth_rating(
    candidate.endurance, candidate.average_rating, candidate.age
  ) + greatest(0, academy.endurance - candidate.endurance)), 3),
  resistance = round(least(6, public.rebalance_existing_youth_rating(
    candidate.resistance, candidate.average_rating, candidate.age
  ) + greatest(0, academy.resistance - candidate.resistance)), 3),
  recovery = round(least(6, public.rebalance_existing_youth_rating(
    candidate.recovery, candidate.average_rating, candidate.age
  ) + greatest(0, academy.recovery - candidate.recovery)), 3),
  breakaway = round(least(6, public.rebalance_existing_youth_rating(
    candidate.breakaway, candidate.average_rating, candidate.age
  ) + greatest(0, academy.breakaway - candidate.breakaway)), 3),
  prologue = round(least(6, public.rebalance_existing_youth_rating(
    candidate.prologue, candidate.average_rating, candidate.age
  ) + greatest(0, academy.prologue - candidate.prologue)), 3),
  updated_at = now()
from candidate_baselines as candidate
where academy.candidate_id = candidate.id
  and academy.status in ('active', 'recruited');

-- Then align the immutable scouting source used by future signatures.
with candidate_baselines as (
  select
    candidate.*,
    (
      candidate.mountain
      + candidate.hills
      + candidate.flat
      + candidate.time_trial
      + candidate.cobbles
      + candidate.sprint
      + candidate.acceleration
      + candidate.downhill
      + candidate.endurance
      + candidate.resistance
      + candidate.recovery
      + candidate.breakaway
      + candidate.prologue
    ) / 13 as average_rating
  from public.youth_scouting_candidates as candidate
  where candidate.status in ('spotted', 'signed')
)
update public.youth_scouting_candidates as candidate
set
  mountain = public.rebalance_existing_youth_rating(
    candidate.mountain, baseline.average_rating, candidate.age
  ),
  hills = public.rebalance_existing_youth_rating(
    candidate.hills, baseline.average_rating, candidate.age
  ),
  flat = public.rebalance_existing_youth_rating(
    candidate.flat, baseline.average_rating, candidate.age
  ),
  time_trial = public.rebalance_existing_youth_rating(
    candidate.time_trial, baseline.average_rating, candidate.age
  ),
  cobbles = public.rebalance_existing_youth_rating(
    candidate.cobbles, baseline.average_rating, candidate.age
  ),
  sprint = public.rebalance_existing_youth_rating(
    candidate.sprint, baseline.average_rating, candidate.age
  ),
  acceleration = public.rebalance_existing_youth_rating(
    candidate.acceleration, baseline.average_rating, candidate.age
  ),
  downhill = public.rebalance_existing_youth_rating(
    candidate.downhill, baseline.average_rating, candidate.age
  ),
  endurance = public.rebalance_existing_youth_rating(
    candidate.endurance, baseline.average_rating, candidate.age
  ),
  resistance = public.rebalance_existing_youth_rating(
    candidate.resistance, baseline.average_rating, candidate.age
  ),
  recovery = public.rebalance_existing_youth_rating(
    candidate.recovery, baseline.average_rating, candidate.age
  ),
  breakaway = public.rebalance_existing_youth_rating(
    candidate.breakaway, baseline.average_rating, candidate.age
  ),
  prologue = public.rebalance_existing_youth_rating(
    candidate.prologue, baseline.average_rating, candidate.age
  )
from candidate_baselines as baseline
where candidate.id = baseline.id;

drop function public.rebalance_existing_youth_rating(
  numeric,
  numeric,
  integer
);

commit;
