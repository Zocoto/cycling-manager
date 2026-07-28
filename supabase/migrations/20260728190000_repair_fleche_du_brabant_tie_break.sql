begin;

-- La simulation et le classement d'etape placaient correctement Gerard
-- devant Rodrigues. Le classement final d'une course d'un jour recalculait
-- toutefois les egalites de temps avec l'UUID du coureur, ce qui a inverse les
-- deux premieres places. La correction applicative conserve desormais les
-- places d'etape ; cette migration repare atomiquement les consequences deja
-- publiees sur cette edition.
do $repair$
declare
  v_edition_id constant uuid := 'cb12ee5d-a0f8-437f-8033-f89a7e7e4e29';
  v_stage_id constant uuid := '3d757758-5048-47de-a671-9e9d1ffee6c1';
  v_season_id constant uuid := '60c614bd-8c70-4dca-bd30-242962c8f253';
  v_rodrigues_id constant uuid := '4b51b3fc-a029-462c-8f94-767e5613f729';
  v_gerard_id constant uuid := '7ea8214f-a593-4ea0-988a-8c9941c05ca7';
  v_gerard_roster_id constant uuid := '64274a58-9d35-4496-a10f-25af7e9f681f';
  v_reward record;
  v_target record;
begin
  if not exists (
    select 1
    from public.stage_results as stage_result
    join public.race_results as race_result
      on race_result.race_edition_id = v_edition_id
     and race_result.race_roster_id = stage_result.race_roster_id
    where stage_result.stage_id = v_stage_id
      and stage_result.race_roster_id = v_gerard_roster_id
      and stage_result.rank = 1
      and race_result.final_rank = 2
  ) then
    return;
  end if;

  -- Decale temporairement les rangs pour respecter l'unicite pendant la
  -- resynchronisation du classement final sur l'ordre d'arrivee officiel.
  update public.race_results
  set final_rank = final_rank + 1000
  where race_edition_id = v_edition_id
    and status = 'classified'
    and final_rank is not null;

  update public.race_results as race_result
  set
    final_rank = stage_result.rank,
    total_time_ms = stage_result.elapsed_time_ms,
    gap_to_winner_ms = stage_result.gap_to_winner_ms,
    updated_at = now()
  from public.stage_results as stage_result
  where race_result.race_edition_id = v_edition_id
    and stage_result.stage_id = v_stage_id
    and stage_result.race_roster_id = race_result.race_roster_id
    and stage_result.status = 'finished';

  for v_target in
    select *
    from (
      values
        (
          v_rodrigues_id,
          'official-race:' || v_edition_id::text || ':rider:' ||
            v_rodrigues_id::text || ':v1',
          0::numeric,
          22,
          700::numeric,
          15,
          0,
          U&'Fl\00E8che du Brabant \2014 J\00FAlio Rodrigues \00B7 2e place'
        ),
        (
          v_gerard_id,
          'official-race:' || v_edition_id::text || ':rider:' ||
            v_gerard_id::text || ':v1',
          1::numeric,
          35,
          1200::numeric,
          25,
          1,
          U&'Fl\00E8che du Brabant \2014 C\00E9dric G\00E9rard \00B7 Victoire'
        )
    ) as target(
      rider_id,
      source_reference,
      reputation_points,
      experience_points,
      cash_prize,
      uci_points,
      victories,
      description
    )
  loop
    select reward.*
    into v_reward
    from public.reward_events as reward
    where reward.source_reference = v_target.source_reference
    for update;

    if not found then
      raise exception
        'Recompense de la Fleche du Brabant introuvable pour %.',
        v_target.rider_id;
    end if;

    update public.sporting_directors
    set
      reputation_points = greatest(
        0,
        reputation_points
          + v_target.reputation_points
          - v_reward.reputation_points
      ),
      experience_points = greatest(
        0,
        experience_points
          + v_target.experience_points
          - v_reward.experience_points
      )
    where id = v_reward.sporting_director_id;

    update public.team_seasons
    set
      points = greatest(
        0,
        points + v_target.uci_points - v_reward.uci_points
      ),
      cash_balance =
        cash_balance + v_target.cash_prize - v_reward.cash_prize
    where id = v_reward.team_season_id;

    update public.rider_season_summaries
    set
      victories = greatest(
        0,
        coalesce(victories, 0)
          + v_target.victories
          - case
              when v_reward.description ilike U&'%\00B7 Victoire%' then 1
              else 0
            end
      ),
      points = greatest(
        0,
        coalesce(points, 0)
          + v_target.uci_points
          - v_reward.uci_points
      ),
      updated_at = now()
    where rider_id = v_target.rider_id
      and season_id = v_season_id;

    update public.team_finance_transactions
    set
      amount = v_target.cash_prize,
      description = v_target.description
    where team_season_id = v_reward.team_season_id
      and source_reference = 'reward:' || v_target.source_reference;

    update public.reward_events
    set
      reputation_points = v_target.reputation_points,
      experience_points = v_target.experience_points,
      cash_prize = v_target.cash_prize,
      uci_points = v_target.uci_points,
      description = v_target.description
    where id = v_reward.id;
  end loop;

  perform public.refresh_uci_rankings(v_season_id);
end;
$repair$;

commit;
