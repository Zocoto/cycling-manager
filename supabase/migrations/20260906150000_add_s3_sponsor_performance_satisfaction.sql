begin;

-- À partir de la saison 3, les performances sportives peuvent compléter les
-- objectifs contractuels. Le journal rend chaque point explicable et empêche
-- qu'un recalcul historique des objectifs n'efface ces gains.
create table public.sponsor_satisfaction_events (
  id uuid primary key default gen_random_uuid(),
  team_sponsor_contract_id uuid not null
    references public.team_sponsor_contracts(id)
    on delete cascade,
  season_id uuid not null
    references public.seasons(id)
    on delete cascade,
  event_type text not null,
  source_key text not null,
  race_edition_id uuid
    references public.race_editions(id)
    on delete set null,
  rider_id uuid
    references public.riders(id)
    on delete set null,
  points smallint not null,
  title text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint sponsor_satisfaction_events_type_allowed
    check (event_type in ('race_result', 'uci_ranking')),
  constraint sponsor_satisfaction_events_source_key_not_empty
    check (btrim(source_key) <> ''),
  constraint sponsor_satisfaction_events_points_allowed
    check (points between 1 and 25),
  constraint sponsor_satisfaction_events_title_not_empty
    check (btrim(title) <> ''),
  constraint sponsor_satisfaction_events_description_not_empty
    check (btrim(description) <> ''),
  constraint sponsor_satisfaction_events_source_unique
    unique (team_sponsor_contract_id, source_key)
);

create index sponsor_satisfaction_events_contract_date_idx
  on public.sponsor_satisfaction_events (
    team_sponsor_contract_id,
    occurred_at desc
  );

create index sponsor_satisfaction_events_season_idx
  on public.sponsor_satisfaction_events (season_id);

alter table public.sponsor_satisfaction_events enable row level security;
revoke all on table public.sponsor_satisfaction_events from anon, authenticated;
grant select, insert, update, delete
  on table public.sponsor_satisfaction_events
  to service_role;

