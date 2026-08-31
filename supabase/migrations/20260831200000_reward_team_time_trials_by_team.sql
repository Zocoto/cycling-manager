begin;

-- Un CLM par équipes ne possède pas de bénéficiaire individuel : une seule
-- récompense est portée par l'équipe de saison, quel que soit le nombre de
-- coureurs encore groupés à l'arrivée.
create or replace function public.apply_team_time_trial_stage_reward(
  p_source_reference text,
  p_team_season_id uuid,
  p_stage_id uuid,
  p_finance_stage_id uuid,
  p_reputation_points integer,
  p_experience_points integer,
  p_cash_prize numeric,
  p_uci_points integer,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_reward_id uuid;
begin
  if nullif(btrim(p_source_reference), '') is null then
    raise exception 'La référence de récompense TTT est obligatoire.';
  end if;
  if nullif(btrim(p_description), '') is null then
    raise exception 'La description de récompense TTT est obligatoire.';
  end if;

  select
    team_season.season_id,
    manager.sporting_director_id,
    finance_day.id as season_day_id,
    finance_day.day_number
  into v_context
  from public.team_seasons as team_season
  join public.stages as source_stage
    on source_stage.id = p_stage_id
   and source_stage.stage_type = 'team_time_trial'
  join public.race_editions as edition
    on edition.id = source_stage.race_edition_id
   and edition.season_id = team_season.season_id
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.team_season_id = team_season.id
   and registration.status = 'accepted'
  join public.stages as finance_stage
    on finance_stage.id = p_finance_stage_id
   and finance_stage.race_edition_id = edition.id
  join public.season_days as finance_day
    on finance_day.id = finance_stage.season_day_id
   and finance_day.season_id = team_season.season_id
  left join lateral (
    select assignment.sporting_director_id
    from public.team_manager_assignments as assignment
    where assignment.team_id = team_season.team_id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
    order by assignment.created_at desc, assignment.id
    limit 1
  ) as manager on true
  where team_season.id = p_team_season_id
  limit 1;

  if v_context is null then
    raise exception 'L’équipe ne possède pas de contexte valide pour ce CLM par équipes.';
  end if;

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
  values (
    btrim(p_source_reference),
    'stage_result',
    v_context.sporting_director_id,
    p_team_season_id,
    null,
    null,
    greatest(0, p_reputation_points),
    greatest(0, p_experience_points),
    greatest(0, p_cash_prize),
    greatest(0, p_uci_points),
    btrim(p_description)
  )
  on conflict (source_reference) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    select reward.id
    into v_reward_id
    from public.reward_events as reward
    where reward.source_reference = btrim(p_source_reference);
    return v_reward_id;
  end if;

  update public.sporting_directors
  set
    reputation_points = reputation_points + greatest(0, p_reputation_points),
    experience_points = experience_points + greatest(0, p_experience_points)
  where id = v_context.sporting_director_id;

  update public.team_seasons
  set
    points = points + greatest(0, p_uci_points),
    cash_balance = cash_balance + greatest(0, p_cash_prize)
  where id = p_team_season_id;

  if p_cash_prize > 0 then
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
    values (
      p_team_season_id,
      v_context.season_day_id,
      v_context.day_number,
      p_cash_prize,
      'race_prize',
      'posted',
      btrim(p_description),
      'reward:' || btrim(p_source_reference),
      now()
    )
    on conflict (team_season_id, source_reference) do nothing;
  end if;

  perform public.refresh_uci_rankings(v_context.season_id);
  return v_reward_id;
end;
$$;

revoke all on function public.apply_team_time_trial_stage_reward(
  text, uuid, uuid, uuid, integer, integer, numeric, integer, text
) from public, anon, authenticated;

grant execute on function public.apply_team_time_trial_stage_reward(
  text, uuid, uuid, uuid, integer, integer, numeric, integer, text
) to service_role;

comment on function public.apply_team_time_trial_stage_reward(
  text, uuid, uuid, uuid, integer, integer, numeric, integer, text
) is
  'Crédite une seule fois à une équipe les gains liés à sa place sur une étape TTT, sans les attribuer à un coureur.';

-- Réconcilie les TTT déjà réglés avec l'ancien classement individuel. Les
-- étapes dont le tour n'est pas encore clôturé ne possèdent aucun ancien gain
-- et seront naturellement prises en charge par le nouveau service.
create temporary table ttt_legacy_rider_rewards
on commit drop
as
select
  reward.id,
  reward.source_reference,
  reward.sporting_director_id,
  reward.team_season_id,
  team_season.season_id,
  reward.rider_id,
  reward.reputation_points,
  reward.experience_points,
  reward.cash_prize,
  reward.uci_points,
  stage.id as stage_id,
  stage.race_edition_id,
  reward.source_reference like 'official-stage-sporting:%'
    and reward.source_reference like '%:rank:1:v1' as is_victory
from public.reward_events as reward
join public.team_seasons as team_season
  on team_season.id = reward.team_season_id
join public.stages as stage
  on stage.stage_type = 'team_time_trial'
 and (
   reward.source_reference like
     'official-stage-prize:%:stage:' || stage.id::text || ':rider:%'
   or reward.source_reference like
     'official-stage-sporting:%:stage:' || stage.id::text || ':rider:%'
 );

create temporary table ttt_stages_to_reconcile
on commit drop
as
select distinct legacy.stage_id, legacy.race_edition_id
from ttt_legacy_rider_rewards as legacy;

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
    legacy.sporting_director_id,
    sum(legacy.reputation_points) as reputation_points,
    sum(legacy.experience_points) as experience_points
  from ttt_legacy_rider_rewards as legacy
  where legacy.sporting_director_id is not null
  group by legacy.sporting_director_id
) as totals
where director.id = totals.sporting_director_id;

