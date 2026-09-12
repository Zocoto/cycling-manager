begin;

-- Keep the legal multi-season contract, but archive its annual counters before
-- switching to a separate offer/objective set. Never reset last season's rows.
create table public.sponsor_annual_objective_history (
  team_sponsor_contract_id uuid not null references public.team_sponsor_contracts(id),
  season_id uuid not null references public.seasons(id),
  sponsor_offer_id uuid references public.sponsor_offers(id),
  satisfaction_score integer not null,
  objective_reputation_penalty integer not null,
  renewal_budget_adjustment_percent numeric not null,
  budget_per_season numeric not null,
  archived_at timestamptz not null default now(),
  primary key (team_sponsor_contract_id, season_id)
);
alter table public.sponsor_annual_objective_history enable row level security;
revoke all on public.sponsor_annual_objective_history from public, anon, authenticated;
grant all on public.sponsor_annual_objective_history to service_role;

create or replace function public.archive_sponsor_annual_objective_state()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.role = 'principal' and new.objective_season_id is not null
    and new.objective_season_id is distinct from coalesce(old.objective_season_id, old.start_season_id)
  then
    insert into public.sponsor_annual_objective_history (
      team_sponsor_contract_id, season_id, sponsor_offer_id, satisfaction_score,
      objective_reputation_penalty, renewal_budget_adjustment_percent, budget_per_season
    ) values (
      old.id, coalesce(old.objective_season_id, old.start_season_id), old.sponsor_offer_id,
      old.satisfaction_score, coalesce(old.objective_reputation_penalty, 0),
      coalesce(old.renewal_budget_adjustment_percent, 0), old.budget_per_season
    ) on conflict (team_sponsor_contract_id, season_id) do nothing;
    new.satisfaction_score := 0;
    new.objective_reputation_penalty := 0;
    new.renewal_budget_adjustment_percent := 0;
  end if;
  return new;
end;
$$;
create trigger aaa_archive_sponsor_annual_objective_state
before update of objective_season_id on public.team_sponsor_contracts
for each row execute function public.archive_sponsor_annual_objective_state();
revoke all on function public.archive_sponsor_annual_objective_state() from public, anon, authenticated;

-- In a BEFORE UPDATE trigger, reloading the contract sees OLD, not NEW.
-- Compute satisfaction using the new offer/year, preserving the media bonus.
create or replace function public.synchronize_s3_sponsor_satisfaction_score()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_active_game_year integer;
  v_objective_score integer;
  v_performance_score integer;
begin
  if new.role <> 'principal' or new.sponsor_offer_id is null then return new; end if;
  select max(game_year) into v_active_game_year from public.seasons where status = 'active';
  if coalesce(v_active_game_year, 0) < 3 then return new; end if;
  select least(100, round(coalesce(sum(objective.satisfaction_points), 0) * (
    1 + 0.10 * public.get_team_specialization_power(new.team_id, 'media_center', 'community_media')
  )))::integer into v_objective_score
  from public.sponsor_objectives as objective
  where objective.sponsor_offer_id = new.sponsor_offer_id
    and objective.season_id = coalesce(new.objective_season_id, new.start_season_id)
    and objective.status = 'completed';
  select least(25, coalesce(sum(event.points), 0))::integer into v_performance_score
  from public.sponsor_satisfaction_events as event
  where event.team_sponsor_contract_id = new.id
    and event.season_id = coalesce(new.objective_season_id, new.start_season_id);
  new.satisfaction_score := least(100, v_objective_score + v_performance_score);
  new.satisfaction_updated_at := now();
  return new;
end;
$$;

