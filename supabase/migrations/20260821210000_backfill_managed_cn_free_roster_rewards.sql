begin;

-- Certains coureurs sous contrat ont été conservés dans la startlist historique
-- « Coureurs libres » des CN déjà clôturés. Leur classement est valide, mais le
-- versement normal a été ignoré faute de team_season_id sur l'inscription.
-- Cette régularisation ne modifie ni les inscriptions ni les résultats.
create temporary table cn_free_roster_reward_candidates
on commit drop
as
with eligible_rewards as (
  select
    'official-race:' || edition.id::text
      || ':rider:' || rider.id::text
      || ':v1' as source_reference,
    edition.season_id,
    stage.season_day_id,
    season_day.day_number,
    team_season.id as team_season_id,
    assignment.sporting_director_id,
    director.display_name as sporting_director_name,
    team_season.display_name as team_name,
    rider.id as rider_id,
    concat_ws(' ', rider.first_name, rider.last_name) as rider_name,
    race.name as race_name,
    rider.country_id,
    result.final_rank,
    case result.final_rank
      when 1 then 1
      else 0
    end as reputation_points,
    case result.final_rank
      when 1 then 125
      when 2 then 75
      when 3 then 45
      else 25
    end as experience_points,
    case result.final_rank
      when 1 then 10000::numeric
      when 2 then 5000::numeric
      when 3 then 2500::numeric
      else 1000::numeric
    end as cash_prize,
    result.final_rank = 1 as is_victory,
    format(
      '%s — %s · %s',
      race.name,
      concat_ws(' ', rider.first_name, rider.last_name),
      case result.final_rank
        when 1 then 'Victoire'
        else result.final_rank::text || 'e place'
      end
    ) as description,
    contract.created_at as contract_created_at
  from public.race_results as result
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
   and registration.race_edition_id = result.race_edition_id
  join public.race_editions as edition
    on edition.id = result.race_edition_id
   and edition.status = 'completed'
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in ('national_road', 'national_time_trial')
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.stage_number = 1
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
   and season_day.season_id = edition.season_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.riders as rider
    on rider.id = roster.rider_id
   and rider.status = 'active'
  join public.rider_contracts as contract
    on contract.rider_id = rider.id
   and contract.status = 'active'
   and coalesce(contract.signed_at, contract.created_at) <= stage.departure_at
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
   and team_season.season_id = edition.season_id
   and team_season.status in ('planned', 'active')
  join public.team_manager_assignments as assignment
    on assignment.team_id = contract.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
   and assignment.created_at <= stage.departure_at
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
  where result.status = 'classified'
    and result.final_rank between 1 and 5
    and registration.team_season_id is null
    and registration.historical_team_name = 'Coureurs libres'
)
select distinct on (source_reference)
  source_reference,
  season_id,
  season_day_id,
  day_number,
  team_season_id,
  sporting_director_id,
  sporting_director_name,
  team_name,
  rider_id,
  rider_name,
  race_name,
  country_id,
  final_rank,
  reputation_points,
  experience_points,
  cash_prize,
  is_victory,
  description
from eligible_rewards
order by source_reference, contract_created_at desc, sporting_director_id;

create temporary table cn_free_roster_rewards_inserted (
  source_reference text primary key
) on commit drop;

-- La contrainte unique sur reward_events.source_reference rend la migration
-- idempotente, y compris si un versement manuel a déjà régularisé un coureur.
with inserted_rewards as (
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
    candidate.source_reference,
    'race_result',
    candidate.sporting_director_id,
    candidate.team_season_id,
    candidate.rider_id,
    candidate.country_id,
    candidate.reputation_points,
    candidate.experience_points,
    candidate.cash_prize,
    0,
    candidate.description
  from cn_free_roster_reward_candidates as candidate
  on conflict (source_reference) do nothing
  returning source_reference
)
insert into cn_free_roster_rewards_inserted (source_reference)
select source_reference
from inserted_rewards;

