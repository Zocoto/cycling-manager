begin;

-- ============================================================
-- ARCHIVES DE CARRIÈRE
-- Un coureur retiré reste comme clé référentielle pour ne jamais casser les
-- résultats historiques, mais il sort de tous les viviers sportifs actifs.
-- ============================================================

create table public.rider_history_archives (
  rider_id uuid primary key
    references public.riders(id) on delete restrict,
  country_id uuid not null,
  country_name text not null,
  country_code text not null,
  first_name text not null,
  last_name text not null,
  avatar_profile_key text not null,
  avatar_seed bigint not null,
  retirement_season_id uuid not null,
  retirement_season_name text not null,
  retirement_game_year integer not null,
  retirement_age smallint,
  retirement_reason text not null,
  career_race_days integer not null default 0,
  total_victories integer not null default 0,
  total_points integer not null default 0,
  best_uci_rank integer,
  archived_at timestamptz not null default now(),
  constraint rider_history_archives_country_code_format
    check (country_code ~ '^[A-Z]{2,3}$'),
  constraint rider_history_archives_age_range
    check (retirement_age is null or retirement_age between 15 and 60),
  constraint rider_history_archives_reason_allowed
    check (retirement_reason in ('no_team', 'no_race', 'no_team_and_no_race')),
  constraint rider_history_archives_totals_non_negative
    check (career_race_days >= 0 and total_victories >= 0 and total_points >= 0),
  constraint rider_history_archives_rank_positive
    check (best_uci_rank is null or best_uci_rank > 0)
);

create table public.rider_history_archive_seasons (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null
    references public.rider_history_archives(rider_id) on delete cascade,
  season_id uuid not null,
  season_name text not null,
  game_year integer not null,
  team_id uuid not null,
  team_name text not null,
  victories integer,
  points integer,
  uci_rank integer,
  national_titles jsonb not null default '[]'::jsonb,
  notable_performances jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint rider_archive_seasons_unique
    unique (rider_id, season_id, team_id),
  constraint rider_archive_seasons_victories_non_negative
    check (victories is null or victories >= 0),
  constraint rider_archive_seasons_points_non_negative
    check (points is null or points >= 0),
  constraint rider_archive_seasons_rank_positive
    check (uci_rank is null or uci_rank > 0),
  constraint rider_archive_seasons_titles_array
    check (jsonb_typeof(national_titles) = 'array'),
  constraint rider_archive_seasons_performances_array
    check (jsonb_typeof(notable_performances) = 'array')
);

create index rider_history_archives_retirement_year_idx
  on public.rider_history_archives (retirement_game_year desc);
create index rider_history_archive_seasons_team_idx
  on public.rider_history_archive_seasons (team_id, game_year desc);
create index rider_history_archive_seasons_rider_idx
  on public.rider_history_archive_seasons (rider_id, game_year desc);

create table public.rider_archive_season_settlements (
  season_id uuid primary key references public.seasons(id) on delete restrict,
  archived_rider_count integer not null default 0,
  settled_at timestamptz not null default now(),
  constraint rider_archive_settlement_count_non_negative
    check (archived_rider_count >= 0)
);

alter table public.rider_history_archives enable row level security;
alter table public.rider_history_archive_seasons enable row level security;
alter table public.rider_archive_season_settlements enable row level security;

create policy rider_history_archives_read_authenticated
on public.rider_history_archives
for select
to authenticated
using (true);

create policy rider_history_archive_seasons_read_authenticated
on public.rider_history_archive_seasons
for select
to authenticated
using (true);