-- Annual preparation without a page visit. An existing negotiated offer wins;
-- otherwise renew the sponsor's existing requirements at unchanged difficulty,
-- with new objective IDs and race editions strictly belonging to the new year.
create or replace function public.prepare_annual_sponsor_objective_offers(p_target_season_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_target public.seasons%rowtype;
  v_contract record;
  v_offer_id uuid;
  v_objective record;
  v_details jsonb;
  v_edition_id uuid;
  v_replacement record;
  v_count integer;
  v_prepared integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('annual-sponsor-objectives:' || p_target_season_id::text, 0));
  select * into v_target from public.seasons where id = p_target_season_id;
  if v_target.id is null or v_target.game_year < 3 or v_target.status not in ('active', 'planned') then return 0; end if;
  for v_contract in
    select contract.*, sponsor.name as sponsor_name, sponsor.country_id as sponsor_country_id,
      coalesce((select assignment.sporting_director_id
        from public.team_manager_assignments as assignment
        where assignment.team_id = contract.team_id and assignment.role = 'general_manager'
          and assignment.status = 'active' limit 1), old_offer.sporting_director_id) as director_id
    from public.team_sponsor_contracts as contract
    join public.seasons as start_season on start_season.id = contract.start_season_id
    join public.seasons as objective_season on objective_season.id = coalesce(contract.objective_season_id, contract.start_season_id)
    left join public.seasons as end_season on end_season.id = contract.end_season_id
    join public.sponsor_offers as old_offer on old_offer.id = contract.sponsor_offer_id
    join public.sponsors as sponsor on sponsor.id = contract.sponsor_id
    where contract.status = 'active' and contract.role = 'principal'
      and objective_season.game_year < v_target.game_year
      and v_target.game_year between start_season.game_year and coalesce(end_season.game_year,
        start_season.game_year + contract.contract_duration_seasons - 1)
    order by contract.id for update of contract
  loop
    insert into public.sponsor_offers (
      sponsor_id, season_id, sporting_director_id, continuing_contract_id,
      title, description, budget_per_season, base_budget_per_season,
      negotiation_budget_ceiling, objective_difficulty, currency_code,
      contract_duration_seasons, available_from, available_until, status, generation_version
    ) values (
      v_contract.sponsor_id, v_target.id, v_contract.director_id, v_contract.id,
      'Objectifs annuels · ' || v_contract.sponsor_name,
      'Programme annuel reconduit automatiquement en l’absence de renégociation.',
      v_contract.budget_per_season, v_contract.budget_per_season,
      v_contract.budget_per_season, 'balanced', v_contract.currency_code,
      1, now(), null, 'accepted', 9
    ) on conflict (continuing_contract_id, season_id) do nothing;
    select id into v_offer_id from public.sponsor_offers
    where continuing_contract_id = v_contract.id and season_id = v_target.id
      and status = 'accepted' for update;
    if v_offer_id is null then raise exception 'Programme annuel sponsor non recevable pour %.', v_contract.id; end if;

    for v_objective in
      select objective.* from public.sponsor_objectives as objective
      where objective.sponsor_offer_id = v_contract.sponsor_offer_id
        and objective.season_id = coalesce(v_contract.objective_season_id, v_contract.start_season_id)
        and not exists (select 1 from public.sponsor_objectives as prepared
          where prepared.sponsor_offer_id = v_offer_id and prepared.display_order = objective.display_order)
      order by objective.display_order
    loop
      v_details := v_objective.target_details || jsonb_build_object(
        'annualSourceObjectiveId', v_objective.id, 'annualTargetGameYear', v_target.game_year
      );
      -- Older transition repairs inserted zero-win placeholders, not actual
      -- sporting requirements. Replace these with accessible, distinct races.
      if coalesce((v_details ->> 'legacyNeutralized')::boolean, false) then
        select edition.id, edition.race_id, edition.display_name, race.slug, country.iso_alpha2
        into v_replacement
        from public.race_editions as edition
        join public.races as race on race.id = edition.race_id
        join public.countries as country on country.id = race.country_id
        join public.race_categories as category on category.id = edition.race_category_id
        where edition.season_id = v_target.id and edition.status <> 'cancelled'
          and race.status = 'active' and race.competition_type = 'standard'
          and category.code in ('national', 'continental', 'world') and edition.registration_policy = 'open'
          and coalesce(edition.minimum_reputation, 0) <= coalesce((
            select reputation_points from public.sporting_directors where id = v_contract.director_id
          ), 0)
          and not exists (select 1 from public.sponsor_objectives as existing
            where existing.sponsor_offer_id in (v_offer_id, v_contract.sponsor_offer_id)
              and existing.target_details ->> 'raceId' = edition.race_id::text)
        order by (race.country_id = v_contract.sponsor_country_id) desc,
          coalesce(edition.minimum_reputation, 0), race.id
        limit 1;
        if not found then raise exception 'Aucune course accessible pour remplacer un ancien objectif neutralisé du contrat %.', v_contract.id; end if;
        v_objective.objective_type := 'race_result';
        v_objective.name := 'Top 10 sur ' || v_replacement.display_name;
        v_objective.description := 'Placer au moins un coureur parmi les 10 premiers de ' || v_replacement.display_name || '.';
        v_objective.satisfaction_points := 14;
        v_details := jsonb_build_object('kind','race_result','raceId',v_replacement.race_id,
          'raceEditionId',v_replacement.id,'raceSlug',v_replacement.slug,
          'raceLabel',v_replacement.display_name,'countryCode',v_replacement.iso_alpha2,
          'achievementType','top_n','targetRank',10,'requiredCount',1,
          'annualSourceObjectiveId',v_objective.id,'annualTargetGameYear',v_target.game_year);
      end if;
      if v_objective.objective_type = 'race_result' then
        select edition.id into v_edition_id from public.race_editions as edition
        where edition.season_id = v_target.id
          and edition.race_id = nullif(v_details ->> 'raceId', '')::uuid;
        v_details := jsonb_set(v_details, '{raceEditionId}', coalesce(to_jsonb(v_edition_id), 'null'::jsonb));
      end if;
      insert into public.sponsor_objectives (
        sponsor_offer_id, season_id, name, description, objective_type, priority,
        evaluation_timing, evaluation_day_number, status, display_order,
        renewal_bonus_percent, satisfaction_points, is_provisional, target_details
      ) values (
        v_offer_id, v_target.id, v_objective.name, v_objective.description,
        v_objective.objective_type, v_objective.priority, v_objective.evaluation_timing,
        v_objective.evaluation_day_number,
        -- A success, failure or one-season neutralization is historical state,
        -- not a property of the renewed requirement for the next full season.
        'draft',
        v_objective.display_order, v_objective.renewal_bonus_percent,
        greatest(1, case when v_objective.satisfaction_points = 0 then 10 else v_objective.satisfaction_points end), true, v_details
      ) on conflict (sponsor_offer_id, display_order) do nothing;
    end loop;
    update public.sponsor_objectives as objective
    set target_details = jsonb_set(objective.target_details, '{raceEditionId}', to_jsonb(edition.id))
    from public.race_editions as edition
    where objective.sponsor_offer_id = v_offer_id and objective.objective_type = 'race_result'
      and edition.race_id = nullif(objective.target_details ->> 'raceId', '')::uuid
      and edition.season_id = v_target.id
      and (objective.target_details ->> 'raceEditionId') is distinct from edition.id::text;
    select count(*) into v_count from public.sponsor_objectives
    where sponsor_offer_id = v_offer_id and season_id = v_target.id;
    if v_count <> 10 then raise exception 'Programme annuel incomplet pour % : %/10 objectifs.', v_contract.id, v_count; end if;

    -- Re-enabled/new requirements regain a positive share of the same 100-point
    -- envelope. Complete negotiated programs already total 100 and are untouched.
    if (select sum(satisfaction_points) from public.sponsor_objectives where sponsor_offer_id = v_offer_id) <> 100 then
      with weights as (
        select id, display_order, 100.0 * satisfaction_points / sum(satisfaction_points) over () as weight
        from public.sponsor_objectives where sponsor_offer_id = v_offer_id
      ), ranked as (
        select *, row_number() over (order by weight - floor(weight) desc, display_order) as position,
          100 - sum(floor(weight)) over () as remainder from weights
      ) update public.sponsor_objectives as objective
      set satisfaction_points = floor(ranked.weight)::integer + case when ranked.position <= ranked.remainder then 1 else 0 end
      from ranked where ranked.id = objective.id;
    end if;

    insert into public.race_result_objectives (
      objective_id, race_edition_id, stage_id, target_scope, achievement_type, target_rank, required_count
    )
    select objective.id, edition.id, null, 'race_final',
      coalesce(objective.target_details ->> 'achievementType', 'top_n'),
      nullif(objective.target_details ->> 'targetRank', '')::integer,
      coalesce(nullif(objective.target_details ->> 'requiredCount', '')::integer, 1)
    from public.sponsor_objectives as objective
    join public.race_editions as edition
      on edition.race_id = nullif(objective.target_details ->> 'raceId', '')::uuid
      and edition.season_id = v_target.id
    where objective.sponsor_offer_id = v_offer_id and objective.objective_type = 'race_result'
    on conflict (objective_id) do update set race_edition_id = excluded.race_edition_id;

    if v_target.status = 'planned' then
      update public.team_sponsor_contracts set pending_sponsor_offer_id = v_offer_id
      where id = v_contract.id;
    end if;
    v_prepared := v_prepared + 1;
  end loop;
  return v_prepared;
