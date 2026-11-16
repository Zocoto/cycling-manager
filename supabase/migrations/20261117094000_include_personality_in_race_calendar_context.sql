begin;

create function public.get_race_calendar_rider_context(
  p_rider_ids uuid[],
  p_min_game_day integer,
  p_max_game_day integer,
  p_include_personality boolean
)
returns table (
  id uuid, country_id uuid, avatar_profile_key text, avatar_seed bigint,
  career_race_days integer, height_cm numeric, weight_kg numeric,
  baseline_weight_kg numeric, physiology_version smallint,
  special_ability_codes jsonb, performance_preparations jsonb,
  championship_titles jsonb, personality_key text
)
language sql stable
set search_path = ''
as $$
  select context.*, case when p_include_personality then rider.personality_key end
  from public.get_race_calendar_rider_context(p_rider_ids, p_min_game_day, p_max_game_day) as context
  join public.riders as rider on rider.id = context.id
  order by context.id;
$$;

revoke all on function public.get_race_calendar_rider_context(uuid[], integer, integer, boolean)
from public, anon, authenticated;
grant execute on function public.get_race_calendar_rider_context(uuid[], integer, integer, boolean)
to service_role;

notify pgrst, 'reload schema';

commit;