create or replace function public.archive_inactive_riders_for_season(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season record;
  v_rider record;
  v_history record;
  v_has_team boolean;
  v_has_race boolean;
  v_reason text;
  v_archived_count integer := 0;
begin
  select season.*
  into v_season
  from public.seasons as season
  where season.id = p_season_id
    and season.status = 'completed'
  for update;

  if v_season is null then
    raise exception 'La saison à archiver doit être clôturée.';
  end if;

  if exists (
    select 1
    from public.rider_archive_season_settlements as settlement
    where settlement.season_id = p_season_id
  ) then
    return 0;
  end if;

  insert into public.rider_archive_season_settlements (season_id)
  values (p_season_id);

  for v_rider in
    select
      rider.id,
      rider.country_id,
      rider.first_name,
      rider.last_name,
      rider.avatar_profile_key,
      rider.avatar_seed,
      rider.career_race_days,
      country.name as country_name,
      country.iso_alpha2 as country_code,
      coalesce(
        season_rating.age,
        (
          select previous_rating.age
          from public.rider_season_ratings as previous_rating
          join public.seasons as previous_season
            on previous_season.id = previous_rating.season_id
          where previous_rating.rider_id = rider.id
            and previous_season.game_year <= v_season.game_year
          order by previous_season.game_year desc
          limit 1
        )
      ) as retirement_age,
      coalesce((
        select sum(coalesce(summary.victories, 0))::integer
        from public.rider_season_summaries as summary
        join public.seasons as summary_season
          on summary_season.id = summary.season_id
        where summary.rider_id = rider.id
          and summary_season.game_year <= v_season.game_year
      ), 0) as total_victories,
      coalesce((
        select sum(coalesce(summary.points, 0))::integer
        from public.rider_season_summaries as summary
        join public.seasons as summary_season
          on summary_season.id = summary.season_id
        where summary.rider_id = rider.id
          and summary_season.game_year <= v_season.game_year
      ), 0) as total_points,
      (
        select min(summary.uci_rank)::integer
        from public.rider_season_summaries as summary
        join public.seasons as summary_season
          on summary_season.id = summary.season_id
        where summary.rider_id = rider.id
          and summary_season.game_year <= v_season.game_year
      ) as best_uci_rank
    from public.riders as rider
    join public.countries as country on country.id = rider.country_id
    left join public.rider_season_ratings as season_rating
      on season_rating.rider_id = rider.id
     and season_rating.season_id = p_season_id
    where rider.status <> 'retired'
      and rider.created_at <= v_season.starts_on::timestamptz
    order by rider.created_at, rider.id
    for update of rider
  loop
    select exists (
      select 1
      from public.rider_contracts as contract
      join public.seasons as start_season
        on start_season.id = contract.start_season_id
      join public.seasons as end_season
        on end_season.id = contract.end_season_id
      where contract.rider_id = v_rider.id
        and contract.status in ('active', 'completed', 'terminated')
        and start_season.game_year <= v_season.game_year
        and end_season.game_year >= v_season.game_year
    ) into v_has_team;

    select exists (
      select 1
      from public.race_rosters as roster
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
       and registration.status = 'accepted'
      join public.race_editions as edition
        on edition.id = registration.race_edition_id
       and edition.season_id = p_season_id
       and edition.status = 'completed'
      where roster.rider_id = v_rider.id
        and roster.status in ('selected', 'confirmed')
    ) into v_has_race;

    if v_has_team and v_has_race then
      continue;
    end if;

    v_reason := case
      when not v_has_team and not v_has_race then 'no_team_and_no_race'
      when not v_has_team then 'no_team'
      else 'no_race'
    end;

    insert into public.rider_history_archives (
      rider_id,
      country_id,
      country_name,
      country_code,
      first_name,
      last_name,
      avatar_profile_key,
      avatar_seed,
      retirement_season_id,
      retirement_season_name,
      retirement_game_year,
      retirement_age,
      retirement_reason,
      career_race_days,
      total_victories,
      total_points,
      best_uci_rank
    ) values (
      v_rider.id,
      v_rider.country_id,
      v_rider.country_name,
      v_rider.country_code,
      v_rider.first_name,
      v_rider.last_name,
      v_rider.avatar_profile_key,
      v_rider.avatar_seed,
      p_season_id,
      v_season.name,
      v_season.game_year,
      v_rider.retirement_age,
      v_reason,
      v_rider.career_race_days,
      v_rider.total_victories,
      v_rider.total_points,
      v_rider.best_uci_rank
    )
    on conflict (rider_id) do nothing;

    for v_history in
      select distinct on (history_season.id, contract.team_id)
        history_season.id as season_id,
        history_season.name as season_name,
        history_season.game_year,
        contract.team_id,
        coalesce(
          team_season.display_name,
          team.amateur_name,
          team.internal_name,
          'Équipe cycliste'
        ) as team_name,
        summary.victories,
        summary.points,
        summary.uci_rank,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'type', title.championship_type,
              'countryName', title_country.name,
              'countryCode', title_country.iso_alpha2
            )
            order by title.championship_type
          )
          from public.rider_national_championship_titles as title
          join public.countries as title_country
            on title_country.id = title.country_id
          where title.rider_id = v_rider.id
            and title.season_id = history_season.id
        ), '[]'::jsonb) as national_titles,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'raceEditionId', reward.source_reference,
              'raceName', regexp_replace(reward.description, '\s+[—-].*$', ''),
              'uciPoints', reward.uci_points,
              'labels', jsonb_build_array(reward.description),
              'finalRank', null
            )
            order by reward.uci_points desc, reward.created_at
          )
          from public.reward_events as reward
          join public.team_seasons as reward_team_season
            on reward_team_season.id = reward.team_season_id
          where reward.rider_id = v_rider.id
            and reward.source_type in ('race_result', 'stage_result', 'secondary_classification')
            and reward_team_season.team_id = contract.team_id
            and reward_team_season.season_id = history_season.id
        ), '[]'::jsonb) as notable_performances
      from public.rider_contracts as contract
      join public.seasons as start_season
        on start_season.id = contract.start_season_id
      join public.seasons as end_season
        on end_season.id = contract.end_season_id
      join public.seasons as history_season
        on history_season.game_year between start_season.game_year and end_season.game_year
       and history_season.game_year <= v_season.game_year
       and history_season.status in ('active', 'completed')
      join public.teams as team on team.id = contract.team_id
      left join public.team_seasons as team_season
        on team_season.team_id = contract.team_id
       and team_season.season_id = history_season.id
      left join public.rider_season_summaries as summary
        on summary.rider_id = v_rider.id
       and summary.season_id = history_season.id
      where contract.rider_id = v_rider.id
        and contract.status in ('active', 'completed', 'terminated')
      order by history_season.id, contract.team_id, contract.created_at desc
    loop
      insert into public.rider_history_archive_seasons (
        rider_id,
        season_id,
        season_name,
        game_year,
        team_id,
        team_name,
        victories,
        points,
        uci_rank,
        national_titles,
        notable_performances
      ) values (
        v_rider.id,
        v_history.season_id,
        v_history.season_name,
        v_history.game_year,
        v_history.team_id,
        v_history.team_name,
        v_history.victories,
        v_history.points,
        v_history.uci_rank,
        v_history.national_titles,
        v_history.notable_performances
      )
      on conflict (rider_id, season_id, team_id) do nothing;
    end loop;

    update public.transfer_market_listings
    set status = 'cancelled', settled_at = coalesce(settled_at, now())
    where rider_id = v_rider.id
      and status = 'open';

    update public.rider_contracts
    set status = case
      when status = 'planned' then 'cancelled'
      when status = 'active' then 'completed'
      else status
    end
    where rider_id = v_rider.id
      and status in ('planned', 'active');

    update public.rider_national_championship_titles
    set relinquished_at = coalesce(relinquished_at, now())
    where rider_id = v_rider.id
      and relinquished_at is null;

    update public.riders
    set status = 'retired'
    where id = v_rider.id;

    v_archived_count := v_archived_count + 1;
  end loop;

  update public.rider_archive_season_settlements
  set archived_rider_count = v_archived_count,
      settled_at = now()
  where season_id = p_season_id;

  return v_archived_count;
