begin;

-- Repare les anciennes courses d'un jour dont le classement final a departage
-- des coureurs au meme temps par UUID au lieu de conserver l'ordre d'arrivee.
create temporary table historical_one_day_tie_repairs
on commit drop
as
select
  race_result.id as race_result_id,
  race_result.race_edition_id,
  stage.id as stage_id,
  stage.season_day_id,
  season_day.day_number,
  race_result.race_roster_id,
  roster.rider_id,
  registration.team_season_id,
  edition.season_id,
  edition.display_name as edition_name,
  rider.first_name,
  rider.last_name,
  race_result.final_rank as old_rank,
  stage_result.rank as new_rank,
  category.code as category_code,
  race.competition_type
from public.race_results as race_result
join public.race_editions as edition
  on edition.id = race_result.race_edition_id
join public.races as race
  on race.id = edition.race_id
 and race.race_format = 'one_day'
join public.race_categories as category
  on category.id = edition.race_category_id
join public.stages as stage
  on stage.race_edition_id = edition.id
join public.season_days as season_day
  on season_day.id = stage.season_day_id
join public.stage_results as stage_result
  on stage_result.stage_id = stage.id
 and stage_result.race_roster_id = race_result.race_roster_id
join public.race_rosters as roster
  on roster.id = race_result.race_roster_id
join public.race_registrations as registration
  on registration.id = roster.race_registration_id
join public.riders as rider
  on rider.id = roster.rider_id
where edition.status = 'completed'
  and race_result.status = 'classified'
  and stage_result.status = 'finished'
  and race_result.final_rank is distinct from stage_result.rank;

do $repair$
declare
  v_repair record;
  v_reward record;
  v_source_reference text;
  v_description text;
  v_old_experience integer;
  v_new_experience integer;
  v_old_cash numeric;
  v_new_cash numeric;
  v_old_uci integer;
  v_new_uci integer;
  v_target_experience integer;
  v_target_cash numeric;
  v_target_uci integer;
  v_season_id uuid;
  v_team_season_id uuid;
