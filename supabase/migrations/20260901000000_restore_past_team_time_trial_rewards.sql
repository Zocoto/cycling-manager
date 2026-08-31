begin;

-- Décision produit : les étapes parties avant le 1er septembre 2026 conservent
-- le règlement individuel que les membres ont déjà vu. Le classement collectif
-- ne s'appliquera qu'aux TTT prenant leur départ à compter de cette date.
create temporary table ttt_collective_rewards_to_restore
on commit drop
as
select
  reward.id,
  reward.source_reference,
  reward.sporting_director_id,
  reward.team_season_id,
  reward.reputation_points,
  reward.experience_points,
  reward.cash_prize,
  reward.uci_points,
  stage.id as stage_id,
  stage.race_edition_id
from public.reward_events as reward
join public.stages as stage
  on stage.stage_type = 'team_time_trial'
 and stage.departure_at < timestamptz '2026-08-31 22:00:00+00'
 and reward.source_reference like
   'official-ttt-stage:%:stage:' || stage.id::text || ':team-season:%';

create temporary table ttt_stages_to_restore
on commit drop
as
select distinct collective.stage_id, collective.race_edition_id
from ttt_collective_rewards_to_restore as collective;

-- Neutralise exactement les régularisations collectives appliquées au tour
-- précédent, avant de reconstruire les écritures historiques d'origine.
update public.sporting_directors as director
set
  reputation_points = greatest(
    0,
    director.reputation_points - totals.reputation_points
  ),
  experience_points = greatest(
    0,
    director.experience_points - totals.experience_points
  )
from (
  select
    collective.sporting_director_id,
    sum(collective.reputation_points) as reputation_points,
    sum(collective.experience_points) as experience_points
  from ttt_collective_rewards_to_restore as collective
  where collective.sporting_director_id is not null
  group by collective.sporting_director_id
) as totals
where director.id = totals.sporting_director_id;

update public.team_seasons as team_season
set
  points = team_season.points - totals.uci_points,
  cash_balance = team_season.cash_balance - totals.cash_prize
from (
  select
    collective.team_season_id,
    sum(collective.uci_points)::integer as uci_points,
    sum(collective.cash_prize) as cash_prize
  from ttt_collective_rewards_to_restore as collective
  group by collective.team_season_id
) as totals
where team_season.id = totals.team_season_id;

delete from public.team_finance_transactions as transaction
using ttt_collective_rewards_to_restore as collective
where transaction.team_season_id = collective.team_season_id
  and transaction.source_reference = 'reward:' || collective.source_reference;

delete from public.reward_events as reward
using ttt_collective_rewards_to_restore as collective
where reward.id = collective.id;

