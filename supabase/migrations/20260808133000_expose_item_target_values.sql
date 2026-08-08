begin;

create or replace function public.get_current_team_item_target_values()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with current_context as (
    select
      assignment.team_id,
      season.id as season_id,
      season.game_year
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.seasons as season
      on season.status = 'active'
    where director.auth_user_id = auth.uid()
      and director.status = 'active'
    limit 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rider.id,
        'firstName', rider.first_name,
        'lastName', rider.last_name,
        'name', rider.first_name || ' ' || rider.last_name,
        'countryName', country.name,
        'form', coalesce(current_condition.form, 75),
        'experienceDays', coalesce(rider.career_race_days, 0),
        'potentialSteps', rider.potential_steps,
        'ratings', jsonb_build_object(
          'mountain', rating.mountain,
          'hills', rating.hills,
          'flat', rating.flat,
          'time_trial', rating.time_trial,
          'cobbles', rating.cobbles,
          'sprint', rating.sprint,
          'acceleration', rating.acceleration,
          'downhill', rating.downhill,
          'endurance', rating.endurance,
          'resistance', rating.resistance,
          'recovery', rating.recovery,
          'breakaway', rating.breakaway,
          'prologue', rating.prologue
        ),
        'abilityCodes', coalesce(abilities.codes, '[]'::jsonb)
      )
      order by rider.last_name, rider.first_name
    ),
    '[]'::jsonb
  )
  from current_context as context
  join public.rider_contracts as contract
    on contract.team_id = context.team_id
   and contract.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
   and start_season.game_year <= context.game_year
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
   and end_season.game_year >= context.game_year
  join public.riders as rider
    on rider.id = contract.rider_id
   and rider.status = 'active'
  join public.countries as country
    on country.id = rider.country_id
  join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = context.season_id
  left join lateral (
    select condition.form
    from public.rider_condition_states as condition
    join public.season_days as condition_day
      on condition_day.id = condition.season_day_id
     and condition_day.season_id = context.season_id
    where condition.rider_id = rider.id
    order by condition_day.day_number desc, condition.updated_at desc
    limit 1
  ) as current_condition on true
  left join lateral (
    select jsonb_agg(ability.ability_code order by ability.ability_code) as codes
    from public.rider_special_abilities as ability
    where ability.rider_id = rider.id
  ) as abilities on true;
$$;

revoke all on function public.get_current_team_item_target_values()
  from public, anon;
grant execute on function public.get_current_team_item_target_values()
  to authenticated, service_role;

comment on function public.get_current_team_item_target_values() is
  'Expose au DS les valeurs actuelles nécessaires pour choisir le bénéficiaire d’un objet ou cadeau.';

notify pgrst, 'reload schema';

commit;
