begin;

alter table public.race_editions
  add column if not exists host_country_id uuid
    references public.countries(id) on delete restrict;
create index if not exists race_editions_host_country_idx
  on public.race_editions (host_country_id, season_id);

alter table public.development_race_editions
  add column if not exists host_country_id uuid
    references public.countries(id) on delete restrict;
create index if not exists development_race_editions_host_country_idx
  on public.development_race_editions (host_country_id, season_id);

create table public.national_federation_renown (
  country_id uuid primary key references public.countries(id) on delete cascade,
  score integer not null default 0,
  uci_history_points integer not null default 0,
  team_legacy_points integer not null default 0,
  rider_legacy_points integer not null default 0,
  hosting_legacy_points integer not null default 0,
  source_through_game_year integer not null,
  calculated_at timestamptz not null default now(),
  constraint national_federation_renown_score_range check (score between 0 and 1000),
  constraint national_federation_renown_breakdown_range check (
    uci_history_points between 0 and 600
    and team_legacy_points between 0 and 180
    and rider_legacy_points between 0 and 170
    and hosting_legacy_points between 0 and 50
  )
);

create table public.national_federation_hosting_candidacies (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  submitted_season_id uuid not null references public.seasons(id) on delete restrict,
  target_game_year integer not null,
  event_type text not null,
  event_key text not null,
  continent_code text,
  hosting_cost numeric(14, 2) not null,
  base_attendance integer not null,
  revenue_per_attendee numeric(8, 2) not null,
  prestige_gain integer not null,
  last_hosted_game_year integer,
  uci_rank integer not null,
  renown_score integer not null,
  recency_points integer not null,
  ranking_points integer not null,
  renown_points integer not null,
  selection_score integer not null,
  submitted_by_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  status text not null default 'pending',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint national_federation_hosting_event_allowed check (
    event_type in (
      'world_championship_pro', 'continental_championship_pro',
      'nations_cup_pro', 'world_championship_junior',
      'continental_championship_junior', 'nations_cup_junior'
    )
  ),
  constraint national_federation_hosting_continent_shape check (
    (event_type in (
      'continental_championship_pro', 'continental_championship_junior'
    ) and continent_code in (
      'africa', 'america', 'asia', 'europe', 'oceania'
    )) or (event_type not in (
      'continental_championship_pro', 'continental_championship_junior'
    ) and continent_code is null)
  ),
  constraint national_federation_hosting_finance_positive check (
    hosting_cost > 0 and base_attendance > 0 and revenue_per_attendee > 0
  ),
  constraint national_federation_hosting_factor_ranges check (
    prestige_gain > 0 and uci_rank > 0 and renown_score between 0 and 1000
    and recency_points between 0 and 600
    and ranking_points between 0 and 250
    and renown_points between 0 and 150
    and selection_score between 0 and 1000
  ),
  constraint national_federation_hosting_status_allowed check (
    status in ('pending', 'selected', 'not_selected', 'withdrawn')
  ),
  constraint national_federation_hosting_country_event_unique
    unique (country_id, target_game_year, event_key)
);

create index national_federation_hosting_candidacies_decision_idx
  on public.national_federation_hosting_candidacies (
    target_game_year, event_key, status, selection_score desc, created_at
  );

create table public.national_federation_hosting_awards (
  id uuid primary key default gen_random_uuid(),
  candidacy_id uuid not null unique
    references public.national_federation_hosting_candidacies(id) on delete restrict,
  country_id uuid not null references public.countries(id) on delete restrict,
  target_game_year integer not null,
  event_type text not null,
  event_key text not null,
  continent_code text,
  hosting_cost numeric(14, 2) not null,
  projected_attendance integer not null,
  projected_gross_revenue numeric(14, 2) not null,
  projected_net_return numeric(14, 2) not null,
  actual_participation_rate numeric(6, 5),
  actual_attendance integer,
  actual_gross_revenue numeric(14, 2),
  actual_net_return numeric(14, 2),
  prestige_gain integer not null,
  status text not null default 'scheduled',
  selected_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint national_federation_hosting_awards_event_allowed check (
    event_type in (
      'world_championship_pro', 'continental_championship_pro',
      'nations_cup_pro', 'world_championship_junior',
      'continental_championship_junior', 'nations_cup_junior'
    )
  ),
  constraint national_federation_hosting_awards_status_allowed check (
    status in ('scheduled', 'settled', 'cancelled')
  ),
  constraint national_federation_hosting_awards_values_valid check (
    hosting_cost > 0 and projected_attendance > 0
    and projected_gross_revenue > 0 and prestige_gain > 0
    and (actual_participation_rate is null
      or actual_participation_rate between 0 and 1)
    and (actual_attendance is null or actual_attendance >= 0)
  ),
  constraint national_federation_hosting_awards_event_unique
    unique (target_game_year, event_key)
);