update public.team_seasons as team_season
set
  points = team_season.points - totals.uci_points,
  cash_balance = team_season.cash_balance - totals.cash_prize
from (
  select
    legacy.team_season_id,
    sum(legacy.uci_points)::integer as uci_points,
    sum(legacy.cash_prize) as cash_prize
  from ttt_legacy_rider_rewards as legacy
  group by legacy.team_season_id
) as totals
where team_season.id = totals.team_season_id;

update public.rider_season_summaries as summary
set
  victories = greatest(0, coalesce(summary.victories, 0) - totals.victories),
  points = greatest(0, coalesce(summary.points, 0) - totals.uci_points),
  updated_at = now()
from (
  select
    legacy.rider_id,
    legacy.season_id,
    count(*) filter (where legacy.is_victory)::integer as victories,
    sum(legacy.uci_points)::integer as uci_points
  from ttt_legacy_rider_rewards as legacy
  where legacy.rider_id is not null
  group by legacy.rider_id, legacy.season_id
) as totals
where summary.rider_id = totals.rider_id
  and summary.season_id = totals.season_id;

delete from public.team_finance_transactions as transaction
using ttt_legacy_rider_rewards as legacy
where transaction.team_season_id = legacy.team_season_id
  and transaction.source_reference = 'reward:' || legacy.source_reference;

delete from public.reward_events as reward
using ttt_legacy_rider_rewards as legacy
where reward.id = legacy.id;

