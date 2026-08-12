begin;
-- Regularisation non destructive des CM et CC de S1. Le moteur avait deja
-- verse le bareme CN : on credite uniquement l'ecart avec la nouvelle grille.
do $$
declare
  v_result record;
  v_existing_reputation integer;
  v_existing_experience integer;
  v_existing_cash numeric;
  v_existing_uci integer;
  v_delta_reputation integer;
  v_delta_experience integer;
  v_delta_cash numeric;
  v_delta_uci integer;
  v_adjusted_count integer := 0;
begin
  for v_result in
    select
      result.race_roster_id,
      roster.rider_id,
      edition.id as race_edition_id,
      edition.display_name,
      final_stage.id as stage_id,
      race.competition_type,
      result.final_rank,
      case race.competition_type
        when 'continental_championship' then
          case
            when result.final_rank = 1 then 2
            when result.final_rank = 2 then 1
            else 0
          end
        when 'world_championship' then
          case
            when result.final_rank = 1 then 5
            when result.final_rank = 2 then 3
            when result.final_rank = 3 then 2
            when result.final_rank <= 5 then 1
            else 0
          end
      end as target_reputation,
      case race.competition_type
        when 'continental_championship' then
          case
            when result.final_rank = 1 then 250
            when result.final_rank = 2 then 150
            when result.final_rank = 3 then 90
            when result.final_rank <= 5 then 50
            else 25
          end
        when 'world_championship' then
          case
            when result.final_rank = 1 then 625
            when result.final_rank = 2 then 375
            when result.final_rank = 3 then 225
            when result.final_rank <= 5 then 125
            else 60
          end
      end as target_experience,
      case race.competition_type
        when 'continental_championship' then
          case
            when result.final_rank = 1 then 20000
            when result.final_rank = 2 then 10000
            when result.final_rank = 3 then 5000
            when result.final_rank <= 5 then 2000
            else 0
          end
        when 'world_championship' then
          case
            when result.final_rank = 1 then 50000
            when result.final_rank = 2 then 25000
            when result.final_rank = 3 then 12500
            when result.final_rank <= 5 then 5000
            else 2000
          end
      end::numeric as target_cash,
      case race.competition_type
        when 'continental_championship' then
          case
            when result.final_rank = 1 then 250
            when result.final_rank = 2 then 150
            when result.final_rank = 3 then 100
            when result.final_rank <= 5 then 60
            else 25
          end
        when 'world_championship' then
          case
            when result.final_rank = 1 then 600
            when result.final_rank = 2 then 475
            when result.final_rank = 3 then 400
            when result.final_rank <= 5 then 325
            else 200
          end
      end as target_uci
    from public.race_results as result
    join public.race_rosters as roster
      on roster.id = result.race_roster_id
    join public.race_editions as edition
      on edition.id = result.race_edition_id
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 1
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type in (
       'continental_championship',
       'world_championship'
     )
    join lateral (
      select stage.id
      from public.stages as stage
      where stage.race_edition_id = edition.id
      order by stage.stage_number desc
      limit 1
    ) as final_stage on true
    where result.status = 'classified'
      and result.final_rank between 1 and 10
    order by edition.id, result.final_rank
  loop
    select
      coalesce(max(reward.reputation_points), 0)::integer,
      coalesce(max(reward.experience_points), 0)::integer,
      coalesce(max(reward.cash_prize), 0)::numeric,
      coalesce(max(reward.uci_points), 0)::integer
    into
      v_existing_reputation,
      v_existing_experience,
      v_existing_cash,
      v_existing_uci
    from public.reward_events as reward
    where reward.source_reference =
      'official-race:' || v_result.race_edition_id::text
      || ':rider:' || v_result.rider_id::text || ':v1';

    v_delta_reputation := greatest(
      0,
      v_result.target_reputation - v_existing_reputation
    );
    v_delta_experience := greatest(
      0,
      v_result.target_experience - v_existing_experience
    );
    v_delta_cash := greatest(
      0,
      v_result.target_cash - v_existing_cash
    );
    v_delta_uci := greatest(
      0,
      v_result.target_uci - v_existing_uci
    );

    if v_delta_reputation > 0
      or v_delta_experience > 0
      or v_delta_cash > 0
      or v_delta_uci > 0
    then
      perform public.apply_race_roster_competition_reward(
        's1-international-reward-adjustment:'
          || v_result.race_edition_id::text
          || ':rider:' || v_result.rider_id::text || ':v1',
        'race_result',
        v_result.race_roster_id,
        v_result.stage_id,
        v_delta_reputation,
        v_delta_experience,
        v_delta_cash,
        v_delta_uci,
        false,
        v_result.display_name
          || ' - regularisation retroactive des gains S1'
      );
      v_adjusted_count := v_adjusted_count + 1;
    end if;
  end loop;

  raise notice
    'Regularisation S1 CM/CC appliquee a % resultats.',
    v_adjusted_count;
end;
$$;
commit;