alter table public.national_federation_renown enable row level security;
alter table public.national_federation_hosting_candidacies enable row level security;
alter table public.national_federation_hosting_awards enable row level security;
create policy national_federation_renown_select_authenticated
on public.national_federation_renown for select to authenticated using (true);
create policy national_federation_hosting_candidacies_select_authenticated
on public.national_federation_hosting_candidacies for select to authenticated using (true);
create policy national_federation_hosting_awards_select_authenticated
on public.national_federation_hosting_awards for select to authenticated using (true);
grant select on table public.national_federation_renown to authenticated;
grant select on table public.national_federation_hosting_candidacies to authenticated;
grant select on table public.national_federation_hosting_awards to authenticated;
grant all on table public.national_federation_renown to service_role;
grant all on table public.national_federation_hosting_candidacies to service_role;
grant all on table public.national_federation_hosting_awards to service_role;

create or replace function public.refresh_national_federation_renown(
  p_country_id uuid
)
returns public.national_federation_renown
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_game_year integer;
  v_uci_points integer := 0;
  v_team_points integer := 0;
  v_rider_points integer := 0;
  v_hosting_points integer := 0;
  v_result public.national_federation_renown;
begin
  if not exists (
    select 1 from public.countries as country
    where country.id = p_country_id and country.is_active = true
  ) then
    raise exception 'La fédération est introuvable.';
  end if;
  select coalesce(max(season.game_year), 1) into v_game_year
  from public.seasons as season
  where season.status in ('active', 'completed');

  with recent_seasons as (
    select season.id, season.game_year,
      greatest(1, 11 - (v_game_year - season.game_year))::numeric as weight
    from public.seasons as season
    where season.game_year <= v_game_year
      and season.status in ('active', 'completed')
    order by season.game_year desc
    limit 10
  ), country_points as (
    select recent.id as season_id, rider.country_id,
      sum(coalesce(summary.points, 0))::bigint as points
    from recent_seasons as recent
    join public.rider_season_summaries as summary on summary.season_id = recent.id
    join public.riders as rider on rider.id = summary.rider_id
    group by recent.id, rider.country_id
  ), country_ranks as (
    select country_points.season_id, country_points.country_id,
      row_number() over (
        partition by country_points.season_id
        order by country_points.points desc, country_points.country_id
      )::integer as rank
    from country_points
  ), weighted as (
    select recent.weight,
      coalesce(
        greatest(0, 174 - country_ranks.rank)::numeric / 173 * 600,
        0
      ) as score
    from recent_seasons as recent
    left join country_ranks
      on country_ranks.season_id = recent.id
     and country_ranks.country_id = p_country_id
  )
  select least(600, round(
    coalesce(sum(weighted.score * weighted.weight), 0)
    / greatest(1, coalesce(sum(weighted.weight), 0))
  ))::integer into v_uci_points
  from weighted;

  select least(180, coalesce(sum(
    case
      when team_season.final_rank = 1 then 20
      when team_season.final_rank <= 3 then 12
      when team_season.final_rank <= 10 then 5
      else least(3, floor(sqrt(greatest(0, team_season.points)) / 20)::integer)
    end
  ), 0))::integer into v_team_points
  from public.team_seasons as team_season
  where team_season.registration_country_id = p_country_id
    and team_season.status in ('active', 'completed');

  select least(170, coalesce(sum(
    case result.final_rank
      when 1 then greatest(1, 7 - category.prestige_rank) * 4
      when 2 then greatest(1, 7 - category.prestige_rank) * 2
      when 3 then greatest(1, 7 - category.prestige_rank)
      else 0
    end
  ), 0))::integer into v_rider_points
  from public.race_results as result
  join public.race_editions as edition on edition.id = result.race_edition_id
  join public.race_categories as category on category.id = edition.race_category_id
  join public.race_rosters as roster on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id
   and rider.country_id = p_country_id
  where result.status = 'classified' and result.final_rank between 1 and 3;

  with hosted_events as (
    select award.target_game_year, award.event_key,
      least(10, award.prestige_gain)::integer as points
    from public.national_federation_hosting_awards as award
    where award.country_id = p_country_id and award.status = 'settled'
    union
    select season.game_year,
      case when race.competition_type = 'world_championship'
        then 'world_championship_pro'
        else 'continental_championship_pro:'
          || race.championship_continent_code end,
      case when race.competition_type = 'world_championship' then 10 else 6 end
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.seasons as season on season.id = edition.season_id
    where race.country_id = p_country_id
      and race.competition_type in ('world_championship', 'continental_championship')
      and edition.status = 'completed'
    union
    select season.game_year, 'nations_cup_junior', 4
    from public.development_race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    join public.countries as country
      on country.iso_alpha2 = edition.country_code
     and country.id = p_country_id
    where edition.competition_type = 'nations_cup_junior'
      and edition.status = 'completed'
    union
    select season.game_year,
      case when edition.competition_type like 'world_%'
        then 'world_championship_junior'
        else 'continental_championship_junior:'
          || edition.championship_continent_code end,
      case when edition.competition_type like 'world_%' then 10 else 6 end
    from public.development_race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    join public.countries as country
      on country.iso_alpha2 = edition.country_code
     and country.id = p_country_id
    where edition.competition_type in (
      'world_road', 'world_time_trial',
      'continental_road', 'continental_time_trial'
    ) and edition.status = 'completed'
  )
  select least(50, coalesce(sum(hosted.points), 0))::integer
  into v_hosting_points from hosted_events as hosted;

  insert into public.national_federation_renown (
    country_id, score, uci_history_points, team_legacy_points,
    rider_legacy_points, hosting_legacy_points,
    source_through_game_year, calculated_at
  ) values (
    p_country_id,
    least(1000, v_uci_points + v_team_points + v_rider_points + v_hosting_points),
    v_uci_points, v_team_points, v_rider_points, v_hosting_points,
    v_game_year, now()
  ) on conflict (country_id) do update set
    score = excluded.score,
    uci_history_points = excluded.uci_history_points,
    team_legacy_points = excluded.team_legacy_points,
    rider_legacy_points = excluded.rider_legacy_points,
    hosting_legacy_points = excluded.hosting_legacy_points,
    source_through_game_year = excluded.source_through_game_year,
    calculated_at = now()
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.submit_national_federation_hosting_candidacy(
  p_country_code text,
  p_event_type text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_identity record;
  v_country public.countries%rowtype;
  v_season public.seasons%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_renown public.national_federation_renown%rowtype;
  v_event_key text;
  v_hosting_cost numeric;
  v_base_attendance integer;
  v_revenue_per_attendee numeric;
  v_prestige_gain integer;
  v_reserved numeric := 0;
  v_rank integer := 173;
  v_last_host integer;
  v_recency_points integer;
  v_ranking_points integer;
  v_renown_points integer;
  v_selection_score integer;
  v_candidacy_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  select * into v_country from public.countries
  where id = v_identity.country_id and is_active = true;
  if v_country.id is null then
    raise exception 'Cette action est réservée à une équipe affiliée.';
  end if;
  if v_season.game_year < 3 then
    raise exception 'Les candidatures d’accueil ouvrent en Saison 3.';
  end if;
  if v_season.current_day_number > 20 then
    raise exception 'Les candidatures d’accueil sont closes après la J20.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_country.id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut engager la fédération.';
  end if;

  case p_event_type
    when 'world_championship_pro' then
      v_event_key := 'world_championship_pro';
      v_hosting_cost := 3500000; v_base_attendance := 240000;
      v_revenue_per_attendee := 18; v_prestige_gain := 60;
    when 'continental_championship_pro' then
      if v_country.continent_code is null then
        raise exception 'Le continent de cette fédération est indéfini.';
      end if;
      v_event_key := 'continental_championship_pro:' || v_country.continent_code;
      v_hosting_cost := 1800000; v_base_attendance := 130000;
      v_revenue_per_attendee := 16; v_prestige_gain := 35;
    when 'nations_cup_pro' then
      v_event_key := 'nations_cup_pro';
      v_hosting_cost := 2400000; v_base_attendance := 180000;
      v_revenue_per_attendee := 17; v_prestige_gain := 45;
    when 'world_championship_junior' then
      v_event_key := 'world_championship_junior';
      v_hosting_cost := 1200000; v_base_attendance := 90000;
      v_revenue_per_attendee := 13; v_prestige_gain := 25;
    when 'continental_championship_junior' then
      if v_country.continent_code is null then
        raise exception 'Le continent de cette fédération est indéfini.';
      end if;
      v_event_key := 'continental_championship_junior:'
        || v_country.continent_code;
      v_hosting_cost := 700000; v_base_attendance := 50000;
      v_revenue_per_attendee := 12; v_prestige_gain := 15;
    when 'nations_cup_junior' then
      v_event_key := 'nations_cup_junior';
      v_hosting_cost := 550000; v_base_attendance := 45000;
      v_revenue_per_attendee := 11; v_prestige_gain := 12;
    else raise exception 'Cette compétition ne peut pas faire l’objet d’une candidature.';
  end case;

  perform public.initialize_due_national_federation_accounts();
  select * into v_account from public.national_federation_accounts
  where country_id = v_country.id and season_id = v_season.id for update;
  if v_account.id is null then
    raise exception 'La trésorerie fédérale n’est pas encore active.';
  end if;
  select coalesce(sum(candidacy.hosting_cost), 0) into v_reserved
  from public.national_federation_hosting_candidacies as candidacy
  where candidacy.country_id = v_country.id
    and candidacy.submitted_season_id = v_season.id
    and candidacy.target_game_year = v_season.game_year + 1
    and candidacy.status = 'pending'
    and candidacy.event_key <> v_event_key;
  if v_account.balance - v_reserved < v_hosting_cost then
    raise exception 'La trésorerie disponible ne permet pas de garantir ce coût d’accueil.';
  end if;

  select * into v_renown
  from public.refresh_national_federation_renown(v_country.id);
  with country_points as (
    select ranking.country_id, sum(ranking.uci_points)::bigint as points
    from public.get_national_championship_country_rankings(v_season.id) as ranking
    group by ranking.country_id
  ), ranked as (
    select country_id,
      row_number() over (order by points desc, country_id)::integer as rank
    from country_points
  )
  select coalesce(rank, 173) into v_rank
  from ranked where country_id = v_country.id;
  v_rank := coalesce(v_rank, 173);
  with hosting_history as (
    select award.target_game_year as game_year
    from public.national_federation_hosting_awards as award
    where award.country_id = v_country.id
      and award.event_key = v_event_key
      and award.status in ('scheduled', 'settled')
    union
    select season.game_year
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.seasons as season on season.id = edition.season_id
    where race.country_id = v_country.id
      and (
        (p_event_type = 'world_championship_pro'
          and race.competition_type = 'world_championship')
        or (p_event_type = 'continental_championship_pro'
          and race.competition_type = 'continental_championship')
      )
      and (p_event_type <> 'continental_championship_pro'
        or race.championship_continent_code = v_country.continent_code)
      and edition.status = 'completed'
    union
    select season.game_year
    from public.development_race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    where (
        (p_event_type = 'world_championship_junior'
          and edition.competition_type in ('world_road', 'world_time_trial'))
        or (p_event_type = 'continental_championship_junior'
          and edition.competition_type in (
            'continental_road', 'continental_time_trial'
          ))
        or (p_event_type = 'nations_cup_junior'
          and edition.competition_type = 'nations_cup_junior')
      )
      and (p_event_type <> 'continental_championship_junior'
        or edition.championship_continent_code = v_country.continent_code)
      and edition.country_code = v_country.iso_alpha2
      and edition.status = 'completed'
  )
  select max(history.game_year) into v_last_host
  from hosting_history as history;
  v_recency_points := least(
    600,
    (case when v_last_host is null then 8
      else greatest(0, v_season.game_year + 1 - v_last_host - 1) end) * 75
  );
  v_ranking_points := round((174 - least(173, greatest(1, v_rank)))::numeric / 173 * 250);
  v_renown_points := round(v_renown.score::numeric / 1000 * 150);
  v_selection_score := v_recency_points + v_ranking_points + v_renown_points;

  insert into public.national_federation_hosting_candidacies (
    country_id, submitted_season_id, target_game_year,
    event_type, event_key, continent_code,
    hosting_cost, base_attendance, revenue_per_attendee, prestige_gain,
    last_hosted_game_year, uci_rank, renown_score,
    recency_points, ranking_points, renown_points, selection_score,
    submitted_by_director_id
  ) values (
    v_country.id, v_season.id, v_season.game_year + 1,
    p_event_type, v_event_key,
    case when p_event_type in (
      'continental_championship_pro', 'continental_championship_junior'
    )
      then v_country.continent_code else null end,
    v_hosting_cost, v_base_attendance, v_revenue_per_attendee, v_prestige_gain,
    v_last_host, v_rank, v_renown.score,
    v_recency_points, v_ranking_points, v_renown_points, v_selection_score,
    v_identity.sporting_director_id
  ) on conflict (country_id, target_game_year, event_key) do update set
    hosting_cost = excluded.hosting_cost,
    base_attendance = excluded.base_attendance,
    revenue_per_attendee = excluded.revenue_per_attendee,
    prestige_gain = excluded.prestige_gain,
    last_hosted_game_year = excluded.last_hosted_game_year,
    uci_rank = excluded.uci_rank,
    renown_score = excluded.renown_score,
    recency_points = excluded.recency_points,
    ranking_points = excluded.ranking_points,
    renown_points = excluded.renown_points,
    selection_score = excluded.selection_score,
    submitted_by_director_id = excluded.submitted_by_director_id,
    status = 'pending', decided_at = null, updated_at = now()
  returning id into v_candidacy_id;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_country.id, v_season.id, v_season.current_day_number,
    'governance', 'Candidature d’accueil déposée',
    case p_event_type
      when 'world_championship_pro' then 'Championnats du monde professionnels'
      when 'continental_championship_pro' then 'Championnats continentaux professionnels'
      when 'nations_cup_pro' then 'Nations Cup professionnelle'
      when 'world_championship_junior' then 'Championnats du monde juniors'
      when 'continental_championship_junior' then 'Championnats continentaux juniors'
      else 'Nations Cup juniors' end
      || ' S' || (v_season.game_year + 1)::text || ' · coût garanti '
      || trim(to_char(v_hosting_cost, 'FM999G999G999')) || ' €.',
    'federation-hosting-candidacy:' || v_candidacy_id::text
  ) on conflict (source_reference) do update set
    day_number = excluded.day_number, detail = excluded.detail, created_at = now();
  return v_candidacy_id;