create function public.get_sponsor_objective_satisfaction_score(
  p_contract_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select least(
    100,
    coalesce(sum(objective.satisfaction_points) filter (
      where objective.status = 'completed'
    ), 0)
  )::integer
  from public.team_sponsor_contracts as contract
  left join public.sponsor_objectives as objective
    on objective.sponsor_offer_id = contract.sponsor_offer_id
    and objective.season_id = contract.start_season_id
  where contract.id = p_contract_id;
$$;

create function public.get_sponsor_performance_satisfaction_score(
  p_contract_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select least(25, coalesce(sum(event.points), 0))::integer
  from public.sponsor_satisfaction_events as event
  where event.team_sponsor_contract_id = p_contract_id;
$$;

create function public.get_sponsor_uci_ranking_bonus(
  p_rank integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_rank = 1 then 6
    when p_rank <= 3 then 4
    when p_rank <= 5 then 3
    when p_rank <= 10 then 2
    when p_rank <= 20 then 1
    else 0
  end;
$$;

create function public.get_sponsor_race_result_bonus(
  p_category_code text,
  p_rank integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_category_code = 'elite' and p_rank = 1 then 4
    when p_category_code = 'elite' and p_rank <= 3 then 3
    when p_category_code = 'elite' and p_rank <= 10 then 2
    when p_category_code = 'world' and p_rank = 1 then 3
    when p_category_code = 'world' and p_rank <= 3 then 2
    when p_category_code = 'world' and p_rank <= 10 then 1
    when p_category_code = 'continental' and p_rank = 1 then 2
    when p_category_code = 'continental' and p_rank <= 3 then 1
    when p_category_code = 'national' and p_rank = 1 then 1
    else 0
  end;
$$;

-- Ce verrou canonique protège les bonus contre tous les anciens moteurs
-- d'objectifs qui réécrivent satisfaction_score avec les seuls objectifs.
create function public.synchronize_s3_sponsor_satisfaction_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_game_year integer;
  v_objective_score integer;
  v_performance_score integer;
begin
  if new.role <> 'principal' or new.sponsor_offer_id is null then
    return new;
  end if;

  select season.game_year
  into v_active_game_year
  from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  if coalesce(v_active_game_year, 0) < 3 then
    return new;
  end if;

  v_objective_score :=
    public.get_sponsor_objective_satisfaction_score(new.id);
  v_performance_score :=
    public.get_sponsor_performance_satisfaction_score(new.id);

  new.satisfaction_score := least(
    100,
    coalesce(v_objective_score, 0) + least(25, coalesce(v_performance_score, 0))
  );
  new.satisfaction_updated_at := now();
  return new;
end;
$$;

create trigger synchronize_s3_sponsor_satisfaction_score_trigger
before insert or update
on public.team_sponsor_contracts
for each row
execute function public.synchronize_s3_sponsor_satisfaction_score();

create function public.refresh_s3_sponsor_satisfaction_score(
  p_contract_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.team_sponsor_contracts
  set satisfaction_score = satisfaction_score
  where id = p_contract_id;
end;
$$;

create function public.refresh_s3_sponsor_satisfaction_after_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_s3_sponsor_satisfaction_score(
      old.team_sponsor_contract_id
    );
    return old;
  end if;

  perform public.refresh_s3_sponsor_satisfaction_score(
    new.team_sponsor_contract_id
  );

  if tg_op = 'UPDATE'
    and old.team_sponsor_contract_id <> new.team_sponsor_contract_id then
    perform public.refresh_s3_sponsor_satisfaction_score(
      old.team_sponsor_contract_id
    );
  end if;

  return new;
end;
$$;

create trigger refresh_s3_sponsor_satisfaction_after_event_trigger
after insert or update or delete
on public.sponsor_satisfaction_events
for each row
execute function public.refresh_s3_sponsor_satisfaction_after_event();

create function public.award_s3_sponsor_performance_satisfaction(
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
    join public.seasons as contract_end
      on contract_end.id = contract.end_season_id
    join public.sponsors as sponsor on sponsor.id = contract.sponsor_id
    where result.race_edition_id = p_race_edition_id
      and result.status = 'classified'
      and result.final_rank is not null
      and v_edition.game_year between
        contract_start.game_year and contract_end.game_year
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

create function public.award_s3_sponsor_performance_after_race()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
    and old.status is distinct from 'completed' then
    perform public.award_s3_sponsor_performance_satisfaction(new.id);
  end if;
  return new;
end;
$$;

create trigger award_s3_sponsor_performance_after_race_trigger
after update of status
on public.race_editions
for each row
when (new.status = 'completed' and old.status is distinct from 'completed')
execute function public.award_s3_sponsor_performance_after_race();

revoke all on function public.get_sponsor_objective_satisfaction_score(uuid)
  from public;
revoke all on function public.get_sponsor_performance_satisfaction_score(uuid)
  from public;
revoke all on function public.get_sponsor_uci_ranking_bonus(integer)
  from public;
revoke all on function public.get_sponsor_race_result_bonus(text, integer)
  from public;
revoke all on function public.synchronize_s3_sponsor_satisfaction_score()
  from public;
revoke all on function public.refresh_s3_sponsor_satisfaction_score(uuid)
  from public;
revoke all on function public.refresh_s3_sponsor_satisfaction_after_event()
  from public;
revoke all on function public.award_s3_sponsor_performance_satisfaction(uuid)
  from public;
revoke all on function public.award_s3_sponsor_performance_after_race()
  from public;

grant execute on function public.get_sponsor_objective_satisfaction_score(uuid)
  to service_role;
grant execute on function public.get_sponsor_performance_satisfaction_score(uuid)
  to service_role;
grant execute on function public.get_sponsor_uci_ranking_bonus(integer)
  to service_role;
grant execute on function public.get_sponsor_race_result_bonus(text, integer)
  to service_role;
grant execute on function public.refresh_s3_sponsor_satisfaction_score(uuid)
  to service_role;
grant execute on function public.award_s3_sponsor_performance_satisfaction(uuid)
  to service_role;

comment on table public.sponsor_satisfaction_events is
  'Journal des gains de satisfaction liés aux résultats et au classement UCI, actif uniquement à partir de la saison 3.';
comment on column public.sponsor_satisfaction_events.source_key is
  'Clé idempotente garantissant qu’une course ou un palier UCI ne rapporte ses points qu’une fois par contrat.';
comment on function public.award_s3_sponsor_performance_satisfaction(uuid) is
  'Attribue après une course les bonus plafonnés de résultat, de pays sponsor et de palier UCI, exclusivement à partir de la saison 3.';

notify pgrst, 'reload schema';

commit;