end;
$$;
revoke all on function public.prepare_annual_sponsor_objective_offers(uuid) from public, anon, authenticated;
grant execute on function public.prepare_annual_sponsor_objective_offers(uuid) to service_role;

-- Repair the running season only: no budget, cash, reputation, jersey or
-- historical objective/progress modification. Safe to repeat after activation.
create or replace function public.repair_due_annual_sponsor_objectives()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_season public.seasons%rowtype;
  v_contract record;
  v_repaired integer := 0;
begin
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;
  perform public.prepare_annual_sponsor_objective_offers(v_season.id);
  for v_contract in
    select contract.id, offer.id as offer_id
    from public.team_sponsor_contracts as contract
    join public.sponsor_offers as offer on offer.continuing_contract_id = contract.id
      and offer.season_id = v_season.id and offer.status = 'accepted'
    join public.seasons as objective_season on objective_season.id = coalesce(contract.objective_season_id, contract.start_season_id)
    where contract.role = 'principal' and contract.status = 'active'
      and objective_season.game_year < v_season.game_year
    order by contract.id for update of contract
  loop
    update public.sponsor_objectives set status = 'active', is_provisional = false, updated_at = now()
    where sponsor_offer_id = v_contract.offer_id and season_id = v_season.id and status = 'draft';
    update public.team_sponsor_contracts
    set sponsor_offer_id = v_contract.offer_id, objective_season_id = v_season.id,
      pending_sponsor_offer_id = case when pending_sponsor_offer_id = v_contract.offer_id then null else pending_sponsor_offer_id end
    where id = v_contract.id;
    insert into public.objective_progress (
      sponsor_objective_id, team_sponsor_contract_id, season_id, status, current_value, details
    ) select objective.id, v_contract.id, v_season.id, 'not_started', 0, '{}'::jsonb
    from public.sponsor_objectives as objective
    where objective.sponsor_offer_id = v_contract.offer_id and objective.season_id = v_season.id
    on conflict (sponsor_objective_id, team_sponsor_contract_id, season_id) do nothing;
    v_repaired := v_repaired + 1;
  end loop;
  return v_repaired;
