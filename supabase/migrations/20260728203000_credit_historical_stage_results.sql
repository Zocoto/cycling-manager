begin;

create temporary table stage_sporting_reward_targets (
  source_reference text primary key,
  sporting_director_id uuid,
  team_season_id uuid not null,
  season_id uuid not null,
  rider_id uuid not null,
  country_id uuid not null,
  stage_id uuid not null,
  uci_points integer not null,
  is_victory boolean not null,
  description text not null
) on commit drop;

insert into stage_sporting_reward_targets (
  source_reference,
  sporting_director_id,
  team_season_id,
  season_id,
  rider_id,
  country_id,
  stage_id,
  uci_points,
  is_victory,
  description
)
select
  'official-stage-sporting:' || edition.id
    || ':stage:' || stage.id
    || ':rider:' || rider.id
    || ':rank:' || stage_result.rank
    || ':v1',
  manager.sporting_director_id,
  team_season.id,
  team_season.season_id,
  rider.id,
  rider.country_id,
  stage.id,
  reward.uci_points,
  stage_result.rank = 1,
  edition.display_name
    || ' — Étape ' || stage.stage_number || ' : ' || stage.name
    || ' — ' || rider.first_name || ' ' || rider.last_name
    || ' · '
    || case
      when stage_result.rank = 1 then 'Victoire d''étape'
      else stage_result.rank || 'e place'
    end
    || ' · régularisation des points d''étape'
from public.stage_results as stage_result
join public.stages as stage
  on stage.id = stage_result.stage_id
join public.race_editions as edition
  on edition.id = stage.race_edition_id
join public.races as race
  on race.id = edition.race_id
 and race.race_format = 'stage_race'
 and race.competition_type = 'standard'
join public.race_categories as category
  on category.id = edition.race_category_id
join public.race_rosters as roster
  on roster.id = stage_result.race_roster_id
join public.riders as rider
  on rider.id = roster.rider_id
join public.race_registrations as registration
  on registration.id = roster.race_registration_id
 and registration.race_edition_id = edition.id
join public.team_seasons as team_season
  on team_season.id = registration.team_season_id
left join lateral (
  select assignment.sporting_director_id
  from public.team_manager_assignments as assignment
  where assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  order by assignment.created_at desc, assignment.id
  limit 1
) as manager on true
cross join lateral (
  select case category.code
    when 'national' then case
      when stage_result.rank = 1 then 10
      when stage_result.rank = 2 then 6
      when stage_result.rank = 3 then 4
      when stage_result.rank <= 5 then 2
      else 0
    end
    when 'continental' then case
      when stage_result.rank = 1 then 25
      when stage_result.rank = 2 then 15
      when stage_result.rank = 3 then 10
      when stage_result.rank <= 5 then 5
      else 0
    end
    when 'world' then case
      when stage_result.rank = 1 then 60
      when stage_result.rank = 2 then 40
      when stage_result.rank = 3 then 25
      when stage_result.rank <= 5 then 12
      when stage_result.rank <= 10 then 5
      else 0
    end
    when 'elite' then case
      when stage_result.rank = 1 then 120
      when stage_result.rank = 2 then 80
      when stage_result.rank = 3 then 50
      when stage_result.rank <= 5 then 25
      when stage_result.rank <= 10 then 10
      else 0
    end
    else 0
  end as uci_points
) as reward
where stage_result.status = 'finished'
  and stage_result.rank is not null
  and reward.uci_points > 0;

create temporary table inserted_stage_sporting_rewards
  (like stage_sporting_reward_targets including defaults)
on commit drop;

with inserted as (
  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    rider_id,
    country_id,
    reputation_points,
    experience_points,
    cash_prize,
    uci_points,
    description
  )
  select
    target.source_reference,
    'stage_result',
    target.sporting_director_id,
    target.team_season_id,
    target.rider_id,
    target.country_id,
    0,
    0,
    0,
    target.uci_points,
    target.description
  from stage_sporting_reward_targets as target
  on conflict (source_reference) do nothing
  returning source_reference
)
insert into inserted_stage_sporting_rewards
select target.*
from stage_sporting_reward_targets as target
join inserted using (source_reference);

update public.team_seasons as team_season
set points = team_season.points + totals.uci_points
from (
  select inserted.team_season_id, sum(inserted.uci_points)::integer as uci_points
  from inserted_stage_sporting_rewards as inserted
  group by inserted.team_season_id
) as totals
where team_season.id = totals.team_season_id;

insert into public.rider_season_summaries (
  rider_id,
  season_id,
  victories,
  points
)
select
  inserted.rider_id,
  inserted.season_id,
  count(*) filter (where inserted.is_victory)::integer,
  sum(inserted.uci_points)::integer
from inserted_stage_sporting_rewards as inserted
group by inserted.rider_id, inserted.season_id
on conflict (rider_id, season_id)
do update set
  victories = coalesce(public.rider_season_summaries.victories, 0)
    + excluded.victories,
  points = coalesce(public.rider_season_summaries.points, 0)
    + excluded.points,
  updated_at = now();

do $$
declare
  target_season record;
begin
  for target_season in
    select distinct inserted.season_id
    from inserted_stage_sporting_rewards as inserted
  loop
    perform public.refresh_uci_rankings(target_season.season_id);
  end loop;
end;
$$;

commit;