-- Seules les lignes réellement insérées alimentent les agrégats. Un second
-- passage ne peut donc ajouter ni argent, ni expérience, ni victoire.
update public.sporting_directors as director
set
  reputation_points = director.reputation_points
    + reward.reputation_points,
  experience_points = director.experience_points
    + reward.experience_points
from (
  select
    candidate.sporting_director_id,
    sum(candidate.reputation_points)::integer as reputation_points,
    sum(candidate.experience_points)::integer as experience_points
  from cn_free_roster_reward_candidates as candidate
  join cn_free_roster_rewards_inserted as inserted
    using (source_reference)
  group by candidate.sporting_director_id
) as reward
where director.id = reward.sporting_director_id;

update public.team_seasons as team_season
set cash_balance = team_season.cash_balance + reward.cash_prize
from (
  select
    candidate.team_season_id,
    sum(candidate.cash_prize) as cash_prize
  from cn_free_roster_reward_candidates as candidate
  join cn_free_roster_rewards_inserted as inserted
    using (source_reference)
  group by candidate.team_season_id
) as reward
where team_season.id = reward.team_season_id;

insert into public.rider_season_summaries (
  rider_id,
  season_id,
  victories,
  points
)
select
  candidate.rider_id,
  candidate.season_id,
  count(*) filter (where candidate.is_victory)::integer,
  0
from cn_free_roster_reward_candidates as candidate
join cn_free_roster_rewards_inserted as inserted
  using (source_reference)
group by candidate.rider_id, candidate.season_id
on conflict (rider_id, season_id)
do update set
  victories = coalesce(public.rider_season_summaries.victories, 0)
    + excluded.victories,
  updated_at = now();

insert into public.team_finance_transactions (
  team_season_id,
  season_day_id,
  day_number,
  amount,
  category,
  status,
  description,
  source_reference,
  posted_at
)
select
  candidate.team_season_id,
  candidate.season_day_id,
  candidate.day_number,
  candidate.cash_prize,
  'race_prize',
  'posted',
  candidate.description,
  'reward:' || candidate.source_reference,
  now()
from cn_free_roster_reward_candidates as candidate
join cn_free_roster_rewards_inserted as inserted
  using (source_reference)
where candidate.cash_prize > 0
on conflict (team_season_id, source_reference) do nothing;

do $$
declare
  v_reward record;
  v_reward_count integer;
  v_total_cash numeric;
  v_total_experience integer;
  v_total_reputation integer;
begin
  for v_reward in
    select
      candidate.sporting_director_name,
      candidate.team_name,
      candidate.rider_name,
      candidate.race_name,
      candidate.final_rank,
      candidate.cash_prize,
      candidate.experience_points,
      candidate.reputation_points
    from cn_free_roster_reward_candidates as candidate
    join cn_free_roster_rewards_inserted as inserted
      using (source_reference)
    order by
      candidate.sporting_director_name,
      candidate.rider_name,
      candidate.race_name
  loop
    raise notice
      'RATTRAPAGE CN | DS: % | Equipe: % | Coureur: % | Course: % | Rang: % | Prime: % EUR | XP: % | Reputation: %',
      v_reward.sporting_director_name,
      v_reward.team_name,
      v_reward.rider_name,
      v_reward.race_name,
      v_reward.final_rank,
      v_reward.cash_prize,
      v_reward.experience_points,
      v_reward.reputation_points;
  end loop;

  select
    count(*)::integer,
    coalesce(sum(candidate.cash_prize), 0),
    coalesce(sum(candidate.experience_points), 0)::integer,
    coalesce(sum(candidate.reputation_points), 0)::integer
  into
    v_reward_count,
    v_total_cash,
    v_total_experience,
    v_total_reputation
  from cn_free_roster_reward_candidates as candidate
  join cn_free_roster_rewards_inserted as inserted
    using (source_reference);

  raise notice
    'RATTRAPAGE CN - TOTAL | Resultats: % | Primes: % EUR | XP: % | Reputation: %',
    v_reward_count,
    v_total_cash,
    v_total_experience,
    v_total_reputation;
end;
$$;

commit;
