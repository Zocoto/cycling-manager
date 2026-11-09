begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';

alter table public.national_federation_hosting_candidacies
  add column organization_points integer not null default 0
    check (organization_points between 0 and 50);

create function private.score_national_federation_hosting_candidacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_office_effects record;
  v_base_score integer;
begin
  select max(history.game_year) into new.last_hosted_game_year
  from (
    select award.target_game_year as game_year
    from public.national_federation_hosting_awards as award
    where award.country_id = new.country_id
      and award.target_game_year < new.target_game_year
      and award.status in ('scheduled', 'settled')
    union all
    select season.game_year
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.seasons as season on season.id = edition.season_id
    where season.game_year < new.target_game_year and edition.status = 'completed'
      and race.competition_type in ('world_championship', 'continental_championship', 'nations_cup')
      and (edition.host_country_id = new.country_id
        or (edition.host_country_id is null and race.country_id = new.country_id))
    union all
    select season.game_year
    from public.development_race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    join public.countries as country on country.id = new.country_id
    where season.game_year < new.target_game_year and edition.status = 'completed'
      and edition.competition_type in ('world_road', 'world_time_trial',
        'continental_road', 'continental_time_trial', 'nations_cup_junior')
      and (edition.host_country_id = new.country_id
        or (edition.host_country_id is null and edition.country_code = country.iso_alpha2))
  ) as history;

  select * into v_office_effects
  from public.get_national_federation_race_organization_effects(new.country_id);

  new.recency_points := least(600, (case when new.last_hosted_game_year is null then 8
    else greatest(0, new.target_game_year - new.last_hosted_game_year - 1) end) * 75);
  new.ranking_points := round((174 - least(173, greatest(1, new.uci_rank)))::numeric / 173 * 200);
  new.renown_points := round(new.renown_score::numeric / 1000 * 150);
  new.organization_points := least(5, greatest(0, coalesce(v_office_effects.office_level, 0))) * 10;
  v_base_score := new.recency_points + new.ranking_points + new.renown_points + new.organization_points;
  new.specialization_bonus_points := round(v_base_score *
    coalesce(v_office_effects.candidacy_score_bonus_percentage, 0) / 100);
  new.selection_score := least(1000, v_base_score + new.specialization_bonus_points);
  return new;
end;
$$;

-- Score writes at the table boundary so a submission already in progress also
-- receives the same scoring as the active campaign.
create trigger score_national_federation_hosting_candidacy
before insert or update of uci_rank, renown_score on public.national_federation_hosting_candidacies
for each row when (new.status = 'pending')
execute function private.score_national_federation_hosting_candidacy();

revoke all on function private.score_national_federation_hosting_candidacy() from public, anon, authenticated;

-- Re-score only bids for the current decision. The stored ranks and renown,
-- reservation amounts, tie-break dates and past decisions are preserved.
update public.national_federation_hosting_candidacies as candidacy
set uci_rank = candidacy.uci_rank
from public.seasons as season
where season.status = 'active' and candidacy.submitted_season_id = season.id
  and candidacy.target_game_year = season.game_year + 1 and candidacy.status = 'pending';

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
  v_hosting_cost_reduction numeric;
  v_event_key text;
  v_hosting_cost numeric;
  v_base_attendance integer;
  v_revenue_per_attendee numeric;
  v_prestige_gain integer;
  v_rank integer;
  v_candidacy_id uuid;
begin
  select * into v_context from private.get_open_federation_hosting_candidacy_context(p_country_code);

  select catalog.cost, catalog.attendance, catalog.tariff, catalog.prestige
  into v_hosting_cost, v_base_attendance, v_revenue_per_attendee, v_prestige_gain
  from (values
    ('world_championship_pro', 3500000, 240000, 18, 60),
    ('continental_championship_pro', 1800000, 130000, 16, 35),
    ('nations_cup_pro', 2400000, 180000, 17, 45),
    ('quadrennial_games_pro', 2400000, 180000, 17, 45),
    ('world_championship_junior', 1200000, 90000, 15, 25),
    ('continental_championship_junior', 700000, 50000, 16, 15)
  ) as catalog(event_type, cost, attendance, tariff, prestige)
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

  select effects.hosting_cost_reduction_percentage into v_hosting_cost_reduction
  from public.get_national_federation_race_organization_effects(v_context.country_id) as effects;
  v_hosting_cost := round(v_hosting_cost *
    (1 - coalesce(v_hosting_cost_reduction, 0) / 100) / 5000) * 5000;

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

  insert into public.national_federation_hosting_candidacies as candidacy (
    country_id, submitted_season_id, target_game_year, event_type, event_key, continent_code,
    hosting_cost, base_attendance, revenue_per_attendee, prestige_gain,
    uci_rank, renown_score, submitted_by_director_id
  ) values (
    v_context.country_id, v_context.season_id, v_context.game_year + 1, p_event_type, v_event_key,
    case when v_event_key <> p_event_type then v_context.continent_code end,
    v_hosting_cost, v_base_attendance, v_revenue_per_attendee, v_prestige_gain,
    v_rank, v_renown.score, v_context.director_id
  ) on conflict (country_id, target_game_year, event_key) do update set
    hosting_cost = excluded.hosting_cost, base_attendance = excluded.base_attendance,
    revenue_per_attendee = excluded.revenue_per_attendee, prestige_gain = excluded.prestige_gain,
    uci_rank = excluded.uci_rank, renown_score = excluded.renown_score,
    submitted_by_director_id = excluded.submitted_by_director_id,
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

notify pgrst, 'reload schema';
commit;