end;
$$;

create or replace function public.archive_riders_when_season_completes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.archive_inactive_riders_for_season(new.id);
  end if;
  return new;
end;
$$;

create trigger season_inactive_rider_archive
  after update of status on public.seasons
  for each row execute function public.archive_riders_when_season_completes();


grant select on table public.rider_history_archives to authenticated;
grant select on table public.rider_history_archive_seasons to authenticated;
grant all privileges on table public.rider_history_archives to service_role;
grant all privileges on table public.rider_history_archive_seasons to service_role;
grant all privileges on table public.rider_archive_season_settlements to service_role;

revoke all on function public.archive_inactive_riders_for_season(uuid)
  from public, anon, authenticated;
revoke all on function public.archive_riders_when_season_completes()
  from public, anon, authenticated;
grant execute on function public.archive_inactive_riders_for_season(uuid)
  to service_role;

comment on table public.rider_history_archives is
  'Fiches historiques figées des coureurs sortis du vivier après une saison entière sans équipe ou sans course.';
comment on table public.rider_history_archive_seasons is
  'Historique saison par saison conservé pour les fiches coureurs archivées et la mémoire des équipes.';
comment on function public.archive_inactive_riders_for_season(uuid) is
  'Archive à la clôture les coureurs présents à l’ouverture mais sans équipe ou sans départ en course durant toute la saison.';

notify pgrst, 'reload schema';

commit;