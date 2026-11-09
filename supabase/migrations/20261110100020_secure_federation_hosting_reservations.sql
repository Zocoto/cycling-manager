begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';

create index national_federation_hosting_pending_budget_idx
  on public.national_federation_hosting_candidacies (country_id, submitted_season_id)
  include (hosting_cost) where status = 'pending';

create function private.get_national_federation_reserved_hosting_amount(
  p_country_id uuid,
  p_season_id uuid
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(candidacy.hosting_cost), 0)
  from public.national_federation_hosting_candidacies as candidacy
  where candidacy.country_id = p_country_id
    and candidacy.submitted_season_id = p_season_id
    and candidacy.status = 'pending';
$$;

create function private.protect_national_federation_hosting_reservations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.balance < private.get_national_federation_reserved_hosting_amount(old.country_id, old.season_id) then
    raise exception 'Cette dépense entamerait le budget réservé à une candidature d’accueil.';
  end if;
  return new;
end;
$$;

create trigger protect_national_federation_hosting_reservations
before update of balance on public.national_federation_accounts
for each row when (new.balance < old.balance)
execute function private.protect_national_federation_hosting_reservations();

create function public.get_national_federation_hosting_budget(p_country_id uuid, p_season_id uuid)
returns table (balance numeric, reserved_amount numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select account.balance,
    private.get_national_federation_reserved_hosting_amount(account.country_id, account.season_id)
  from public.national_federation_accounts as account
  where account.country_id = p_country_id and account.season_id = p_season_id;
$$;

create function public.get_national_federation_course_renown(p_country_id uuid)
returns public.national_federation_renown
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '8s'
as $$
declare
  v_snapshot public.national_federation_renown%rowtype;
begin
  select * into v_snapshot from public.national_federation_renown where country_id = p_country_id;
  if v_snapshot.calculated_at >= now() - interval '30 minutes' then return v_snapshot; end if;
  if pg_try_advisory_xact_lock(hashtextextended('federation-course-renown:' || p_country_id::text, 0)) then
    return public.refresh_national_federation_renown(p_country_id);
  end if;
  return v_snapshot;
end;
$$;

create function private.get_open_federation_hosting_candidacy_context(p_country_code text)
returns table (country_id uuid, continent_code text, country_code text, director_id uuid,
  season_id uuid, game_year integer, day_number integer)
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_season public.seasons%rowtype;
  v_country public.countries%rowtype;
  v_identity record;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  select season.* into v_season
  from public.seasons as season where season.status = 'active' limit 1 for share;
  if v_season.id is null or v_season.game_year < 3
     or coalesce(v_season.current_day_number, 0) not between 1 and 20
     or not exists (
       select 1 from public.season_days as day
       where day.season_id = v_season.id and day.day_number = 20
         and (clock_timestamp() at time zone 'Europe/Paris')::date <= day.calendar_date
     ) then
    raise exception 'Les candidatures d’accueil sont ouvertes jusqu’à la fin de J20.';
  end if;

  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select country.* into v_country from public.countries as country
  where country.id = v_identity.country_id and country.is_active;
  if v_country.id is null or not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_country.id
      and v_season.game_year between term.start_game_year and term.end_game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut engager la fédération.';
  end if;

  return query select v_country.id, v_country.continent_code::text, v_country.iso_alpha2::text,
    v_identity.sporting_director_id::uuid, v_season.id, v_season.game_year::integer,
    v_season.current_day_number::integer;
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
set statement_timeout = '12s'
set lock_timeout = '2s'
as $$
declare
  v_context record;
  v_account public.national_federation_accounts%rowtype;
  v_renown public.national_federation_renown%rowtype;
  v_office_effects record;
  v_event_key text;
  v_hosting_cost numeric;
  v_base_attendance integer;
  v_revenue_per_attendee numeric;
  v_prestige_gain integer;
  v_min_office_level integer;
  v_rank integer;
  v_last_host integer;
  v_recency_points integer;
  v_ranking_points integer;
  v_renown_points integer;
  v_selection_score integer;
  v_specialization_bonus_points integer;
  v_candidacy_id uuid;
begin
  select * into v_context from private.get_open_federation_hosting_candidacy_context(p_country_code);

  select catalog.cost, catalog.attendance, catalog.tariff, catalog.prestige, catalog.office_level
  into v_hosting_cost, v_base_attendance, v_revenue_per_attendee, v_prestige_gain, v_min_office_level
  from (values
    ('world_championship_pro', 3500000, 240000, 18, 60, 3),
    ('continental_championship_pro', 1800000, 130000, 16, 35, 3),
    ('nations_cup_pro', 2400000, 180000, 17, 45, 3),
    ('quadrennial_games_pro', 2400000, 180000, 17, 45, 3),
    ('world_championship_junior', 1200000, 90000, 15, 25, 1),
    ('continental_championship_junior', 700000, 50000, 16, 15, 1)
  ) as catalog(event_type, cost, attendance, tariff, prestige, office_level)
  where catalog.event_type = p_event_type;
  if not found
     or (p_event_type = 'nations_cup_pro' and (v_context.game_year + 1) % 4 = 0)
     or (p_event_type = 'quadrennial_games_pro' and (v_context.game_year + 1) % 4 <> 0) then
    raise exception 'Cette compétition n’est pas proposée pour la saison suivante.';
  end if;
  v_event_key := p_event_type;
  if p_event_type in ('continental_championship_pro', 'continental_championship_junior') then
    if v_context.continent_code is null then
      raise exception 'Le continent de cette fédération est indéfini.';
    end if;
    v_event_key := p_event_type || ':' || v_context.continent_code;
  end if;

  select * into v_office_effects
  from public.get_national_federation_race_organization_effects(v_context.country_id);
  if coalesce(v_office_effects.office_level, 0) < v_min_office_level then
    raise exception 'Le Bureau d’organisation doit atteindre le niveau %.', v_min_office_level;
  end if;
  v_hosting_cost := round(v_hosting_cost *
    (1 - coalesce(v_office_effects.hosting_cost_reduction_percentage, 0) / 100) / 5000) * 5000;

  select account.* into v_account from public.national_federation_accounts as account
  where account.country_id = v_context.country_id and account.season_id = v_context.season_id
  for update;
  if v_account.id is null then
    raise exception 'La trésorerie fédérale n’est pas encore active.';
  end if;

  select candidacy.id into v_candidacy_id
  from public.national_federation_hosting_candidacies as candidacy
  where candidacy.country_id = v_context.country_id
    and candidacy.submitted_season_id = v_context.season_id
    and candidacy.event_key = v_event_key and candidacy.status = 'pending';
  if found then return v_candidacy_id; end if;
  if private.get_national_federation_reserved_hosting_amount(v_context.country_id, v_context.season_id) > 0 then
    raise exception 'Retirez la candidature en cours avant d’en déposer une autre.';
  end if;
  if v_account.balance < v_hosting_cost then
    raise exception 'La trésorerie disponible ne permet pas de garantir ce coût d’accueil.';
  end if;
  if exists (
    select 1 from public.national_federation_hosting_awards as award
    where award.target_game_year = v_context.game_year + 1 and award.event_key = v_event_key
  ) then
    raise exception 'Le pays hôte de cette compétition a déjà été désigné.';
  end if;

  select * into v_renown from public.refresh_national_federation_renown(v_context.country_id);
  with country_points as (
    select ranking.country_id, sum(ranking.uci_points)::bigint as points
    from public.get_national_championship_country_rankings(v_context.season_id) as ranking
    group by ranking.country_id
  ), ranked as (
    select country_id, row_number() over (order by points desc, country_id)::integer as rank
    from country_points
  )
  select rank into v_rank from ranked where country_id = v_context.country_id;
  v_rank := coalesce(v_rank, 173);
  select max(history.game_year) into v_last_host
  from (
    select award.target_game_year as game_year
    from public.national_federation_hosting_awards as award
    where award.country_id = v_context.country_id and award.event_key = v_event_key
      and award.status in ('scheduled', 'settled')
    union all
    select season.game_year
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.seasons as season on season.id = edition.season_id
    where coalesce(edition.host_country_id, race.country_id) = v_context.country_id
      and edition.status = 'completed'
      and ((p_event_type = 'world_championship_pro' and race.competition_type = 'world_championship')
        or (p_event_type = 'continental_championship_pro' and race.competition_type = 'continental_championship'
          and race.championship_continent_code = v_context.continent_code))
    union all
    select season.game_year
    from public.development_race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    where edition.country_code = v_context.country_code and edition.status = 'completed'
      and ((p_event_type = 'world_championship_junior'
            and edition.competition_type in ('world_road', 'world_time_trial'))
        or (p_event_type = 'continental_championship_junior'
            and edition.competition_type in ('continental_road', 'continental_time_trial')
            and edition.championship_continent_code = v_context.continent_code))
  ) as history;
  v_recency_points := least(600, (case when v_last_host is null then 8
    else greatest(0, v_context.game_year - v_last_host) end) * 75);
  v_ranking_points := round((174 - least(173, greatest(1, v_rank)))::numeric / 173 * 250);
  v_renown_points := round(v_renown.score::numeric / 1000 * 150);
  v_selection_score := v_recency_points + v_ranking_points + v_renown_points;
  v_specialization_bonus_points := round(v_selection_score *
    coalesce(v_office_effects.candidacy_score_bonus_percentage, 0) / 100);
  v_selection_score := least(1000, v_selection_score + v_specialization_bonus_points);

  insert into public.national_federation_hosting_candidacies as candidacy (
    country_id, submitted_season_id, target_game_year, event_type, event_key, continent_code,
    hosting_cost, base_attendance, revenue_per_attendee, prestige_gain, last_hosted_game_year,
    uci_rank, renown_score, recency_points, ranking_points, renown_points,
    specialization_bonus_points, selection_score, submitted_by_director_id
  ) values (
    v_context.country_id, v_context.season_id, v_context.game_year + 1, p_event_type, v_event_key,
    case when v_event_key <> p_event_type then v_context.continent_code end,
    v_hosting_cost, v_base_attendance, v_revenue_per_attendee, v_prestige_gain, v_last_host,
    v_rank, v_renown.score, v_recency_points, v_ranking_points, v_renown_points,
    v_specialization_bonus_points, v_selection_score, v_context.director_id
  ) on conflict (country_id, target_game_year, event_key) do update set
    hosting_cost = excluded.hosting_cost, base_attendance = excluded.base_attendance,
    revenue_per_attendee = excluded.revenue_per_attendee, prestige_gain = excluded.prestige_gain,
    last_hosted_game_year = excluded.last_hosted_game_year, uci_rank = excluded.uci_rank,
    renown_score = excluded.renown_score, recency_points = excluded.recency_points,
    ranking_points = excluded.ranking_points, renown_points = excluded.renown_points,
    specialization_bonus_points = excluded.specialization_bonus_points,
    selection_score = excluded.selection_score, submitted_by_director_id = excluded.submitted_by_director_id,
    status = 'pending', decided_at = null, created_at = now(), updated_at = now()
  where candidacy.status = 'withdrawn'
  returning candidacy.id into v_candidacy_id;
  if v_candidacy_id is null then raise exception 'Cette candidature a déjà été traitée.'; end if;

  -- Publish a row version on the same account that spending locks.
  update public.national_federation_accounts set updated_at = clock_timestamp() where id = v_account.id;
  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_context.country_id, v_context.season_id, v_context.day_number,
    'governance', 'Candidature d’accueil déposée',
    'Budget réservé pour S' || (v_context.game_year + 1)::text || ' · ' ||
      trim(to_char(v_hosting_cost, 'FM999G999G999')) || ' €.',
    'federation-hosting-candidacy:' || v_candidacy_id::text
  ) on conflict (source_reference) do update set
    title = excluded.title, day_number = excluded.day_number, detail = excluded.detail, created_at = now();
  return v_candidacy_id;