begin
  if not exists (select 1 from historical_one_day_tie_repairs) then
    return;
  end if;

  if exists (
    select 1
    from historical_one_day_tie_repairs
    where category_code <> 'national'
       or competition_type <> 'standard'
       or old_rank = 1
       or new_rank = 1
  ) then
    raise exception
      'Un classement historique hors du perimetre national standard doit etre examine manuellement.';
  end if;

  -- Evite les collisions avec l'index d'unicite pendant la permutation.
  update public.race_results as race_result
  set final_rank = final_rank + 1000
  where race_result.race_edition_id in (
    select distinct repair.race_edition_id
    from historical_one_day_tie_repairs as repair
  )
    and race_result.status = 'classified'
    and race_result.final_rank is not null;

  update public.race_results as race_result
  set
    final_rank = stage_result.rank,
    total_time_ms = stage_result.elapsed_time_ms,
    gap_to_winner_ms = stage_result.gap_to_winner_ms,
    updated_at = now()
  from public.stages as stage
  join public.stage_results as stage_result
    on stage_result.stage_id = stage.id
  where race_result.race_edition_id in (
    select distinct repair.race_edition_id
    from historical_one_day_tie_repairs as repair
  )
    and stage.race_edition_id = race_result.race_edition_id
    and stage_result.race_roster_id = race_result.race_roster_id
    and stage_result.status = 'finished';

  for v_repair in
    select *
    from historical_one_day_tie_repairs
    order by race_edition_id, new_rank, rider_id
  loop
    v_old_experience := case
      when v_repair.old_rank = 1 then 35
      when v_repair.old_rank = 2 then 22
      when v_repair.old_rank = 3 then 15
      when v_repair.old_rank between 4 and 5 then 10
      when v_repair.old_rank between 6 and 10 then 6
      else 0
    end;
    v_new_experience := case
      when v_repair.new_rank = 1 then 35
      when v_repair.new_rank = 2 then 22
      when v_repair.new_rank = 3 then 15
      when v_repair.new_rank between 4 and 5 then 10
      when v_repair.new_rank between 6 and 10 then 6
      else 0
    end;
    v_old_cash := case
      when v_repair.old_rank = 1 then 1200
      when v_repair.old_rank = 2 then 700
      when v_repair.old_rank = 3 then 400
      when v_repair.old_rank between 4 and 5 then 150
      else 0
    end;
    v_new_cash := case
      when v_repair.new_rank = 1 then 1200
      when v_repair.new_rank = 2 then 700
      when v_repair.new_rank = 3 then 400
      when v_repair.new_rank between 4 and 5 then 150
      else 0
    end;
    v_old_uci := case
      when v_repair.old_rank = 1 then 25
      when v_repair.old_rank = 2 then 15
      when v_repair.old_rank = 3 then 10
      when v_repair.old_rank between 4 and 5 then 6
      when v_repair.old_rank between 6 and 10 then 2
      else 0
    end;
    v_new_uci := case
      when v_repair.new_rank = 1 then 25
      when v_repair.new_rank = 2 then 15
      when v_repair.new_rank = 3 then 10
      when v_repair.new_rank between 4 and 5 then 6
      when v_repair.new_rank between 6 and 10 then 2
      else 0
    end;

    v_source_reference :=
      'official-race:' || v_repair.race_edition_id::text ||
      ':rider:' || v_repair.rider_id::text || ':v1';
    v_description :=
      v_repair.edition_name || U&' \2014 ' ||
      v_repair.first_name || ' ' || v_repair.last_name ||
      U&' \00B7 ' || v_repair.new_rank::text || 'e place';

    select reward.*
    into v_reward
    from public.reward_events as reward
    where reward.source_reference = v_source_reference
    for update;

    if not found then
      if v_old_experience = 0
        and v_new_experience = 0
        and v_old_cash = 0
        and v_new_cash = 0
        and v_old_uci = 0
        and v_new_uci = 0 then
        continue;
      end if;
      raise exception
        'Recompense historique introuvable pour %.',
        v_source_reference;
    end if;

    v_target_experience := greatest(
      0,
      v_reward.experience_points + v_new_experience - v_old_experience
    );
    v_target_cash := greatest(
      0,
      v_reward.cash_prize + v_new_cash - v_old_cash
    );
    v_target_uci := greatest(
      0,
      v_reward.uci_points + v_new_uci - v_old_uci
    );

    update public.sporting_directors
    set experience_points = greatest(
      0,
      experience_points + v_new_experience - v_old_experience
    )
    where id = v_reward.sporting_director_id;

    update public.team_seasons
    set
      points = greatest(0, points + v_new_uci - v_old_uci),
      cash_balance = cash_balance + v_new_cash - v_old_cash
    where id = v_reward.team_season_id;

    update public.rider_season_summaries
    set
      points = greatest(0, coalesce(points, 0) + v_new_uci - v_old_uci),
      updated_at = now()
    where rider_id = v_repair.rider_id
      and season_id = v_repair.season_id;

    if v_target_cash > 0 then
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
        v_reward.team_season_id,
        v_repair.season_day_id,
        v_repair.day_number,
        v_target_cash,
        'race_prize',
        'posted',
        v_description,
        'reward:' || v_source_reference,
        coalesce(v_reward.created_at, now())
      )
      on conflict (team_season_id, source_reference)
      do update set
        amount = excluded.amount,
        description = excluded.description;
    else
      delete from public.team_finance_transactions
      where team_season_id = v_reward.team_season_id
        and source_reference = 'reward:' || v_source_reference;
    end if;

    update public.reward_events
    set
      experience_points = v_target_experience,
      cash_prize = v_target_cash,
      uci_points = v_target_uci,
      description = v_description
    where id = v_reward.id;
  end loop;

  for v_season_id in
    select distinct season_id
    from historical_one_day_tie_repairs
  loop
    perform public.refresh_uci_rankings(v_season_id);
  end loop;

  for v_team_season_id in
    select distinct team_season_id
    from historical_one_day_tie_repairs
  loop
    perform public.evaluate_team_sponsor_objectives(
      v_team_season_id,
      false
    );
  end loop;
end;
$repair$;

commit;
