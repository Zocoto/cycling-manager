begin;

-- Sponsor contracts may legitimately keep end_season_id null while their
-- future end season has not been materialized yet. The duration remains the
-- canonical fallback. The original award function used an inner join on the
-- nullable end season and silently excluded those contracts from every race
-- and UCI satisfaction award.
create or replace function public.award_s3_sponsor_performance_satisfaction(
  p_race_edition_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edition record;
  v_team record;
  v_base_points integer;
  v_country_points integer;
  v_proposed_points integer;
  v_awarded_points integer;
  v_objective_score integer;
  v_performance_score integer;
  v_current_rank integer;
  v_current_ranking_bonus integer;
  v_previous_ranking_bonus integer;
  v_previous_best_rank integer;
  v_ranking_label text;
  v_rank_label text;
begin
  select
    edition.id,
    edition.season_id,
    edition.display_name,
    edition.status,
    season.game_year,
    category.code as category_code,
    race.country_id as race_country_id
  into v_edition
  from public.race_editions as edition
  join public.seasons as season on season.id = edition.season_id
  join public.race_categories as category
    on category.id = edition.race_category_id
  join public.races as race on race.id = edition.race_id
  where edition.id = p_race_edition_id;

  if not found
    or v_edition.status <> 'completed'
    or v_edition.game_year < 3 then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('sponsor-performance:' || p_race_edition_id::text, 0)
  );

  for v_team in
    select
      contract.id as contract_id,
      team_season.team_id,
      team_season.display_name as team_name,
      sponsor.country_id as sponsor_country_id,
      min(result.final_rank)::integer as best_rank,
      (array_agg(roster.rider_id order by result.final_rank))[1] as rider_id,
      (array_agg(
        btrim(rider.first_name || ' ' || rider.last_name)
        order by result.final_rank
      ))[1] as rider_name
    from public.race_results as result
    join public.race_rosters as roster
      on roster.id = result.race_roster_id
    join public.riders as rider on rider.id = roster.rider_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
      and team_season.season_id = v_edition.season_id
    join public.team_sponsor_contracts as contract
      on contract.team_id = team_season.team_id
      and contract.role = 'principal'
      and contract.status = 'active'
    join public.seasons as contract_start
      on contract_start.id = contract.start_season_id
    left join public.seasons as contract_end
      on contract_end.id = contract.end_season_id
    join public.sponsors as sponsor on sponsor.id = contract.sponsor_id
    where result.race_edition_id = p_race_edition_id
      and result.status = 'classified'
      and result.final_rank is not null
      and v_edition.game_year between
        contract_start.game_year and coalesce(
          contract_end.game_year,
          contract_start.game_year + contract.contract_duration_seasons - 1
        )
    group by
      contract.id,
      team_season.team_id,
      team_season.display_name,
      sponsor.country_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('sponsor-contract:' || v_team.contract_id::text, 0)
    );

    if not exists (
      select 1
      from public.sponsor_satisfaction_events as event
      where event.team_sponsor_contract_id = v_team.contract_id
        and event.source_key = 'race:' || p_race_edition_id::text
    ) then
      v_base_points := public.get_sponsor_race_result_bonus(
        v_edition.category_code,
        v_team.best_rank
      );
      v_country_points := case
        when v_team.sponsor_country_id = v_edition.race_country_id
          and v_team.best_rank = 1 then 2
        when v_team.sponsor_country_id = v_edition.race_country_id
          and v_team.best_rank <= 10 then 1
        else 0
      end;
      v_proposed_points := v_base_points + v_country_points;

      if v_proposed_points > 0 then
        v_objective_score := public.get_sponsor_objective_satisfaction_score(
          v_team.contract_id
        );
        v_performance_score := public.get_sponsor_performance_satisfaction_score(
          v_team.contract_id
        );
        v_awarded_points := greatest(
          0,
          least(
            v_proposed_points,
            25 - v_performance_score,
            100 - v_objective_score - v_performance_score
          )
        );

        if v_awarded_points > 0 then
          v_rank_label := case
            when v_team.best_rank = 1 then '1re place'
            else v_team.best_rank::text || 'e place'
          end;

          insert into public.sponsor_satisfaction_events (
            team_sponsor_contract_id,
            season_id,
            event_type,
            source_key,
            race_edition_id,
            rider_id,
            points,
            title,
            description,
            metadata
          )
          values (
            v_team.contract_id,
            v_edition.season_id,
            'race_result',
            'race:' || p_race_edition_id::text,
            p_race_edition_id,
            v_team.rider_id,
            v_awarded_points,
            v_rank_label || ' · ' || v_edition.display_name,
            'Meilleur résultat de ' || v_team.rider_name || ' : '
              || v_rank_label || '. '
              || case
                when v_country_points > 0 then
                  'La course se déroule dans le pays du sponsor. '
                else ''
              end
              || 'Gain de satisfaction effectivement acquis : +'
              || v_awarded_points::text || '.',
            jsonb_build_object(
              'categoryCode', v_edition.category_code,
              'bestRank', v_team.best_rank,
              'basePoints', v_base_points,
              'sponsorCountryPoints', v_country_points,
              'proposedPoints', v_proposed_points
            )
          )
          on conflict (team_sponsor_contract_id, source_key) do nothing;
        end if;
      end if;
    end if;

    select ranked.uci_rank
    into v_current_rank
    from (
      select
        ranked_team.team_id,
        ranked_team.points,
        row_number() over (
          order by
            ranked_team.points desc,
            ranked_team.display_name,
            ranked_team.id
        )::integer as uci_rank
      from public.team_seasons as ranked_team
      where ranked_team.season_id = v_edition.season_id
        and ranked_team.status <> 'withdrawn'
    ) as ranked
    where ranked.team_id = v_team.team_id
      and ranked.points > 0;

    v_current_ranking_bonus := public.get_sponsor_uci_ranking_bonus(
      v_current_rank
    );

    select
      coalesce(max((event.metadata ->> 'tierPoints')::integer), 0),
      min((event.metadata ->> 'bestRank')::integer)
    into v_previous_ranking_bonus, v_previous_best_rank
    from public.sponsor_satisfaction_events as event
    where event.team_sponsor_contract_id = v_team.contract_id
      and event.season_id = v_edition.season_id
      and event.event_type = 'uci_ranking'
      and coalesce(event.metadata ->> 'tierPoints', '') ~ '^[0-9]+$'
      and coalesce(event.metadata ->> 'bestRank', '') ~ '^[0-9]+$';

    v_proposed_points := greatest(
      0,
      v_current_ranking_bonus - v_previous_ranking_bonus
    );

    if v_proposed_points > 0 then
      v_objective_score := public.get_sponsor_objective_satisfaction_score(
        v_team.contract_id
      );
      v_performance_score := public.get_sponsor_performance_satisfaction_score(
        v_team.contract_id
      );
      v_awarded_points := greatest(
        0,
        least(
          v_proposed_points,
          25 - v_performance_score,
          100 - v_objective_score - v_performance_score
        )
      );

      if v_awarded_points > 0 then
        v_ranking_label := case
          when v_current_rank = 1 then '1re place'
          when v_current_rank <= 3 then 'Top 3'
          when v_current_rank <= 5 then 'Top 5'
          when v_current_rank <= 10 then 'Top 10'
          else 'Top 20'
        end;

        insert into public.sponsor_satisfaction_events (
          team_sponsor_contract_id,
          season_id,
          event_type,
          source_key,
          points,
          title,
          description,
          metadata
        )
        values (
          v_team.contract_id,
          v_edition.season_id,
          'uci_ranking',
          'uci-ranking:' || v_edition.season_id::text
            || ':tier:' || v_current_ranking_bonus::text,
          v_awarded_points,
          'Classement UCI · ' || v_ranking_label,
          v_team.team_name || ' atteint la ' || v_current_rank::text
            || case when v_current_rank = 1 then 're' else 'e' end
            || ' place du classement UCI. Gain supplémentaire : +'
            || v_awarded_points::text || '.',
          jsonb_build_object(
            'bestRank', v_current_rank,
            'previousBestRank', v_previous_best_rank,
            'tierPoints', v_current_ranking_bonus,
            'proposedPoints', v_proposed_points
          )
        )
        on conflict (team_sponsor_contract_id, source_key) do nothing;
      end if;
    end if;
  end loop;
end;
$$;

-- Idempotently replay every completed S3+ edition. Existing source keys are
-- preserved; only awards previously skipped by the nullable end-season join
-- can be inserted.
do $$
declare
  v_edition_id uuid;
begin
  for v_edition_id in
    select edition.id
    from public.race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    where edition.status = 'completed'
      and season.game_year >= 3
    order by season.game_year, edition.created_at, edition.id
  loop
    perform public.award_s3_sponsor_performance_satisfaction(v_edition_id);
  end loop;
end;
$$;

comment on function public.award_s3_sponsor_performance_satisfaction(uuid) is
  'Attribue les bonus sportifs sponsor S3+, y compris aux contrats dont la saison de fin future n’est pas encore matérialisée.';

commit;
