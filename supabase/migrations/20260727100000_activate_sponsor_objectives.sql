begin;

-- Les objectifs sponsor disposent désormais d'un état d'échec définitif.
alter table public.sponsor_objectives
  drop constraint if exists sponsor_objectives_status_allowed;

alter table public.sponsor_objectives
  add constraint sponsor_objectives_status_allowed
  check (status in ('draft', 'active', 'completed', 'failed', 'cancelled'));

-- Le règlement mémorise la pénalité afin de rester idempotent, même si une
-- clôture de saison est rejouée.
alter table public.objective_progress
  add column if not exists settled_at timestamptz,
  add column if not exists reputation_penalty numeric(12, 2) not null default 0;

alter table public.objective_progress
  drop constraint if exists objective_progress_reputation_penalty_non_negative;

alter table public.objective_progress
  add constraint objective_progress_reputation_penalty_non_negative
  check (reputation_penalty >= 0);

-- Sept objectifs à 1 % chacun : un perfect ne peut donc jamais dépasser 7 %.
update public.team_seasons
set next_sponsor_budget_bonus_percent = least(
  7,
  next_sponsor_budget_bonus_percent
)
where next_sponsor_budget_bonus_percent > 7;

alter table public.team_seasons
  drop constraint if exists team_seasons_sponsor_bonus_range;

alter table public.team_seasons
  add constraint team_seasons_sponsor_bonus_range
  check (
    next_sponsor_budget_bonus_percent >= 0
    and next_sponsor_budget_bonus_percent <= 7
  );

-- La récompense de réputation reste immédiate lorsque l'objectif devient
-- irréversiblement atteint. Le bonus de subvention est, lui, figé seulement à
-- la clôture de saison par le moteur d'évaluation ci-dessous.
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
    2,
    'Objectif sponsor rempli : ' || new.name
  )
  on conflict (source_reference) do nothing
  returning id into v_reward_id;

  if v_reward_id is not null then
    update public.sporting_directors
    set reputation_points = reputation_points + 2
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
  v_current_value numeric(10, 2);
  v_target_value integer;
  v_best_rank integer;
  v_total_riders integer;
  v_matching_riders integer;
  v_director_id uuid;
  v_bonus_percent numeric(5, 2);
begin
  select
    contract.id,
    contract.team_id,
    contract.sponsor_offer_id,
    contract.start_season_id,
    contract.status,
    team_season.id as team_season_id,
    team_season.status as team_season_status
  into v_contract
  from public.team_sponsor_contracts as contract
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
    and team_season.season_id = contract.start_season_id
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
      join public.seasons as target_season
        on target_season.id = v_contract.start_season_id
      where contract.team_id = v_contract.team_id
        and contract.status in ('active', 'completed')
        and target_season.game_year between
          start_season.game_year and end_season.game_year;

      v_current_value := case
        when coalesce(v_total_riders, 0) = 0 then 0
        else round(
          coalesce(v_matching_riders, 0)::numeric * 100
          / v_total_riders,
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
        'evaluatedStatus', v_status
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
      update public.sporting_directors
      set reputation_points = greatest(0, reputation_points - 5)
      where id = v_director_id;

      update public.objective_progress
      set
        reputation_penalty = 5,
        settled_at = now(),
        details = details || jsonb_build_object(
          'reputationPenalty', 5
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

create or replace function public.evaluate_team_sponsor_objectives(
  p_team_season_id uuid,
  p_finalize boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_season record;
  v_contract record;
begin
  select team_season.*
  into v_team_season
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id;

  if v_team_season is null then
    return;
  end if;

  if p_finalize then
    perform public.refresh_uci_rankings(v_team_season.season_id);
  end if;

  for v_contract in
    select contract.id
    from public.team_sponsor_contracts as contract
    where contract.team_id = v_team_season.team_id
      and contract.start_season_id = v_team_season.season_id
      and contract.sponsor_offer_id is not null
      and contract.status in ('active', 'completed')
  loop
    perform public.evaluate_sponsor_objectives_for_contract(
      v_contract.id,
      p_finalize
    );
  end loop;
end;
$$;

create or replace function public.evaluate_sponsor_objectives_after_race()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
begin
  if new.status <> 'completed'
    or old.status = 'completed' then
    return new;
  end if;

  for v_contract in
    select contract.id
    from public.team_sponsor_contracts as contract
    where contract.start_season_id = new.season_id
      and contract.sponsor_offer_id is not null
      and contract.status = 'active'
  loop
    perform public.evaluate_sponsor_objectives_for_contract(
      v_contract.id,
      false
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists sponsor_objectives_after_race_completion
  on public.race_editions;

create trigger sponsor_objectives_after_race_completion
after update of status
on public.race_editions
for each row
execute function public.evaluate_sponsor_objectives_after_race();

-- Ce trigger est volontairement trié avant les clôtures financière et de
-- division : le bonus de 0 à 7 % doit être figé avant la création de la saison
-- d'équipe suivante.
create or replace function public.settle_sponsor_objectives_at_season_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.evaluate_team_sponsor_objectives(new.id, true);
  end if;

  return new;
end;
$$;

drop trigger if exists aaa_team_season_sponsor_objective_closure
  on public.team_seasons;

create trigger aaa_team_season_sponsor_objective_closure
after update of status
on public.team_seasons
for each row
execute function public.settle_sponsor_objectives_at_season_end();

revoke all on function public.evaluate_sponsor_objectives_for_contract(uuid, boolean)
  from public;
revoke all on function public.evaluate_team_sponsor_objectives(uuid, boolean)
  from public;
revoke all on function public.evaluate_sponsor_objectives_after_race()
  from public;
revoke all on function public.settle_sponsor_objectives_at_season_end()
  from public;

grant execute on function public.evaluate_sponsor_objectives_for_contract(uuid, boolean)
  to service_role;
grant execute on function public.evaluate_team_sponsor_objectives(uuid, boolean)
  to service_role;

comment on function public.evaluate_sponsor_objectives_for_contract(uuid, boolean) is
  'Évalue les sept objectifs du contrat, règle les pénalités de -5 à la clôture et fige jusqu’à 7 % de bonus sponsor.';

comment on column public.objective_progress.settled_at is
  'Date du règlement définitif de l’objectif à la clôture de saison.';
comment on column public.objective_progress.reputation_penalty is
  'Pénalité de réputation appliquée une seule fois pour un objectif non atteint.';

notify pgrst, 'reload schema';

commit;