end;
$$;

create or replace function public.settle_due_national_federation_hosting_candidacies()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_group record;
  v_winner record;
  v_projected_attendance integer;
  v_projected_revenue numeric;
  v_award_id uuid;
  v_target_season_id uuid;
  v_selected integer := 0;
begin
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null or v_season.current_day_number < 21 then return 0; end if;
  v_target_season_id := public.ensure_transfer_next_season(v_season.id);
  perform public.ensure_development_race_calendar(v_target_season_id);

  for v_group in
    select distinct candidacy.target_game_year, candidacy.event_key
    from public.national_federation_hosting_candidacies as candidacy
    where candidacy.submitted_season_id = v_season.id
      and candidacy.target_game_year = v_season.game_year + 1
      and candidacy.status = 'pending'
      and not exists (
        select 1 from public.national_federation_hosting_awards as award
        where award.target_game_year = candidacy.target_game_year
          and award.event_key = candidacy.event_key
      )
    order by candidacy.target_game_year, candidacy.event_key
  loop
    select candidacy.*, account.id as account_id
    into v_winner
    from public.national_federation_hosting_candidacies as candidacy
    join public.national_federation_accounts as account
      on account.country_id = candidacy.country_id
     and account.season_id = candidacy.submitted_season_id
     and account.balance >= candidacy.hosting_cost
    where candidacy.target_game_year = v_group.target_game_year
      and candidacy.event_key = v_group.event_key
      and candidacy.status = 'pending'
    order by candidacy.selection_score desc, candidacy.created_at, candidacy.id
    limit 1 for update of candidacy;

    if not found then
      update public.national_federation_hosting_candidacies
      set status = 'not_selected', decided_at = now(), updated_at = now()
      where target_game_year = v_group.target_game_year
        and event_key = v_group.event_key and status = 'pending';
      continue;
    end if;
    v_projected_attendance := round(
      v_winner.base_attendance * 0.94
      * (0.75 + least(1000, greatest(0, v_winner.renown_score))::numeric / 2000)
    );
    v_projected_revenue := v_projected_attendance * v_winner.revenue_per_attendee;

    insert into public.national_federation_hosting_awards (
      candidacy_id, country_id, target_game_year, event_type,
      event_key, continent_code, hosting_cost,
      projected_attendance, projected_gross_revenue,
      projected_net_return, prestige_gain
    ) values (
      v_winner.id, v_winner.country_id, v_winner.target_game_year,
      v_winner.event_type, v_winner.event_key, v_winner.continent_code,
      v_winner.hosting_cost, v_projected_attendance, v_projected_revenue,
      v_projected_revenue - v_winner.hosting_cost, v_winner.prestige_gain
    ) returning id into v_award_id;

    update public.national_federation_hosting_candidacies
    set status = case when id = v_winner.id then 'selected' else 'not_selected' end,
        decided_at = now(), updated_at = now()
    where target_game_year = v_group.target_game_year
      and event_key = v_group.event_key and status = 'pending';
    update public.national_federation_accounts
    set balance = balance - v_winner.hosting_cost, updated_at = now()
    where id = v_winner.account_id;
    insert into public.national_federation_transactions (
      account_id, day_number, amount, category, description,
      source_reference, metadata
    ) values (
      v_winner.account_id, v_season.current_day_number,
      -v_winner.hosting_cost, 'hosting',
      'Organisation ' || v_winner.event_key || ' S' || v_winner.target_game_year::text,
      'federation-hosting:' || v_award_id::text || ':cost',
      jsonb_build_object('awardId', v_award_id, 'eventType', v_winner.event_type)
    );

    if v_winner.event_type in (
      'world_championship_pro', 'continental_championship_pro'
    ) then
      update public.race_editions as edition
      set host_country_id = v_winner.country_id
      from public.races as race, public.seasons as target_season
      where edition.race_id = race.id
        and edition.season_id = target_season.id
        and target_season.game_year = v_winner.target_game_year
        and race.competition_type = case v_winner.event_type
          when 'world_championship_pro' then 'world_championship'
          else 'continental_championship' end
        and (
          v_winner.event_type = 'world_championship_pro'
          or race.championship_continent_code = v_winner.continent_code
        );
    elsif v_winner.event_type in (
      'world_championship_junior',
      'continental_championship_junior',
      'nations_cup_junior'
    ) then
      update public.development_race_editions as edition
      set host_country_id = v_winner.country_id,
          country_code = country.iso_alpha2,
          location_name = country.name
      from public.countries as country, public.seasons as target_season
      where country.id = v_winner.country_id
        and edition.season_id = target_season.id
        and target_season.game_year = v_winner.target_game_year
        and (
          (v_winner.event_type = 'world_championship_junior'
            and edition.competition_type in ('world_road', 'world_time_trial'))
          or (v_winner.event_type = 'continental_championship_junior'
            and edition.competition_type in (
              'continental_road', 'continental_time_trial'
            ) and edition.championship_continent_code = v_winner.continent_code)
          or (v_winner.event_type = 'nations_cup_junior'
            and edition.competition_type = 'nations_cup_junior')
        );
    end if;

    insert into public.national_federation_journal_entries (
      country_id, season_id, day_number, category, title, detail, source_reference
    ) values (
      v_winner.country_id, v_season.id, v_season.current_day_number,
      'governance', 'Pays hôte désigné',
      v_winner.event_key || ' S' || v_winner.target_game_year::text
        || ' · score automatique ' || v_winner.selection_score::text || '.',
      'federation-hosting:' || v_award_id::text || ':selected'
    );
    v_selected := v_selected + 1;
  end loop;
  return v_selected;