end;
$$;

create function public.withdraw_national_federation_hosting_candidacy(
  p_country_code text, p_candidacy_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '5s'
set lock_timeout = '2s'
as $$
declare
  v_context record;
  v_account_id uuid;
  v_candidacy_id uuid;
begin
  select * into v_context from private.get_open_federation_hosting_candidacy_context(p_country_code);
  select id into v_account_id from public.national_federation_accounts
  where country_id = v_context.country_id and season_id = v_context.season_id for update;
  if v_account_id is null then raise exception 'La trésorerie fédérale n’est pas encore active.'; end if;

  update public.national_federation_hosting_candidacies
  set status = 'withdrawn', decided_at = now(), updated_at = now()
  where id = p_candidacy_id and country_id = v_context.country_id
    and submitted_season_id = v_context.season_id and status = 'pending'
  returning id into v_candidacy_id;
  if v_candidacy_id is null then
    if exists (
      select 1 from public.national_federation_hosting_candidacies
      where id = p_candidacy_id and country_id = v_context.country_id
        and submitted_season_id = v_context.season_id and status = 'withdrawn'
    ) then return p_candidacy_id; end if;
    raise exception 'Cette candidature ne peut plus être retirée.';
  end if;

  update public.national_federation_accounts set updated_at = clock_timestamp() where id = v_account_id;
  update public.national_federation_journal_entries
  set title = 'Candidature d’accueil retirée', detail = 'La garantie est de nouveau disponible.',
    day_number = v_context.day_number, created_at = now()
  where source_reference = 'federation-hosting-candidacy:' || v_candidacy_id::text;
  return v_candidacy_id;
end;
$$;

revoke all on function private.get_national_federation_reserved_hosting_amount(uuid, uuid) from public, anon, authenticated;
revoke all on function private.protect_national_federation_hosting_reservations() from public, anon, authenticated;
revoke all on function private.get_open_federation_hosting_candidacy_context(text) from public, anon, authenticated;
revoke all on function public.get_national_federation_hosting_budget(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_national_federation_hosting_budget(uuid, uuid) to service_role;
revoke all on function public.get_national_federation_course_renown(uuid) from public, anon, authenticated;
grant execute on function public.get_national_federation_course_renown(uuid) to service_role;
revoke all on function public.withdraw_national_federation_hosting_candidacy(text, uuid) from public, anon;
grant execute on function public.withdraw_national_federation_hosting_candidacy(text, uuid) to authenticated;

commit;
