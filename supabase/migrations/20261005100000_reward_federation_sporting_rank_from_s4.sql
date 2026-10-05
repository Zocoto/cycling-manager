-- Season 4+: keep every existing division base and add a decreasing sporting-rank
-- premium. Only future account INSERTs are affected; never recredit an opening.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';

create or replace function public.get_national_federation_ranking_bonus(
  p_budget_game_year integer,
  p_uci_rank integer,
  p_division integer
)
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when coalesce(p_budget_game_year, 0) < 4 then 0::numeric
    else round(
      (case least(4, greatest(1, coalesce(p_division, 4)))
        when 1 then 450000
        when 2 then 300000
        when 3 then 200000
        else 120000
      end)::numeric
      / sqrt(least(173, greatest(1, coalesce(p_uci_rank, 173)))::numeric)
      / 1000
    ) * 1000
  end;
$$;

revoke all on function public.get_national_federation_ranking_bonus(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_national_federation_ranking_bonus(integer, integer, integer)
  to service_role;

comment on function public.get_national_federation_ranking_bonus(integer, integer, integer) is
  'S4+ : prime du classement UCI final de la saison source, socle de division / sqrt(rang), arrondie à 1 000 euros ; aucune prime avant S4.';

create or replace function public.initialize_due_national_federation_accounts()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_previous_season_id uuid;
  v_country record;
  v_rank integer;
  v_division integer;
  v_completed_days integer;
  v_completed_editions integer;
  v_starters integer;
  v_average_starters integer;
  v_course_fill_rate numeric;
  v_uci_performance numeric;
  v_uci_grant numeric;
  v_nations_grant numeric;
  v_nations_base_grant numeric;
  v_ranking_bonus numeric;
  v_race_revenue numeric;
  v_opening_balance numeric;
  v_account_id uuid;
  v_inserted integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;
  if v_season.id is null or v_season.game_year < 3 then
    return 0;
  end if;

  select id into v_previous_season_id
  from public.seasons
  where game_year = v_season.game_year - 1
  limit 1;

  for v_country in
    select distinct country.id, country.iso_alpha2
    from public.team_seasons as team_season
    join public.teams as team
      on team.id = team_season.team_id
     and team.status = 'active'
    join public.team_manager_assignments as assignment
      on assignment.team_id = team.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
    join public.countries as country
      on country.id = team_season.registration_country_id
     and country.is_active = true
    where team_season.season_id = v_season.id
      and team_season.status in ('planned', 'active')
    order by country.iso_alpha2
  loop
    if exists (
      select 1
      from public.national_federation_accounts as account
      where account.country_id = v_country.id
        and account.season_id = v_season.id
    ) then
      continue;
    end if;

    v_rank := 173;
    v_completed_days := 0;
    v_completed_editions := 0;
    v_starters := 0;
    v_account_id := null;

    if v_previous_season_id is not null then
      with country_points as (
        select ranking.country_id, sum(ranking.uci_points)::bigint as points
        from public.get_national_championship_country_rankings(
          v_previous_season_id
        ) as ranking
        group by ranking.country_id
      ), ranked as (
        select
          country_id,
          row_number() over (order by points desc, country_id)::integer as rank
        from country_points
      )
      select ranked.rank into v_rank
      from ranked
      where ranked.country_id = v_country.id;
      v_rank := coalesce(v_rank, 173);

      select
        count(stage.id)::integer,
        count(distinct edition.id)::integer
      into v_completed_days, v_completed_editions
      from public.races as race
      join public.race_editions as edition
        on edition.race_id = race.id
       and edition.season_id = v_previous_season_id
      join public.stages as stage
        on stage.race_edition_id = edition.id
       and stage.status = 'completed'
      where race.country_id = v_country.id
        and race.status = 'active';

      select count(roster.id)::integer into v_starters
      from public.races as race
      join public.race_editions as edition
        on edition.race_id = race.id
       and edition.season_id = v_previous_season_id
      join public.race_registrations as registration
        on registration.race_edition_id = edition.id
       and registration.status = 'accepted'
      join public.race_rosters as roster
        on roster.race_registration_id = registration.id
       and roster.status in ('selected', 'confirmed')
      where race.country_id = v_country.id
        and race.status = 'active';
    end if;

    v_division := case
      when v_rank <= 20 then 1
      when v_rank <= 60 then 2
      when v_rank <= 100 then 3
      else 4
    end;
    -- Preserve the real Nations Cup division, including promotions/relegations.
    perform public.seed_nations_cup_assignments_for_season(v_season.id);
    select assignment.division into v_division
    from public.national_federation_nations_cup_assignments as assignment
    where assignment.country_id = v_country.id
      and assignment.season_id = v_season.id;
    v_average_starters := case
      when v_completed_editions > 0
        then round(v_starters::numeric / v_completed_editions)::integer
      else 0
    end;
    v_course_fill_rate := least(1, v_average_starters::numeric / 160);
    v_uci_performance :=
      1 - (least(173, greatest(1, v_rank)) - 1)::numeric / 172;
    v_uci_grant :=
      round((150000 + 850000 * sqrt(v_uci_performance)) / 5000) * 5000;
    v_nations_grant := case v_division
      when 1 then 450000
      when 2 then 300000
      when 3 then 200000
      else 120000
    end;
    v_nations_base_grant := v_nations_grant;
    v_ranking_bonus := public.get_national_federation_ranking_bonus(
      v_season.game_year, v_rank, v_division
    );
    v_nations_grant := v_nations_base_grant + v_ranking_bonus;
    v_race_revenue := round(
      (
        least(40, v_completed_days)
        * (5000 + 12000 * v_course_fill_rate)
      ) / 1000
    ) * 1000;
    v_opening_balance :=
      1200000 + v_uci_grant + v_nations_grant + v_race_revenue;

    insert into public.national_federation_accounts (
      country_id, season_id, opening_balance, balance, source_game_year,
      uci_rank, nations_cup_division
    ) values (
      v_country.id, v_season.id, v_opening_balance, v_opening_balance,
      v_season.game_year - 1, v_rank, v_division
    )
    on conflict (country_id, season_id) do nothing
    returning id into v_account_id;

    if v_account_id is null then
      continue;
    end if;

    insert into public.national_federation_transactions (
      account_id, day_number, amount, category, description,
      source_reference, metadata
    ) values (
      v_account_id, 1, v_opening_balance, 'opening_grant',
      'Dotation d’ouverture calculée depuis la saison précédente.',
      'federation-account:' || v_account_id::text || ':opening',
      jsonb_build_object(
        'commonGrant', 1200000,
        'uciGrant', v_uci_grant,
        'nationsCupGrant', v_nations_grant,
        'nationsCupBaseGrant', v_nations_base_grant,
        'nationRankingBonus', v_ranking_bonus,
        'budgetGameYear', v_season.game_year,
        'raceRevenue', v_race_revenue,
        'completedRaceDays', v_completed_days,
        'averageStarters', v_average_starters
      )
    );
    insert into public.national_federation_journal_entries (
      country_id, season_id, day_number, category, title, detail,
      source_reference
    ) values (
      v_country.id, v_season.id, 1, 'finance', 'Budget fédéral ouvert',
      'La dotation de la fédération a été calculée depuis les résultats de la saison précédente.',
      'federation-account:' || v_account_id::text || ':journal'
    ) on conflict (source_reference) do nothing;

    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

-- Use the same season-gated premium in the structural objective-bonus base.
create or replace function public.credit_previous_federation_objective_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_source_season_id uuid;
  v_objective_count integer := 0;
  v_objective_level text := 'none';
  v_bonus_rate numeric := 0;
  v_uci_performance numeric := 0;
  v_uci_grant numeric := 0;
  v_nations_grant numeric := 0;
  v_structural_revenue numeric := 0;
  v_bonus numeric := 0;
begin
  select season.id into v_source_season_id
  from public.seasons as season
  where season.game_year = new.source_game_year;

  if v_source_season_id is null then
    return new;
  end if;

  v_objective_count := least(5, greatest(0, coalesce((
    public.get_national_federation_race_creation_score(
      new.country_id,
      v_source_season_id
    ) ->> 'completedObjectiveCount'
  )::integer, 0)));

  if v_objective_count >= 5 then
    v_objective_level := 'gold';
    v_bonus_rate := 0.10;
  elsif v_objective_count >= 3 then
    v_objective_level := 'silver';
    v_bonus_rate := 0.06;
  elsif v_objective_count >= 1 then
    v_objective_level := 'bronze';
    v_bonus_rate := 0.03;
  end if;

  v_uci_performance :=
    1 - (least(173, greatest(1, new.uci_rank)) - 1)::numeric / 172;
  v_uci_grant := round(
    (150000 + 850000 * sqrt(v_uci_performance)) / 5000
  ) * 5000;
  v_nations_grant := case new.nations_cup_division
    when 1 then 450000
    when 2 then 300000
    when 3 then 200000
    else 120000
  end;
  v_nations_grant := v_nations_grant
    + public.get_national_federation_ranking_bonus(
      new.source_game_year + 1, new.uci_rank, new.nations_cup_division
    );
  v_structural_revenue := 1200000 + v_uci_grant + v_nations_grant;
  v_bonus := round(v_structural_revenue * v_bonus_rate / 5000) * 5000;

  update public.national_federation_accounts
  set objective_level = v_objective_level,
      objective_completed_count = v_objective_count,
      objective_bonus = v_bonus,
      opening_balance = opening_balance + v_bonus,
      balance = balance + v_bonus,
      updated_at = now()
  where id = new.id;

  if v_bonus > 0 then
    insert into public.national_federation_transactions (
      account_id, day_number, amount, category, description,
      source_reference, metadata
    ) values (
      new.id, 1, v_bonus, 'objective_bonus',
      'Bonus des objectifs fédéraux réalisés en S'
        || new.source_game_year::text || '.',
      'federation-account:' || new.id::text || ':previous-objectives',
      jsonb_build_object(
        'sourceGameYear', new.source_game_year,
        'completedObjectiveCount', v_objective_count,
        'objectiveLevel', v_objective_level,
        'bonusRatePercentage', v_bonus_rate * 100,
        'structuralRevenue', v_structural_revenue
      )
    ) on conflict (source_reference) do nothing;
  end if;

  return new;
end;
$$;

commit;