end;
$$;

create or replace function public.settle_due_national_federation_hosting_returns()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_award public.national_federation_hosting_awards%rowtype;
  v_account_id uuid;
  v_expected_entries integer;
  v_actual_entries integer;
  v_participation numeric;
  v_complete boolean;
  v_attendance integer;
  v_gross numeric;
  v_settled integer := 0;
begin
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null then return 0; end if;
  perform public.initialize_due_national_federation_accounts();

  for v_award in
    select * from public.national_federation_hosting_awards
    where target_game_year = v_season.game_year and status = 'scheduled'
    order by selected_at for update skip locked
  loop
    v_complete := false; v_expected_entries := 0; v_actual_entries := 0;
    if v_award.event_type in (
      'world_championship_pro', 'continental_championship_pro'
    ) then
      select
        count(*) > 0 and bool_and(edition.status in ('completed', 'cancelled')),
        count(*)::integer
      into v_complete, v_expected_entries
      from public.race_editions as edition
      join public.races as race on race.id = edition.race_id
      where edition.season_id = v_season.id
        and race.competition_type = case v_award.event_type
          when 'world_championship_pro' then 'world_championship'
          else 'continental_championship' end
        and (v_award.event_type = 'world_championship_pro'
          or race.championship_continent_code = v_award.continent_code);
      select count(*)::integer into v_actual_entries
      from public.race_registrations as registration
      join public.race_editions as edition on edition.id = registration.race_edition_id
      join public.races as race on race.id = edition.race_id
      where edition.season_id = v_season.id
        and race.competition_type = case v_award.event_type
          when 'world_championship_pro' then 'world_championship'
          else 'continental_championship' end
        and registration.status = 'accepted'
        and (v_award.event_type = 'world_championship_pro'
          or race.championship_continent_code = v_award.continent_code);
      select v_expected_entries * count(*)::integer into v_expected_entries
      from public.countries as country
      where country.is_active = true
        and (v_award.event_type = 'world_championship_pro'
          or country.continent_code = v_award.continent_code);
    elsif v_award.event_type = 'nations_cup_pro' then
      select count(*) > 0 and max(slot.day_number) <= v_season.current_day_number,
        count(*)::integer
      into v_complete, v_expected_entries
      from public.national_federation_selection_slots as slot
      where slot.competition_code = 'nations_cup'
        and slot.active_from_game_year <= v_season.game_year;
      select count(*)::integer into v_actual_entries
      from public.national_federation_selection_lists as selection_list
      join public.national_federation_selection_slots as slot
        on slot.slot_key = selection_list.slot_key
       and slot.competition_code = 'nations_cup'
      where selection_list.season_id = v_season.id
        and selection_list.status = 'finalized';
      select v_expected_entries * count(*)::integer into v_expected_entries
      from public.countries as country where country.is_active = true;
    else
      select count(*) > 0 and bool_and(edition.status in ('completed', 'cancelled')),
        count(*)::integer
      into v_complete, v_expected_entries
      from public.development_race_editions as edition
      where edition.season_id = v_season.id
        and (
          (v_award.event_type = 'world_championship_junior'
            and edition.competition_type in ('world_road', 'world_time_trial'))
          or (v_award.event_type = 'continental_championship_junior'
            and edition.competition_type in (
              'continental_road', 'continental_time_trial'
            ) and edition.championship_continent_code = v_award.continent_code)
          or (v_award.event_type = 'nations_cup_junior'
            and edition.competition_type = 'nations_cup_junior')
        );
      select count(*)::integer into v_actual_entries
      from public.national_federation_junior_race_registrations as registration
      join public.development_race_editions as edition
        on edition.id = registration.race_edition_id
      where edition.season_id = v_season.id
        and (
          (v_award.event_type = 'world_championship_junior'
            and edition.competition_type in ('world_road', 'world_time_trial'))
          or (v_award.event_type = 'continental_championship_junior'
            and edition.competition_type in (
              'continental_road', 'continental_time_trial'
            ) and edition.championship_continent_code = v_award.continent_code)
          or (v_award.event_type = 'nations_cup_junior'
            and edition.competition_type = 'nations_cup_junior')
        )
        and registration.status in ('registered', 'completed');
      select v_expected_entries * count(*)::integer into v_expected_entries
      from public.countries as country
      where country.is_active = true
        and (v_award.event_type <> 'continental_championship_junior'
          or country.continent_code = v_award.continent_code);
    end if;
    if not coalesce(v_complete, false) then continue; end if;

    v_participation := least(1, v_actual_entries::numeric / greatest(1, v_expected_entries));
    v_attendance := round(
      case v_award.event_type
        when 'world_championship_pro' then 240000
        when 'continental_championship_pro' then 130000
        when 'nations_cup_pro' then 180000
        when 'world_championship_junior' then 90000
        when 'continental_championship_junior' then 50000
        else 45000 end
      * (0.6 + v_participation * 0.4)
      * (0.75 + coalesce((
        select renown.score::numeric / 2000
        from public.national_federation_renown as renown
        where renown.country_id = v_award.country_id
      ), 0))
    );
    v_gross := v_attendance * case v_award.event_type
      when 'world_championship_pro' then 18
      when 'continental_championship_pro' then 16
      when 'nations_cup_pro' then 17
      when 'world_championship_junior' then 13
      when 'continental_championship_junior' then 12
      else 11 end;
    select account.id into v_account_id
    from public.national_federation_accounts as account
    where account.country_id = v_award.country_id
      and account.season_id = v_season.id for update;
    if v_account_id is null then continue; end if;

    update public.national_federation_accounts
    set balance = balance + v_gross, updated_at = now()
    where id = v_account_id;
    insert into public.national_federation_transactions (
      account_id, day_number, amount, category, description,
      source_reference, metadata
    ) values (
      v_account_id, v_season.current_day_number, v_gross, 'hosting',
      'Recettes d’accueil ' || v_award.event_key,
      'federation-hosting:' || v_award.id::text || ':revenue',
      jsonb_build_object('attendance', v_attendance,
        'participationRate', v_participation, 'prestigeGain', v_award.prestige_gain)
    ) on conflict (source_reference) do nothing;
    update public.national_federation_hosting_awards
    set actual_participation_rate = v_participation,
        actual_attendance = v_attendance,
        actual_gross_revenue = v_gross,
        actual_net_return = v_gross - hosting_cost,
        status = 'settled', settled_at = now()
    where id = v_award.id;
    perform public.refresh_national_federation_renown(v_award.country_id);
    v_settled := v_settled + 1;
  end loop;
  return v_settled;
