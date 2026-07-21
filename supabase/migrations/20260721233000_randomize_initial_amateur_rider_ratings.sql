begin;

-- Add a bounded, deterministic variation to a starting rating. The base
-- archetypes remain the source of sporting coherence, while the team and rider
-- identifiers make every newly generated squad distinct.
create or replace function private.randomize_initial_amateur_rating(
  p_base_rating smallint,
  p_team_id uuid,
  p_rider_id uuid,
  p_axis text
)
returns smallint
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  v_axis_shift integer := (
    (
      (
        hashtextextended(
          p_team_id::text || ':' || p_rider_id::text || ':' || p_axis,
          0
        ) % 13
      ) + 13
    ) % 13
  )::integer - 6;
  v_talent_shift integer := (
    (
      (
        hashtextextended(
          p_team_id::text || ':' || p_rider_id::text || ':talent',
          0
        ) % 5
      ) + 5
    ) % 5
  )::integer - 2;
begin
  -- Starting riders stay in an amateur range even at the extremes. With a
  -- maximum variation of eight points, the original archetypes cannot turn a
  -- sprinter into a climber (or the reverse).
  return greatest(
    35,
    least(70, p_base_rating::integer + v_axis_shift + v_talent_shift)
  )::smallint;
end;
$$;

revoke all
on function private.randomize_initial_amateur_rating(smallint, uuid, uuid, text)
from public, anon, authenticated;

comment on function private.randomize_initial_amateur_rating(smallint, uuid, uuid, text) is
  'Varie une note initiale de facon reproductible, bornee et coherente avec le profil sportif de base.';

create or replace function public.initialize_sporting_director_career_v2(
  p_rider_identities jsonb,
  p_team_name text,
  p_team_country_id uuid,
  p_jersey_pattern text,
  p_jersey_primary_color text,
  p_jersey_secondary_color text,
  p_jersey_accent_color text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_team_id uuid;
  v_season_id uuid;
begin
  v_result := public.initialize_sporting_director_career(
    p_rider_identities,
    p_team_name,
    p_team_country_id,
    case
      when lower(btrim(coalesce(p_jersey_pattern, ''))) in (
        'classic', 'diagonal', 'hoops', 'split'
      ) then p_jersey_pattern
      else 'classic'
    end,
    p_jersey_primary_color,
    p_jersey_secondary_color,
    p_jersey_accent_color
  );

  perform public.update_current_team_amateur_jersey(
    p_jersey_pattern,
    p_jersey_primary_color,
    p_jersey_secondary_color,
    p_jersey_accent_color
  );

  -- Only a career created by this call is randomized. Existing careers return
  -- another status and are deliberately left untouched.
  if v_result ->> 'status' = 'created' then
    v_team_id := (v_result ->> 'team_id')::uuid;
    v_season_id := (v_result ->> 'season_id')::uuid;

    update public.rider_season_ratings as rating
    set
      mountain = private.randomize_initial_amateur_rating(
        rating.mountain, v_team_id, rating.rider_id, 'mountain'
      ),
      hills = private.randomize_initial_amateur_rating(
        rating.hills, v_team_id, rating.rider_id, 'hills'
      ),
      flat = private.randomize_initial_amateur_rating(
        rating.flat, v_team_id, rating.rider_id, 'flat'
      ),
      time_trial = private.randomize_initial_amateur_rating(
        rating.time_trial, v_team_id, rating.rider_id, 'time_trial'
      ),
      cobbles = private.randomize_initial_amateur_rating(
        rating.cobbles, v_team_id, rating.rider_id, 'cobbles'
      ),
      sprint = private.randomize_initial_amateur_rating(
        rating.sprint, v_team_id, rating.rider_id, 'sprint'
      ),
      acceleration = private.randomize_initial_amateur_rating(
        rating.acceleration, v_team_id, rating.rider_id, 'acceleration'
      ),
      downhill = private.randomize_initial_amateur_rating(
        rating.downhill, v_team_id, rating.rider_id, 'downhill'
      ),
      endurance = private.randomize_initial_amateur_rating(
        rating.endurance, v_team_id, rating.rider_id, 'endurance'
      ),
      resistance = private.randomize_initial_amateur_rating(
        rating.resistance, v_team_id, rating.rider_id, 'resistance'
      ),
      recovery = private.randomize_initial_amateur_rating(
        rating.recovery, v_team_id, rating.rider_id, 'recovery'
      ),
      breakaway = private.randomize_initial_amateur_rating(
        rating.breakaway, v_team_id, rating.rider_id, 'breakaway'
      ),
      prologue = private.randomize_initial_amateur_rating(
        rating.prologue, v_team_id, rating.rider_id, 'prologue'
      )
    from public.rider_contracts as contract
    where contract.rider_id = rating.rider_id
      and contract.team_id = v_team_id
      and contract.start_season_id = v_season_id
      and rating.season_id = v_season_id;

    update public.initial_career_generations
    set generation_version = 3
    where team_id = v_team_id
      and season_id = v_season_id;

    v_result := jsonb_set(v_result, '{generation_version}', '3'::jsonb);
  end if;

  return v_result;
end;
$$;

revoke all
on function public.initialize_sporting_director_career_v2(jsonb, text, uuid, text, text, text, text)
from public, anon;

grant execute
on function public.initialize_sporting_director_career_v2(jsonb, text, uuid, text, text, text, text)
to authenticated;

comment on function public.initialize_sporting_director_career_v2(jsonb, text, uuid, text, text, text, text) is
  'Fonde une carriere avec sept profils amateurs coherents mais uniques, puis applique le maillot choisi.';

commit;