end;
$$;
revoke all on function public.repair_due_annual_sponsor_objectives() from public, anon, authenticated;
grant execute on function public.repair_due_annual_sponsor_objectives() to service_role;

-- The old annual migration patched the outer wrappers only. The actual race,
-- CN, UCI and youth evaluators must use the annual season too.
do $migration$
declare
  v_function regprocedure;
  v_definition text;
  v_patched text;
begin
  foreach v_function in array array[
    'public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(uuid,boolean)'::regprocedure,
    'public.evaluate_sponsor_objectives_pre_recruitment_20260905(uuid,boolean)'::regprocedure
  ] loop
    select replace(pg_get_functiondef(v_function), chr(13), '') into v_definition;
    v_patched := replace(v_definition, 'contract.start_season_id,',
      'coalesce(contract.objective_season_id, contract.start_season_id) as objective_season_id,');
    v_patched := replace(v_patched, 'team_season.season_id = contract.start_season_id',
      'team_season.season_id = coalesce(contract.objective_season_id, contract.start_season_id)');
    v_patched := replace(v_patched, 'join public.seasons as season on season.id = contract.start_season_id',
      'join public.seasons as season on season.id = coalesce(contract.objective_season_id, contract.start_season_id)');
    v_patched := replace(v_patched, 'v_contract.start_season_id', 'v_contract.objective_season_id');
    if v_patched = v_definition then raise exception 'Annual evaluator anchor missing: %', v_function; end if;
    -- Never evaluate an explicitly neutralized requirement.
    v_patched := replace(v_patched, 'and objective.season_id = v_contract.objective_season_id',
      'and objective.season_id = v_contract.objective_season_id and objective.status <> ''cancelled''');
    if position('if v_edition_id is null then' in v_patched) > 0 then
      v_patched := replace(v_patched, 'if v_edition_id is null then',
        'if v_edition_id is null or not exists (select 1 from public.race_editions as expected_edition where expected_edition.id = v_edition_id and expected_edition.season_id = v_contract.objective_season_id) then');
    end if;
    execute v_patched;
  end loop;

  -- Penalty cleanup must not reach another objective season of the same contract.
  select replace(pg_get_functiondef('public.evaluate_sponsor_objectives_for_contract(uuid,boolean)'::regprocedure), chr(13), '') into v_definition;
  v_patched := replace(v_definition, 'where progress.team_sponsor_contract_id = p_contract_id;',
    'where progress.team_sponsor_contract_id = p_contract_id and progress.season_id = (select coalesce(c.objective_season_id,c.start_season_id) from public.team_sponsor_contracts c where c.id=p_contract_id);');
  v_patched := replace(v_patched, 'where team_sponsor_contract_id = p_contract_id',
    'where team_sponsor_contract_id = p_contract_id and season_id = (select coalesce(c.objective_season_id,c.start_season_id) from public.team_sponsor_contracts c where c.id=p_contract_id)');
  if v_patched = v_definition then raise exception 'Annual penalty isolation anchor missing'; end if;
  execute v_patched;

  select replace(pg_get_functiondef('public.rollover_game_season(uuid,boolean)'::regprocedure), chr(13), '') into v_definition;
  v_patched := replace(v_definition,
    '  -- Annual sponsor satisfaction and ambition stack from season 3 onward.',
    '  -- Prepare every continuing sponsor, even when its DS never opened sponsoring.' || chr(10) ||
    '  perform public.prepare_annual_sponsor_objective_offers(v_target.id);' || chr(10) || chr(10) ||
    '  -- Annual sponsor satisfaction and ambition stack from season 3 onward.');
  if v_patched = v_definition then raise exception 'Annual rollover preparation anchor missing'; end if;
  execute v_patched;
end;
$migration$;

comment on function public.prepare_annual_sponsor_objective_offers(uuid) is
  'Prépare dix objectifs annuels pour chaque contrat pluriannuel : priorité au programme négocié, sinon reconduction sur les éditions de la nouvelle saison.';

-- Curative catch-up for the running season. All previous rows stay historical.
select public.repair_due_annual_sponsor_objectives();
notify pgrst, 'reload schema';
commit;
