begin;

-- Les identifiants sont transmis dans le corps POST de la RPC. Cela évite les
-- URLs PostgREST surdimensionnées qui provoquaient des HTTP 400 lorsque le
-- calendrier complet contenait plusieurs centaines de coureurs.
create or replace function public.get_race_calendar_rider_context(
  p_rider_ids uuid[]
)
returns table (
  id uuid,
  country_id uuid,
  avatar_profile_key text,
  avatar_seed bigint,
  career_race_days integer,
  special_ability_codes jsonb,
  performance_preparations jsonb,
  championship_titles jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with requested_riders as (
    select distinct requested.id
    from unnest(coalesce(p_rider_ids, array[]::uuid[])) as requested(id)
  )
  select
    rider.id,
    rider.country_id,
    rider.avatar_profile_key,
    rider.avatar_seed,
    rider.career_race_days,
    coalesce(abilities.values, '[]'::jsonb),
    coalesce(preparations.values, '[]'::jsonb),
    coalesce(titles.values, '[]'::jsonb)
  from requested_riders as requested
  join public.riders as rider
    on rider.id = requested.id
  left join lateral (
    select jsonb_agg(ability.ability_code order by ability.ability_code) as values
    from public.rider_special_abilities as ability
    where ability.rider_id = rider.id
  ) as abilities on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'preparation_type', preparation.preparation_type,
        'bonus_start_game_day', preparation.bonus_start_game_day,
        'bonus_end_game_day', preparation.bonus_end_game_day,
        'rating_bonus', preparation.rating_bonus
      )
      order by preparation.bonus_start_game_day, preparation.preparation_type
    ) as values
    from public.rider_performance_preparations as preparation
    where preparation.rider_id = rider.id
      and preparation.status <> 'cancelled'
  ) as preparations on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'championship_type', title.championship_type,
        'country_code', country.iso_alpha2,
        'country_name', country.name
      )
      order by title.championship_type
    ) as values
    from public.rider_national_championship_titles as title
    left join public.countries as country
      on country.id = title.country_id
    where title.rider_id = rider.id
      and title.relinquished_at is null
  ) as titles on true
  order by rider.id;
$$;

comment on function public.get_race_calendar_rider_context(uuid[]) is
  'Contexte coureur compact du calendrier, transmis par tableau UUID dans le corps POST et réservé au backend.';

revoke all
on function public.get_race_calendar_rider_context(uuid[])
from public, anon, authenticated;

grant execute
on function public.get_race_calendar_rider_context(uuid[])
to service_role;

-- Version ciblable de la startlist. La fonction historique sans argument est
-- conservée pour garantir la compatibilité avec les autres écrans.
create or replace function public.get_calendar_engaged_riders(
  p_race_edition_ids uuid[]
)
returns table (
  race_edition_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_id uuid,
  team_name text,
  team_primary_color text,
  team_secondary_color text,
  age integer,
  form integer,
  race_role text,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  acceleration integer,
  downhill integer,
  endurance integer,
  resistance integer,
  recovery integer,
  breakaway integer,
  prologue integer,
  equipment_effects jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    rider.id,
    rider.first_name,
    rider.last_name,
    coalesce(team.id, race.country_id),
    coalesce(team_season.display_name, registration.historical_team_name),
    coalesce(team.amateur_jersey_primary_color, '#6B7280'),
    coalesce(team.amateur_jersey_secondary_color, '#E5E7EB'),
    coalesce(rating.age, 25)::integer,
    coalesce(roster.starting_form, condition.form, 75)::integer,
    roster.race_role,
    coalesce(rating.mountain, 50)::integer,
    coalesce(rating.hills, 50)::integer,
    coalesce(rating.flat, 50)::integer,
    coalesce(rating.time_trial, 50)::integer,
    coalesce(rating.cobbles, 50)::integer,
    coalesce(rating.sprint, 50)::integer,
    coalesce(rating.acceleration, 50)::integer,
    coalesce(rating.downhill, 50)::integer,
    coalesce(rating.endurance, 50)::integer,
    coalesce(rating.resistance, 50)::integer,
    coalesce(rating.recovery, 50)::integer,
    coalesce(rating.breakaway, 50)::integer,
    coalesce(rating.prologue, 50)::integer,
    coalesce(equipment.effects, '[]'::jsonb)
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.races as race
    on race.id = edition.race_id
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  left join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  left join public.teams as team
    on team.id = team_season.team_id
  join public.riders as rider
    on rider.id = roster.rider_id
  left join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = edition.season_id
  left join lateral (
    select state.form
    from public.rider_condition_states as state
    join public.season_days as condition_day
      on condition_day.id = state.season_day_id
     and condition_day.season_id = edition.season_id
    where state.rider_id = rider.id
      and condition_day.day_number <= coalesce(season.current_day_number, 28)
    order by condition_day.day_number desc
    limit 1
  ) as condition on true
  left join lateral (
    select jsonb_agg(resolved.effect_payload order by resolved.slot_type) as effects
    from (
      select
        assignment.slot_type,
        (
          case
            when item.acquisition_channel = 'commercial' then item.effect_payload
            else partner_effect.effect_payload
          end
        ) || jsonb_build_object('_slotType', assignment.slot_type) as effect_payload
      from public.rider_equipment_assignments as assignment
      join public.equipment_catalog_items as item
        on item.id = assignment.equipment_item_id
       and item.status = 'active'
      left join lateral (
        select effect.effect_payload
        from public.equipment_partner_item_effects as effect
        join public.equipment_partner_contracts as contract
          on contract.id = effect.contract_id
         and contract.team_id = team.id
         and contract.supplier_key = item.supplier_key
         and contract.status = 'active'
        join public.seasons as contract_start
          on contract_start.id = contract.start_season_id
        join public.seasons as contract_end
          on contract_end.id = contract.end_season_id
        where effect.equipment_item_id = item.id
          and season.game_year between contract_start.game_year and contract_end.game_year
        limit 1
      ) as partner_effect on true
      where assignment.rider_id = rider.id
        and (
          item.acquisition_channel = 'commercial'
          or partner_effect.effect_payload is not null
        )
    ) as resolved
  ) as equipment on true
  where edition.status <> 'cancelled'
    and edition.id = any(coalesce(p_race_edition_ids, array[]::uuid[]))
  order by
    edition.id,
    coalesce(team_season.display_name, registration.historical_team_name),
    roster.bib_number nulls last,
    rider.last_name,
    rider.first_name;
$$;

comment on function public.get_calendar_engaged_riders(uuid[]) is
  'Startlists officielles limitées aux éditions demandées, sans charger toute la saison active.';

revoke all
on function public.get_calendar_engaged_riders(uuid[])
from public, anon;

grant execute
on function public.get_calendar_engaged_riders(uuid[])
to authenticated, service_role;

commit;