create temporary table ttt_team_reward_targets
on commit drop
as
with team_times as (
  select
    stage.id as stage_id,
    stage.race_edition_id,
    registration.team_season_id,
    team_season.display_name as team_name,
    min(result.elapsed_time_ms) as team_time_ms
  from ttt_stages_to_reconcile as target_stage
  join public.stages as stage
    on stage.id = target_stage.stage_id
  join public.stage_results as result
    on result.stage_id = stage.id
   and result.status = 'finished'
   and result.elapsed_time_ms is not null
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
   and registration.race_edition_id = stage.race_edition_id
   and registration.team_season_id is not null
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  group by
    stage.id,
    stage.race_edition_id,
    registration.team_season_id,
    team_season.display_name
), ranked_teams as (
  select
    team_time.*,
    row_number() over (
      partition by team_time.stage_id
      order by
        team_time.team_time_ms,
        team_time.team_name,
        team_time.team_season_id
    )::integer as team_rank
  from team_times as team_time
), reward_context as (
  select
    ranked.*,
    edition.display_name as edition_name,
    category.code as category_code,
    stage.stage_number,
    stage.name as stage_name,
    final_stage.id as finance_stage_id
  from ranked_teams as ranked
  join public.stages as stage
    on stage.id = ranked.stage_id
  join public.race_editions as edition
    on edition.id = ranked.race_edition_id
  join public.race_categories as category
    on category.id = edition.race_category_id
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
      when context.team_rank = 1 then 600
      when context.team_rank = 2 then 350
      when context.team_rank = 3 then 200
      when context.team_rank <= 5 then 100
      else 0
    end
    when 'national' then case
      when context.team_rank = 1 then 1200
      when context.team_rank = 2 then 700
      when context.team_rank = 3 then 400
      when context.team_rank <= 5 then 150
      else 0
    end
    when 'continental' then case
      when context.team_rank = 1 then 1800
      when context.team_rank = 2 then 1000
      when context.team_rank = 3 then 600
      when context.team_rank <= 5 then 250
      else 0
    end
    when 'world' then case
      when context.team_rank = 1 then 5000
      when context.team_rank = 2 then 3000
      when context.team_rank = 3 then 1800
      when context.team_rank <= 5 then 750
      when context.team_rank <= 10 then 250
      else 0
    end
    when 'elite' then case
      when context.team_rank = 1 then 12000
      when context.team_rank = 2 then 7000
      when context.team_rank = 3 then 4000
      when context.team_rank <= 5 then 1800
      when context.team_rank <= 10 then 500
      else 0
    end
    else 0
  end::numeric as cash_prize,
  case context.category_code
    when 'regional' then case
      when context.team_rank = 1 then 10
      when context.team_rank = 2 then 6
      when context.team_rank = 3 then 4
      when context.team_rank <= 5 then 2
      else 0
    end
    when 'national' then case
      when context.team_rank = 1 then 18
      when context.team_rank = 2 then 10
      when context.team_rank = 3 then 6
      when context.team_rank <= 5 then 3
      else 0
    end
    when 'continental' then case
      when context.team_rank = 1 then 25
      when context.team_rank = 2 then 15
      when context.team_rank = 3 then 10
      when context.team_rank <= 5 then 5
      else 0
    end
    when 'world' then case
      when context.team_rank = 1 then 60
      when context.team_rank = 2 then 40
      when context.team_rank = 3 then 25
      when context.team_rank <= 5 then 12
      when context.team_rank <= 10 then 5
      else 0
    end
    when 'elite' then case
      when context.team_rank = 1 then 120
      when context.team_rank = 2 then 80
      when context.team_rank = 3 then 50
      when context.team_rank <= 5 then 25
      when context.team_rank <= 10 then 10
      else 0
    end
    else 0
  end::integer as uci_points
from reward_context as context;

do $migration$
declare
  target record;
begin
  for target in
    select *
    from ttt_team_reward_targets
    where cash_prize > 0 or uci_points > 0
    order by stage_id, team_rank
  loop
    perform public.apply_team_time_trial_stage_reward(
      'official-ttt-stage:' || target.race_edition_id
        || ':stage:' || target.stage_id
        || ':team-season:' || target.team_season_id
        || ':v1',
      target.team_season_id,
      target.stage_id,
      target.finance_stage_id,
      0,
      0,
      target.cash_prize,
      target.uci_points,
      target.edition_name
        || ' — Étape ' || target.stage_number || ' : ' || target.stage_name
        || ' — ' || target.team_name || ' · '
        || case
          when target.team_rank = 1 then 'Victoire'
          else target.team_rank || 'e place'
        end
        || ' du CLM par équipes · régularisation collective'
    );
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
