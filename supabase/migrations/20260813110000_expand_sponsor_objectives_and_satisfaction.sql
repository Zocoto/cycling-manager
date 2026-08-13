begin;

-- Dix engagements pondérés remplacent les sept objectifs uniformes.
alter table public.sponsor_objectives
  drop constraint if exists sponsor_objectives_display_order_allowed;

alter table public.sponsor_objectives
  add constraint sponsor_objectives_display_order_allowed
  check (display_order between 1 and 10);

alter table public.sponsor_objectives
  drop constraint if exists sponsor_objectives_type_allowed;

alter table public.sponsor_objectives
  add constraint sponsor_objectives_type_allowed
  check (
    objective_type in (
      'race_result',
      'nationality_quota',
      'season_wins',
      'uci_ranking',
      'nation_uci_ranking',
      'national_championship',
      'homegrown_roster',
      'infrastructure'
    )
  );

alter table public.sponsor_objectives
  add column if not exists satisfaction_points smallint;

-- Les anciens lots de sept objectifs gardent ensemble une valeur de 100.
with ranked as (
  select
    objective.id,
    count(*) over (
      partition by objective.sponsor_offer_id, objective.season_id
    ) as objective_count,
    row_number() over (
      partition by objective.sponsor_offer_id, objective.season_id
      order by objective.display_order, objective.id
    ) as objective_rank
  from public.sponsor_objectives as objective
)
update public.sponsor_objectives as objective
set satisfaction_points =
  floor(100.0 / ranked.objective_count)::smallint
  + case
      when ranked.objective_rank <= (100 % ranked.objective_count) then 1
      else 0
    end
from ranked
where ranked.id = objective.id
  and objective.satisfaction_points is null;

alter table public.sponsor_objectives
  alter column satisfaction_points set default 10,
  alter column satisfaction_points set not null;

alter table public.sponsor_objectives
  drop constraint if exists sponsor_objectives_satisfaction_points_allowed;

alter table public.sponsor_objectives
  add constraint sponsor_objectives_satisfaction_points_allowed
  check (satisfaction_points between 1 and 100);

alter table public.team_sponsor_contracts
  add column if not exists satisfaction_score smallint not null default 0,
  add column if not exists satisfaction_updated_at timestamptz;

alter table public.team_sponsor_contracts
  drop constraint if exists team_sponsor_contracts_satisfaction_score_allowed;

alter table public.team_sponsor_contracts
  add constraint team_sponsor_contracts_satisfaction_score_allowed
  check (satisfaction_score between 0 and 100);

-- Dix objectifs ne doivent pas augmenter mécaniquement les récompenses :
-- chaque objectif validé rapporte désormais un point de réputation.
create or replace function public.reward_completed_sponsor_objective()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_reward_id uuid;
begin
  if new.status <> 'completed'
    or (tg_op = 'UPDATE' and old.status = 'completed') then
    return new;
  end if;

  select
    contract.team_id,
    team_season.id as team_season_id,
    sporting_director.id as sporting_director_id
  into v_context
  from public.team_sponsor_contracts as contract
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
    and team_season.season_id = new.season_id
  left join public.team_manager_assignments as assignment
    on assignment.team_id = contract.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  left join public.sporting_directors as sporting_director
    on sporting_director.id = assignment.sporting_director_id
  where contract.sponsor_offer_id = new.sponsor_offer_id
    and contract.status in ('planned', 'active', 'completed')
  limit 1;

  if v_context is null then
    return new;
  end if;

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    reputation_points,
    description
  )
  values (
    'sponsor-objective:' || new.id::text || ':' || v_context.team_id::text,
    'sponsor_objective',
    v_context.sporting_director_id,
    v_context.team_season_id,
    1,
    'Objectif sponsor rempli : ' || new.name
  )
  on conflict (source_reference) do nothing
  returning id into v_reward_id;

  if v_reward_id is not null then
    update public.sporting_directors
    set reputation_points = reputation_points + 1
    where id = v_context.sporting_director_id;
  end if;

  return new;
end;
$$;

