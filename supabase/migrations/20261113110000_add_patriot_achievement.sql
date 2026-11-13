begin;

set local lock_timeout = '3s';
set local statement_timeout = '10s';

-- Keep the existing calculator and its permissions for the other objectives.
-- Its new branch only reads the requesting director's current team roster.
do $migration$
declare
  v_definition text;
  v_anchor constant text := $anchor$  if p_metric_key not like 'future\_%' escape '\' then$anchor$;
begin
  select replace(pg_get_functiondef(
    'public.calculate_game_objective_progress(text,uuid,uuid,numeric)'::regprocedure
  ), chr(13), '') into v_definition;

  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'Unexpected objective calculator; review the Le Patriote migration.';
  end if;

  execute replace(v_definition, v_anchor, $branch$  if p_metric_key = 'patriot_national_roster' then
    if exists (
      select 1
      from public.game_objective_claims as claim
      where claim.sporting_director_id = p_director_id
        and claim.objective_key = 'journey_patriot_gold'
    ) then
      return 35;
    end if;

    select count(distinct rider.id)::integer into v_value
    from public.team_seasons as team_season
    join public.seasons as season
      on season.id = team_season.season_id and season.status = 'active'
    join public.teams as team
      on team.id = team_season.team_id and team.status = 'active'
    join public.rider_contracts as contract
      on contract.team_id = team.id and contract.status = 'active'
    join public.seasons as start_season on start_season.id = contract.start_season_id
    join public.seasons as end_season on end_season.id = contract.end_season_id
    join public.riders as rider
      on rider.id = contract.rider_id
      and rider.status = 'active'
      and rider.country_id = team_season.registration_country_id
    join public.rider_season_ratings as ratings
      on ratings.rider_id = rider.id and ratings.season_id = season.id
    where team_season.team_id = p_current_team_id
      and team_season.status in ('active', 'planned')
      and season.game_year between start_season.game_year and end_season.game_year;
    return v_value;
  end if;

$branch$ || v_anchor);
end;
$migration$;

-- The existing objective claim grants the cash, XP and reputation atomically.
-- The existing career trophy trigger records journey_patriot for this claim.
insert into public.game_objective_definitions (
  objective_key, objective_type, objective_group, title, description,
  metric_key, target_value, reward_cash, reward_experience, reward_reputation,
  display_order, is_active
) values (
  'journey_patriot_gold', 'secondary', 'diversity', 'Le Patriote',
  'Avoir au moins 35 coureurs professionnels sous contrat de la nationalité de votre équipe.',
  'patriot_national_roster', 35, 1000000, 1000, 100, 2410, true
);

notify pgrst, 'reload schema';

commit;
