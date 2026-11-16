begin;
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

create or replace function public.get_national_federation_race_creation_score(
  p_country_id uuid,
  p_season_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_score jsonb;
  v_effects record;
  v_total integer;
  v_penalty integer;
  v_game_year integer;
  v_organization_prestige integer;
  v_organization_bonus integer := 0;
begin
  v_score := public.get_national_federation_race_creation_score_base(p_country_id, p_season_id);
  select * into v_effects
  from public.get_national_federation_race_organization_effects(p_country_id);
  v_penalty := coalesce((v_score ->> 'existingRaceCount')::integer, 0)
    * coalesce(v_effects.calendar_penalty_per_existing_race, 10);

  -- Historic score calls from federation budgeting only need the objective count.
  select season.game_year into v_game_year
  from public.seasons season
  where season.id = p_season_id and season.status = 'active' and season.game_year >= 6;
  if found then
    v_organization_prestige := greatest(0, least(200, coalesce(
      private.get_national_federation_organization_prestige(p_country_id, v_game_year), 0
    )));
    v_organization_bonus := floor(v_organization_prestige::numeric / 20)::integer;
    v_score := v_score || jsonb_build_object(
      'organizationPrestige', v_organization_prestige,
      'organizationPrestigeBonus', v_organization_bonus
    );
  end if;

  v_total := greatest(0, least(100,
    coalesce((v_score ->> 'rankingPoints')::integer, 0)
    + coalesce((v_score ->> 'objectivePoints')::integer, 0)
    + v_organization_bonus
    - v_penalty
  ));
  return v_score || jsonb_build_object(
    'calendarPenaltyPerRace', coalesce(v_effects.calendar_penalty_per_existing_race, 10),
    'calendarPenalty', v_penalty,
    'total', v_total,
    'threshold', coalesce(v_effects.regional_national_homologation_threshold, 60),
    'continentalThreshold', 60,
    'eligible', v_total >= coalesce(v_effects.regional_national_homologation_threshold, 60)
  );
end;
$$;

commit;