create or replace function public.evaluate_sponsor_objectives_for_contract(
  p_contract_id uuid,
  p_finalize boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_objective record;
  v_status text;
  v_edition_id uuid;
  v_edition_status text;
  v_scope text;
  v_country_code text;
  v_championship_type text;
  v_current_value numeric(10, 2);
  v_target_value integer;
  v_best_rank integer;
  v_total_riders integer;
  v_matching_riders integer;
  v_director_id uuid;
  v_bonus_percent numeric(5, 2);
  v_satisfaction_score integer;
  v_reputation_penalty integer;
begin
  select
    contract.id,
    contract.team_id,
    contract.sponsor_offer_id,
    contract.start_season_id,
    contract.status,
    team_season.id as team_season_id,
    team_season.status as team_season_status,
    season.game_year,
    season.starts_on,
    season.ends_on
  into v_contract
  from public.team_sponsor_contracts as contract
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
    and team_season.season_id = contract.start_season_id
  join public.seasons as season on season.id = contract.start_season_id
  where contract.id = p_contract_id
    and contract.sponsor_offer_id is not null
    and contract.status in ('active', 'completed')
  limit 1;

  if v_contract is null then
    return;
  end if;

  select sporting_director.id
  into v_director_id
  from public.team_manager_assignments as assignment
  join public.sporting_directors as sporting_director
    on sporting_director.id = assignment.sporting_director_id
  where assignment.team_id = v_contract.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  limit 1;

  insert into public.objective_progress (
    sponsor_objective_id,
    team_sponsor_contract_id,
    season_id,
    status,
    current_value,
    details,
    achieved_at
  )
  select
    objective.id,
    v_contract.id,
    objective.season_id,
    case objective.status
      when 'completed' then 'achieved'
      when 'failed' then 'failed'
      else 'not_started'
    end,
    0,
    '{}'::jsonb,
    case when objective.status = 'completed' then now() else null end
  from public.sponsor_objectives as objective
  where objective.sponsor_offer_id = v_contract.sponsor_offer_id
    and objective.season_id = v_contract.start_season_id
  on conflict (
    sponsor_objective_id,
    team_sponsor_contract_id,
    season_id
  ) do nothing;

  for v_objective in
    select
      objective.id,
      objective.objective_type,
      objective.status as objective_status,
      objective.target_details,
      objective.satisfaction_points,
      progress.id as progress_id,
      progress.status as progress_status,
      progress.current_value as progress_current_value,
      progress.settled_at
    from public.sponsor_objectives as objective
    join public.objective_progress as progress
      on progress.sponsor_objective_id = objective.id
      and progress.team_sponsor_contract_id = v_contract.id
      and progress.season_id = objective.season_id
    where objective.sponsor_offer_id = v_contract.sponsor_offer_id
      and objective.season_id = v_contract.start_season_id
    order by objective.display_order, objective.id
    for update of progress
  loop
    v_status := 'in_progress';
    v_current_value := coalesce(v_objective.progress_current_value, 0);
    v_target_value := null;
    v_best_rank := null;
    v_edition_id := null;
    v_edition_status := null;
    v_scope := null;
    v_country_code := null;
    v_championship_type := null;

    if v_objective.objective_status = 'completed'
      or v_objective.progress_status = 'achieved' then
      v_status := 'achieved';
    elsif v_objective.objective_status = 'failed'
      or v_objective.progress_status = 'failed' then
      v_status := 'failed';

    elsif v_objective.objective_type = 'race_result' then
      v_target_value := coalesce(
        nullif(v_objective.target_details ->> 'targetRank', '')::integer,
        1
      );
      v_edition_id := nullif(
        v_objective.target_details ->> 'raceEditionId',
        ''
      )::uuid;

      if v_edition_id is null then
        select edition.id
        into v_edition_id
        from public.race_editions as edition
        where edition.race_id = nullif(
          v_objective.target_details ->> 'raceId',
          ''
        )::uuid
          and edition.season_id = v_contract.start_season_id
        limit 1;
      end if;

      select edition.status
      into v_edition_status
      from public.race_editions as edition
      where edition.id = v_edition_id;

      select min(result.final_rank)::integer
      into v_best_rank
      from public.race_results as result
      join public.race_rosters as roster
        on roster.id = result.race_roster_id
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
        and registration.race_edition_id = result.race_edition_id
      where result.race_edition_id = v_edition_id
        and registration.team_season_id = v_contract.team_season_id
        and result.status = 'classified';

      v_current_value := coalesce(v_best_rank, 0);

      if v_edition_status in ('completed', 'cancelled') or p_finalize then
        v_status := case
          when v_best_rank is not null and v_best_rank <= v_target_value
            then 'achieved'
          else 'failed'
        end;
      end if;

    elsif v_objective.objective_type = 'nationality_quota' then
      v_country_code := upper(
        coalesce(v_objective.target_details ->> 'countryCode', '')
      );
      v_target_value := coalesce(
        nullif(v_objective.target_details ->> 'minimumPercentage', '')::integer,
        0
      );

      select
        count(distinct contract.rider_id)::integer,
        count(distinct contract.rider_id) filter (
          where upper(country.iso_alpha2) = v_country_code
        )::integer
      into v_total_riders, v_matching_riders
      from public.rider_contracts as contract
      join public.riders as rider on rider.id = contract.rider_id
      join public.countries as country on country.id = rider.country_id
      join public.seasons as start_season
        on start_season.id = contract.start_season_id
      join public.seasons as end_season
        on end_season.id = contract.end_season_id
      where contract.team_id = v_contract.team_id
        and contract.status in ('active', 'completed')
        and v_contract.game_year between
          start_season.game_year and end_season.game_year;

      v_current_value := case
        when coalesce(v_total_riders, 0) = 0 then 0
        else round(
          coalesce(v_matching_riders, 0)::numeric * 100 / v_total_riders,
          2
        )
      end;

      if p_finalize then
        v_status := case
          when v_current_value >= v_target_value then 'achieved'
          else 'failed'
        end;
      end if;

    elsif v_objective.objective_type = 'season_wins' then
      v_scope := coalesce(
        v_objective.target_details ->> 'winScope',
        'all'
      );
      v_target_value := coalesce(
        nullif(v_objective.target_details ->> 'minimumWinCount', '')::integer,
        0
      );

      select count(*)::numeric
      into v_current_value
      from (
        select
          result.id,
          case race.race_format
            when 'one_day' then 'one_day_races'
            else 'stage_race_general'
          end as win_scope
        from public.race_results as result
        join public.race_editions as edition
          on edition.id = result.race_edition_id
        join public.races as race on race.id = edition.race_id
        join public.race_rosters as roster
          on roster.id = result.race_roster_id
        join public.race_registrations as registration
          on registration.id = roster.race_registration_id
        where edition.season_id = v_contract.start_season_id
          and registration.team_season_id = v_contract.team_season_id
          and result.status = 'classified'
          and result.final_rank = 1

        union all

        select
          stage_result.id,
          'stages' as win_scope
        from public.stage_results as stage_result
        join public.stages as stage on stage.id = stage_result.stage_id
        join public.race_editions as edition
          on edition.id = stage.race_edition_id
        join public.races as race
          on race.id = edition.race_id
          and race.race_format = 'stage_race'
        join public.race_rosters as roster
          on roster.id = stage_result.race_roster_id
        join public.race_registrations as registration
          on registration.id = roster.race_registration_id
        where edition.season_id = v_contract.start_season_id
          and registration.team_season_id = v_contract.team_season_id
          and stage_result.status = 'finished'
          and stage_result.rank = 1
      ) as victories
      where v_scope = 'all' or victories.win_scope = v_scope;

      if v_current_value >= v_target_value then
        v_status := 'achieved';
      elsif p_finalize then
        v_status := 'failed';
      end if;

    elsif v_objective.objective_type = 'uci_ranking' then
      v_target_value := coalesce(
        nullif(v_objective.target_details ->> 'targetRank', '')::integer,
        0
      );

      select coalesce(team_season.final_rank, 0)
      into v_current_value
      from public.team_seasons as team_season
      where team_season.id = v_contract.team_season_id;

      if p_finalize then
        v_status := case
          when v_current_value > 0 and v_current_value <= v_target_value
            then 'achieved'
          else 'failed'
        end;
      end if;

    elsif v_objective.objective_type = 'nation_uci_ranking' then
      v_country_code := upper(
        coalesce(v_objective.target_details ->> 'countryCode', '')
      );
      v_target_value := coalesce(
        nullif(v_objective.target_details ->> 'targetRank', '')::integer,
        0
      );

      with nation_points as (
        select
          rider.country_id,
          sum(coalesce(summary.points, 0)) as points
        from public.rider_season_summaries as summary
        join public.riders as rider on rider.id = summary.rider_id
        where summary.season_id = v_contract.start_season_id
        group by rider.country_id
      ),
      nation_ranks as (
        select
          nation.country_id,
          row_number() over (
            order by nation.points desc, nation.country_id
          )::integer as nation_rank
        from nation_points as nation
        where nation.points > 0
      )
      select coalesce(rankings.nation_rank, 0)
      into v_current_value
      from public.countries as country
      left join nation_ranks as rankings on rankings.country_id = country.id
      where upper(country.iso_alpha2) = v_country_code
      limit 1;

      v_current_value := coalesce(v_current_value, 0);

      if p_finalize then
        v_status := case
          when v_current_value > 0 and v_current_value <= v_target_value
            then 'achieved'
          else 'failed'
        end;
      end if;

    elsif v_objective.objective_type = 'national_championship' then
      v_country_code := upper(
        coalesce(v_objective.target_details ->> 'countryCode', '')
      );
      v_championship_type := coalesce(
        v_objective.target_details ->> 'championshipType',
        'any'
      );
      v_target_value := coalesce(
        nullif(v_objective.target_details ->> 'requiredTitleCount', '')::integer,
        1
      );

      select count(distinct title.id)::numeric
      into v_current_value
      from public.rider_national_championship_titles as title
      join public.countries as country on country.id = title.country_id
      where title.season_id = v_contract.start_season_id
        and upper(country.iso_alpha2) = v_country_code
        and (
          (
            v_championship_type = 'any'
            and title.championship_type in ('road', 'time_trial')
          )
          or title.championship_type = v_championship_type
        )
        and exists (
          select 1
          from public.rider_contracts as contract
          join public.seasons as start_season
            on start_season.id = contract.start_season_id
          join public.seasons as end_season
            on end_season.id = contract.end_season_id
          where contract.rider_id = title.rider_id
            and contract.team_id = v_contract.team_id
            and contract.status in ('active', 'completed', 'terminated')
            and v_contract.game_year between
              start_season.game_year and end_season.game_year
        );

      if v_current_value >= v_target_value then
        v_status := 'achieved';
      elsif p_finalize then
        v_status := 'failed';
      end if;

    elsif v_objective.objective_type = 'homegrown_roster' then
      v_target_value := coalesce(
        nullif(v_objective.target_details ->> 'minimumPercentage', '')::integer,
        10
      );

      select
        count(distinct contract.rider_id)::integer,
        count(distinct contract.rider_id) filter (
          where exists (
            select 1
            from public.youth_academy_riders as academy
            where academy.team_id = v_contract.team_id
              and academy.promoted_rider_id = contract.rider_id
          )
        )::integer
      into v_total_riders, v_matching_riders
      from public.rider_contracts as contract
      join public.seasons as start_season
        on start_season.id = contract.start_season_id
      join public.seasons as end_season
        on end_season.id = contract.end_season_id
      where contract.team_id = v_contract.team_id
        and contract.status in ('active', 'completed')
        and v_contract.game_year between
          start_season.game_year and end_season.game_year;

      v_current_value := case
        when coalesce(v_total_riders, 0) = 0 then 0
        else round(
          coalesce(v_matching_riders, 0)::numeric * 100 / v_total_riders,
          2
        )
      end;

      if p_finalize then
        v_status := case
          when v_current_value >= v_target_value then 'achieved'
          else 'failed'
        end;
      end if;

    elsif v_objective.objective_type = 'infrastructure' then
      v_target_value := coalesce(
        nullif(
          v_objective.target_details ->> 'minimumCompletedCount',
          ''
        )::integer,
        1
      );

      select (
        select count(*)
        from public.team_infrastructures as infrastructure
        where infrastructure.team_id = v_contract.team_id
          and infrastructure.completed_at::date between
            v_contract.starts_on and v_contract.ends_on
      ) + (
        select count(*)
        from public.international_youth_centers as center
        where center.team_id = v_contract.team_id
          and center.completed_at::date between
            v_contract.starts_on and v_contract.ends_on
      )
      into v_current_value;

      if v_current_value >= v_target_value then
        v_status := 'achieved';
      elsif p_finalize then
        v_status := 'failed';
      end if;

    elsif p_finalize then
      v_status := 'failed';
    end if;

    update public.objective_progress
    set
      status = v_status,
      current_value = greatest(0, coalesce(v_current_value, 0)),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'currentValue', greatest(0, coalesce(v_current_value, 0)),
        'targetValue', v_target_value,
        'evaluatedStatus', v_status,
        'satisfactionPoints', v_objective.satisfaction_points
      ),
      last_evaluated_at = now(),
      achieved_at = case
        when v_status = 'achieved' then coalesce(achieved_at, now())
        else null
      end,
      updated_at = now()
    where id = v_objective.progress_id;

    update public.sponsor_objectives
    set
      status = case v_status
        when 'achieved' then 'completed'
        when 'failed' then 'failed'
        else 'active'
      end,
      updated_at = now()
    where id = v_objective.id
      and status is distinct from case v_status
        when 'achieved' then 'completed'
        when 'failed' then 'failed'
        else 'active'
      end;

    if p_finalize
      and v_status = 'failed'
      and v_objective.settled_at is null then
      v_reputation_penalty := greatest(
        1,
        round(v_objective.satisfaction_points * 0.35)::integer
      );

      update public.sporting_directors
      set reputation_points = greatest(
        0,
        reputation_points - v_reputation_penalty
      )
      where id = v_director_id;

      update public.objective_progress
      set
        reputation_penalty = v_reputation_penalty,
        settled_at = now(),
        details = details || jsonb_build_object(
          'reputationPenalty',
          v_reputation_penalty
        ),
        updated_at = now()
      where id = v_objective.progress_id;
    elsif p_finalize
      and v_status = 'achieved'
      and v_objective.settled_at is null then
      update public.objective_progress
      set settled_at = now(), updated_at = now()
      where id = v_objective.progress_id;
    end if;
  end loop;

  select least(
    100,
    coalesce(sum(objective.satisfaction_points), 0)
  )::integer
  into v_satisfaction_score
  from public.sponsor_objectives as objective
  where objective.sponsor_offer_id = v_contract.sponsor_offer_id
    and objective.season_id = v_contract.start_season_id
    and objective.status = 'completed';

  update public.team_sponsor_contracts
  set
    satisfaction_score = v_satisfaction_score,
    satisfaction_updated_at = now()
  where id = v_contract.id;

  if p_finalize then
    select least(
      7,
      coalesce(sum(objective.renewal_bonus_percent), 0)
    )
    into v_bonus_percent
    from public.sponsor_objectives as objective
    where objective.sponsor_offer_id = v_contract.sponsor_offer_id
      and objective.season_id = v_contract.start_season_id
      and objective.status = 'completed';

    update public.team_seasons
    set next_sponsor_budget_bonus_percent = v_bonus_percent
    where id = v_contract.team_season_id;
  end if;