create temporary table ttt_historical_rider_reward_targets
on commit drop
as
with reward_context as (
  select
    edition.id as race_edition_id,
    edition.display_name as edition_name,
    category.code as category_code,
    stage.id as stage_id,
    stage.stage_number,
    stage.name as stage_name,
    result.race_roster_id,
    rider.id as rider_id,
    rider.first_name || ' ' || rider.last_name as rider_name,
    result.rank,
    final_stage.id as finance_stage_id
  from ttt_stages_to_restore as target_stage
  join public.stages as stage
    on stage.id = target_stage.stage_id
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
   and race.race_format = 'stage_race'
   and race.competition_type = 'standard'
  join public.race_categories as category
    on category.id = edition.race_category_id
  join public.stage_results as result
    on result.stage_id = stage.id
   and result.status = 'finished'
   and result.rank is not null
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
   and registration.race_edition_id = edition.id
   and registration.team_season_id is not null
  join lateral (
    select candidate.id
    from public.stages as candidate
    where candidate.race_edition_id = edition.id
    order by candidate.stage_number desc, candidate.id
    limit 1
  ) as final_stage on true
)
select
  context.*,
  case context.category_code
    when 'regional' then case
      when context.rank = 1 then 600
      when context.rank = 2 then 350
      when context.rank = 3 then 200
      when context.rank <= 5 then 100
      else 0
    end
    when 'national' then case
      when context.rank = 1 then 1200
      when context.rank = 2 then 700
      when context.rank = 3 then 400
      when context.rank <= 5 then 150
      else 0
    end
    when 'continental' then case
      when context.rank = 1 then 1800
      when context.rank = 2 then 1000
      when context.rank = 3 then 600
      when context.rank <= 5 then 250
      else 0
    end
    when 'world' then case
      when context.rank = 1 then 5000
      when context.rank = 2 then 3000
      when context.rank = 3 then 1800
      when context.rank <= 5 then 750
      when context.rank <= 10 then 250
      else 0
    end
    when 'elite' then case
      when context.rank = 1 then 12000
      when context.rank = 2 then 7000
      when context.rank = 3 then 4000
      when context.rank <= 5 then 1800
      when context.rank <= 10 then 500
      else 0
    end
    else 0
  end::numeric as cash_prize,
  case context.category_code
    when 'regional' then case
      when context.rank = 1 then 10
      when context.rank = 2 then 6
      when context.rank = 3 then 4
      when context.rank <= 5 then 2
      else 0
    end
    when 'national' then case
      when context.rank = 1 then 18
      when context.rank = 2 then 10
      when context.rank = 3 then 6
      when context.rank <= 5 then 3
      else 0
    end
    when 'continental' then case
      when context.rank = 1 then 25
      when context.rank = 2 then 15
      when context.rank = 3 then 10
      when context.rank <= 5 then 5
      else 0
    end
    when 'world' then case
      when context.rank = 1 then 60
      when context.rank = 2 then 40
      when context.rank = 3 then 25
      when context.rank <= 5 then 12
      when context.rank <= 10 then 5
      else 0
    end
    when 'elite' then case
      when context.rank = 1 then 120
      when context.rank = 2 then 80
      when context.rank = 3 then 50
      when context.rank <= 5 then 25
      when context.rank <= 10 then 10
      else 0
    end
    else 0
  end::integer as uci_points
from reward_context as context;

do $migration$
declare
  target record;
  description text;
begin
  for target in
    select *
    from ttt_historical_rider_reward_targets
    where cash_prize > 0 or uci_points > 0
    order by stage_id, rank, rider_id
  loop
    description := target.edition_name
      || ' — Étape ' || target.stage_number || ' : ' || target.stage_name
      || ' — ' || target.rider_name || ' · '
      || case
        when target.rank = 1 then 'Victoire d''étape'
        else target.rank || 'e place'
      end
      || ' · règlement historique conservé';

    if target.cash_prize > 0 then
      perform public.apply_race_roster_competition_reward(
        'official-stage-prize:' || target.race_edition_id
          || ':stage:' || target.stage_id
          || ':rider:' || target.rider_id
          || ':v1',
        'stage_result',
        target.race_roster_id,
        target.finance_stage_id,
        0,
        0,
        target.cash_prize,
        0,
        false,
        description
      );
    end if;

    if target.uci_points > 0 then
      perform public.apply_race_roster_competition_reward(
        'official-stage-sporting:' || target.race_edition_id
          || ':stage:' || target.stage_id
          || ':rider:' || target.rider_id
          || ':rank:' || target.rank
          || ':v1',
        'stage_result',
        target.race_roster_id,
        target.stage_id,
        0,
        0,
        0,
        target.uci_points,
        target.rank = 1,
        description
      );
    end if;
  end loop;
end;
$migration$;

do $verification$
begin
  if exists (
    select 1
    from public.reward_events as reward
    join public.stages as stage
      on stage.stage_type = 'team_time_trial'
     and stage.departure_at < timestamptz '2026-08-31 22:00:00+00'
     and reward.source_reference like
       'official-ttt-stage:%:stage:' || stage.id::text || ':team-season:%'
  ) then
    raise exception 'Un ancien TTT possède encore un règlement collectif.';
  end if;
end;
$verification$;

commit;
