begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- The race snapshot reuses the fan-club page's exact staff bonus once per team.
create function public.get_race_team_popularity_context(
  p_team_ids uuid[],
  p_season_id uuid
)
returns table(
  team_id uuid,
  registration_country_code text,
  community_growth_bonus_percentage numeric,
  headquarters_level integer,
  active_specialization_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select team_season.team_id,
    country.iso_alpha2::text,
    public.get_active_team_staff_talent_strength(
      team_season.team_id, 'community_rider_popularity_and_fans', 3
    ),
    coalesce(headquarters.level, 0)::integer,
    specialization.active_specialization_code
  from public.team_seasons as team_season
  left join public.countries as country on country.id = team_season.registration_country_id
  left join public.team_infrastructures as headquarters
    on headquarters.team_id = team_season.team_id
    and headquarters.infrastructure_code = 'fan_club_headquarters'
  left join public.team_infrastructure_specializations as specialization
    on specialization.team_id = team_season.team_id
    and specialization.infrastructure_code = 'fan_club_headquarters'
  where team_season.team_id = any(p_team_ids)
    and team_season.season_id = p_season_id
    and team_season.status in ('planned', 'active');
$$;

revoke all on function public.get_race_team_popularity_context(uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.get_race_team_popularity_context(uuid[], uuid)
  to service_role;

notify pgrst, 'reload schema';
commit;