end;
$$;

-- Initialise l'indice des contrats déjà en cours à partir des objectifs acquis.
with scores as (
  select
    contract.id as contract_id,
    least(
      100,
      coalesce(sum(objective.satisfaction_points) filter (
        where objective.status = 'completed'
      ), 0)
    )::smallint as score
  from public.team_sponsor_contracts as contract
  left join public.sponsor_objectives as objective
    on objective.sponsor_offer_id = contract.sponsor_offer_id
    and objective.season_id = contract.start_season_id
  group by contract.id
)
update public.team_sponsor_contracts as contract
set
  satisfaction_score = scores.score,
  satisfaction_updated_at = now()
from scores
where scores.contract_id = contract.id;

revoke all on function public.evaluate_sponsor_objectives_for_contract(uuid, boolean)
  from public;
grant execute on function public.evaluate_sponsor_objectives_for_contract(uuid, boolean)
  to service_role;

comment on column public.sponsor_objectives.satisfaction_points is
  'Contribution entière de l’objectif à l’indice de satisfaction sponsor. Les dix objectifs d’une offre totalisent 100.';
comment on column public.team_sponsor_contracts.satisfaction_score is
  'Indice de satisfaction sponsor acquis, compris entre 0 et 100.';
comment on function public.evaluate_sponsor_objectives_for_contract(uuid, boolean) is
  'Évalue dix objectifs contextualisés, met à jour la satisfaction sur 100 et conserve un bonus de renouvellement maximal de 7 %.';

notify pgrst, 'reload schema';

commit;
