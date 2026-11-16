begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Keep the existing RPCs available; these read the personality only for the
-- roster rows already authorized by the race and federation preparation RPCs.
create type public.race_preparation_with_personality_row as (
  race_edition_id uuid, race_registration_id uuid, team_id uuid, stage_id uuid,
  rider_id uuid, rider_first_name text, rider_last_name text,
  mountain integer, hills integer, flat integer, time_trial integer, cobbles integer,
  sprint integer, acceleration integer, downhill integer, endurance integer,
  resistance integer, recovery integer, breakaway integer, prologue integer,
  general_role text, stage_role text, time_trial_effort text, relay_share_pct numeric,
  time_trial_updated_at timestamptz, objective text, collective_posture text,
  breakaway_policy text, chase_policy text, lieutenant_rider_id uuid,
  danger_pacer_rider_id uuid, protector_rider_id uuid, breakaway_rider_id uuid,
  attack_orders jsonb, strategy_updated_at timestamptz, sprint_train_order uuid[],
  personality_key text
);

create function public.get_current_team_race_preparation_with_personality()
returns setof public.race_preparation_with_personality_row
language sql stable security definer set search_path = '' as $$
  select preparation.*, rider.personality_key
  from public.get_current_team_race_preparation_with_sprint() as preparation
  left join public.riders as rider on rider.id = preparation.rider_id;
$$;

create function public.get_current_national_federation_race_preparation_with_personality(p_country_code text)
returns setof public.race_preparation_with_personality_row
language sql stable security definer set search_path = '' as $$
  select preparation.*, rider.personality_key
  from public.get_current_national_federation_race_preparation_with_sprint(p_country_code) as preparation
  left join public.riders as rider on rider.id = preparation.rider_id;
$$;

-- The application sends only rider IDs from the authorized registration roster.
-- Extend its existing service-only condition read, without another round trip.
create function public.get_registration_season_race_days_v3(
  p_season_id uuid,
  p_rider_ids uuid[]
)
returns table (
  rider_id uuid,
  season_race_days integer,
  projected_season_race_days integer,
  has_etapovore boolean,
  personality_key text
)
language sql stable set search_path = '' as $$
  select days.*, rider.personality_key
  from public.get_registration_season_race_days_v2(p_season_id, p_rider_ids) as days
  left join public.riders as rider on rider.id = days.rider_id;
$$;

revoke all on function public.get_current_team_race_preparation_with_personality() from public, anon;
revoke all on function public.get_current_national_federation_race_preparation_with_personality(text) from public, anon;
grant execute on function public.get_current_team_race_preparation_with_personality() to authenticated, service_role;
grant execute on function public.get_current_national_federation_race_preparation_with_personality(text) to authenticated, service_role;

revoke all on function public.get_registration_season_race_days_v3(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.get_registration_season_race_days_v3(uuid, uuid[]) to service_role;

notify pgrst, 'reload schema';
commit;