end;
$$;

revoke all on function public.refresh_national_federation_renown(uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_national_federation_renown(uuid)
  to service_role;
revoke all on function public.submit_national_federation_hosting_candidacy(text, text)
  from public, anon;
grant execute on function public.submit_national_federation_hosting_candidacy(text, text)
  to authenticated, service_role;
revoke all on function public.settle_due_national_federation_hosting_candidacies()
  from public, anon, authenticated;
revoke all on function public.settle_due_national_federation_hosting_returns()
  from public, anon, authenticated;
grant execute on function public.settle_due_national_federation_hosting_candidacies()
  to service_role;
grant execute on function public.settle_due_national_federation_hosting_returns()
  to service_role;

comment on column public.race_editions.host_country_id is
  'Pays hôte propre à cette édition, prioritaire sur la nationalité permanente de la course.';
comment on table public.national_federation_renown is
  'Renommée historique sur 1000 : dix saisons UCI, héritage des équipes et coureurs, accueil de championnats.';
comment on table public.national_federation_hosting_candidacies is
  'Six candidatures publiques par saison : CM, CC et Nations Cup, séparés entre professionnels et juniors.';
comment on function public.settle_due_national_federation_hosting_candidacies() is
  'Désigne automatiquement à J21 le pays hôte : ancienneté prioritaire, puis classement UCI et renommée.';

notify pgrst, 'reload schema';

commit;
