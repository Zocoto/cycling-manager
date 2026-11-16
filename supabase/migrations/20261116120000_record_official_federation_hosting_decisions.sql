begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

alter table public.race_editions add column is_neutral_host boolean not null default false;
alter table public.development_race_editions add column is_neutral_host boolean not null default false;

create table public.national_federation_hosting_decisions (
  target_game_year integer not null check (target_game_year >= 6),
  event_key text not null,
  event_type text not null check (event_type in (
    'world_championship_pro', 'continental_championship_pro', 'nations_cup_pro',
    'quadrennial_games_pro', 'world_championship_junior', 'continental_championship_junior'
  )),
  continent_code text,
  decision_season_id uuid not null references public.seasons(id) on delete restrict,
  jury_day_number smallint not null check (jury_day_number = 21),
  decided_at timestamptz not null,
  gazette_date date generated always as (((decided_at at time zone 'Europe/Paris') + interval '4 hours')::date) stored,
  decision text not null check (decision in ('hosted', 'neutral')),
  country_id uuid references public.countries(id) on delete restrict,
  award_id uuid references public.national_federation_hosting_awards(id) on delete restrict,
  primary key (target_game_year, event_key),
  check (event_key = event_type || coalesce(':' || continent_code, '')),
  check ((decision = 'neutral' and country_id is null and award_id is null)
    or (decision = 'hosted' and country_id is not null and award_id is not null))
);

create index national_federation_hosting_decisions_gazette_idx
  on public.national_federation_hosting_decisions (gazette_date);
create index national_federation_hosting_decisions_season_idx
  on public.national_federation_hosting_decisions (decision_season_id, decided_at);

alter table public.national_federation_hosting_decisions enable row level security;
create policy national_federation_hosting_decisions_read
  on public.national_federation_hosting_decisions for select to authenticated using (true);
revoke all on public.national_federation_hosting_decisions from public, anon, authenticated, service_role;
grant select on public.national_federation_hosting_decisions to authenticated, service_role;

-- The decision table and the candidacy's identity/status are public. Internal
-- assessment and score inputs can only be read by the trusted server role.
revoke select on public.national_federation_hosting_candidacies from public, anon, authenticated;
grant select (id, country_id, submitted_season_id, target_game_year, event_type, event_key,
  continent_code, hosting_cost, status, decided_at, created_at, updated_at)
  on public.national_federation_hosting_candidacies to authenticated;

create function private.apply_neutral_federation_hosting_to_edition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_game_year integer;
  v_competition_type text;
  v_continent_code text;
  v_event_key text;
begin
  select season.game_year into v_game_year from public.seasons as season where season.id = new.season_id;
  if coalesce(v_game_year, 0) < 6 then return new; end if;

  if tg_table_name = 'development_race_editions' then
    v_event_key := case new.competition_type
      when 'world_road' then 'world_championship_junior'
      when 'world_time_trial' then 'world_championship_junior'
      when 'continental_road' then 'continental_championship_junior:' || new.championship_continent_code
      when 'continental_time_trial' then 'continental_championship_junior:' || new.championship_continent_code
    end;
  else
    select race.competition_type, race.championship_continent_code into v_competition_type, v_continent_code
    from public.races as race where race.id = new.race_id;
    v_event_key := case v_competition_type
      when 'world_championship' then 'world_championship_pro'
      when 'continental_championship' then 'continental_championship_pro:' || v_continent_code
      when 'nations_cup' then case when v_game_year % 4 = 0 then 'quadrennial_games_pro' else 'nations_cup_pro' end
    end;
  end if;

  if v_event_key is not null and exists (
    select 1 from public.national_federation_hosting_decisions as decision
    where decision.target_game_year = v_game_year and decision.event_key = v_event_key and decision.decision = 'neutral'
  ) then
    new.is_neutral_host := true;
    new.host_country_id := null;
  end if;
  return new;
end;
$$;

revoke all on function private.apply_neutral_federation_hosting_to_edition()
  from public, anon, authenticated, service_role;

create trigger apply_neutral_federation_hosting_to_edition
  before insert or update of host_country_id, season_id, race_id on public.race_editions
  for each row execute function private.apply_neutral_federation_hosting_to_edition();
create trigger apply_neutral_federation_hosting_to_edition
  before insert or update of host_country_id, season_id, competition_type, championship_continent_code
  on public.development_race_editions
  for each row when (new.competition_type in ('world_road', 'world_time_trial', 'continental_road', 'continental_time_trial'))
  execute function private.apply_neutral_federation_hosting_to_edition();

create function private.record_due_federation_hosting_decisions()
returns void language plpgsql set search_path = '' as $$
declare
  v_active public.seasons%rowtype;
  v_context record;
  v_decision record;
begin
  select season.* into v_active from public.seasons as season where season.status = 'active';
  if coalesce(v_active.game_year, 0) < 5 then return; end if;

  for v_context in
    -- When rollover released the last guarantee for an incomplete programme,
    -- close that remaining decision against the original jury session.
    select source.id as source_season_id, source.game_year + 1 as target_game_year
    from public.seasons as source
    where source.game_year = v_active.game_year - 1 and source.game_year >= 5 and source.status = 'completed'
    union all
    select v_active.id, v_active.game_year + 1
    where v_active.current_day_number >= 21 and exists (
      select 1 from public.season_days as day
      where day.season_id = v_active.id and day.day_number = 21
        and day.calendar_date <= (clock_timestamp() at time zone 'Europe/Paris')::date
    )
  loop
    for v_decision in
      with events as (
        select event_type, event_type as event_key, null::text as continent_code
        from (values ('world_championship_pro'), ('world_championship_junior'),
          (case when v_context.target_game_year % 4 = 0 then 'quadrennial_games_pro' else 'nations_cup_pro' end)
        ) as worldwide(event_type)
        union all
        select event_type, event_type || ':' || continent_code, continent_code
        from (values ('continental_championship_pro'), ('continental_championship_junior')) as continental(event_type)
        cross join (values ('africa'), ('america'), ('asia'), ('europe'), ('oceania')) as continents(continent_code)
      )
      insert into public.national_federation_hosting_decisions (
        target_game_year, event_key, event_type, continent_code, decision_season_id, jury_day_number,
        decided_at, decision, country_id, award_id
      )
      select v_context.target_game_year, event.event_key, event.event_type, event.continent_code,
        v_context.source_season_id, 21, coalesce(award.selected_at, now()),
        case when award.id is null then 'neutral' else 'hosted' end, award.country_id, award.id
      from events as event
      left join public.national_federation_hosting_awards as award
        on award.target_game_year = v_context.target_game_year and award.event_key = event.event_key
        and award.status in ('scheduled', 'settled')
      where not exists (
        select 1 from public.national_federation_hosting_decisions as published
        where published.target_game_year = v_context.target_game_year and published.event_key = event.event_key
      ) and (award.id is not null or not exists (
        select 1 from public.national_federation_hosting_candidacies as candidacy
        where candidacy.target_game_year = v_context.target_game_year and candidacy.event_key = event.event_key
          and candidacy.status = 'pending'
      ))
      on conflict (target_game_year, event_key) do nothing
      returning decision, event_type, continent_code, target_game_year
    loop
      if v_decision.decision <> 'neutral' then continue; end if;

      -- Apply immediately to a programme that exists. Edition triggers cover
      -- schedules generated or regenerated after the verdict was published.
      if v_decision.event_type in ('world_championship_junior', 'continental_championship_junior') then
        update public.development_race_editions as target set is_neutral_host = true, host_country_id = null
        from public.seasons as season
        cross join lateral private.get_federation_hosting_editions(season.id, v_decision.event_type, v_decision.continent_code) as edition
        where season.game_year = v_decision.target_game_year and target.id = edition.edition_id
          and target.status in ('planned', 'registration_open', 'registration_closed')
          and (not target.is_neutral_host or target.host_country_id is not null);
      else
        update public.race_editions as target set is_neutral_host = true, host_country_id = null
        from public.seasons as season
        cross join lateral private.get_federation_hosting_editions(season.id, v_decision.event_type, v_decision.continent_code) as edition
        where season.game_year = v_decision.target_game_year and target.id = edition.edition_id
          and target.status in ('planned', 'registration_open', 'registration_closed')
          and (not target.is_neutral_host or target.host_country_id is not null);
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function private.record_due_federation_hosting_decisions()
  from public, anon, authenticated, service_role;

-- Continue using the original funded jury and ledger. Add wall-clock protection
-- for the new jury policy and omit the score from the future public journal.
do $jury$
declare
  v_definition text := replace(pg_get_functiondef(
    'public.settle_due_national_federation_hosting_candidacies()'::regprocedure
  ), chr(13), '');
  v_day_anchor constant text := '((season.current_day_number >= 21 and candidacy.submitted_season_id = season.id';
  v_day_replacement constant text := $day$((season.current_day_number >= 21 and (season.game_year < 5 or exists (
            select 1 from public.season_days as day where day.season_id = season.id and day.day_number = 21
              and day.calendar_date <= (clock_timestamp() at time zone 'Europe/Paris')::date
          )) and candidacy.submitted_season_id = season.id$day$;
  v_journal_anchor constant text := $journal$|| ' · score automatique ' || v_winner.selection_score::text || '.'$journal$;
  v_after_rollover_anchor constant text := 'if v_season.current_day_number < 21 then return 0; end if;';
  v_after_rollover_replacement constant text := $close$if v_season.current_day_number < 21 or (v_season.game_year >= 5 and not exists (
    select 1 from public.season_days as day where day.season_id = v_season.id and day.day_number = 21
      and day.calendar_date <= (clock_timestamp() at time zone 'Europe/Paris')::date
  )) then return 0; end if;$close$;
begin
  if length(v_definition) - length(replace(v_definition, v_day_anchor, '')) <> length(v_day_anchor)
    or length(v_definition) - length(replace(v_definition, v_after_rollover_anchor, '')) <> length(v_after_rollover_anchor)
    or length(v_definition) - length(replace(v_definition, v_journal_anchor, '')) <> length(v_journal_anchor) then
    raise exception 'Unexpected federation hosting settlement definition.';
  end if;
  execute replace(replace(replace(v_definition, v_day_anchor, v_day_replacement),
    v_after_rollover_anchor, v_after_rollover_replacement), v_journal_anchor,
    $journal$|| case when v_winner.target_game_year >= 6 then ' · Décision du jury.'
          else ' · score automatique ' || v_winner.selection_score::text || '.' end$journal$);
end;
$jury$;

alter function public.settle_due_national_federation_hosting_candidacies() set schema private;
revoke all on function private.settle_due_national_federation_hosting_candidacies()
  from public, anon, authenticated, service_role;

create function public.settle_due_national_federation_hosting_candidacies()
returns integer language plpgsql volatile security definer set search_path = ''
set statement_timeout = '30s' set lock_timeout = '1500ms' as $$
declare v_awards integer;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('federation-hosting-attribution', 0)) then return 0; end if;
  v_awards := private.settle_due_national_federation_hosting_candidacies();
  perform private.record_due_federation_hosting_decisions();
  return v_awards;
end;
$$;

revoke all on function public.settle_due_national_federation_hosting_candidacies() from public, anon, authenticated;
grant execute on function public.settle_due_national_federation_hosting_candidacies() to service_role;

-- A bid or withdrawal already executing at midnight must finish before the
-- jury consumes its input. Shared locks allow countries to apply concurrently.
do $lock_submissions$
declare
  v_definition text := replace(pg_get_functiondef(
    'private.get_open_federation_hosting_candidacy_context(text)'::regprocedure
  ), chr(13), '');
  v_anchor constant text := $anchor$  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;$anchor$;
begin
  if length(v_definition) - length(replace(v_definition, v_anchor, '')) <> length(v_anchor) then
    raise exception 'Unexpected federation hosting candidacy definition.';
  end if;
  execute replace(v_definition, v_anchor, v_anchor
    || E'\n  perform pg_advisory_xact_lock_shared(hashtextextended(''federation-hosting-attribution'', 0));');
end;
$lock_submissions$;

-- A course country is still used for its physical conditions. A neutral race
-- cannot count as that country's previous organisation in prestige or the jury.
do $exclude_neutral_history$
declare
  v_patch record;
  v_definition text;
  v_previous text;
begin
  for v_patch in select * from (values
    ('public.refresh_national_federation_renown(uuid)', $previous$    where race.country_id = p_country_id
      and race.competition_type in ('world_championship', 'continental_championship')$previous$,
      $replacement$    where race.country_id = p_country_id and not edition.is_neutral_host
      and race.competition_type in ('world_championship', 'continental_championship')$replacement$),
    ('public.refresh_national_federation_renown(uuid)', $previous$    where edition.competition_type in (
      'world_road', 'world_time_trial',$previous$,
      $replacement$    where not edition.is_neutral_host and edition.competition_type in (
      'world_road', 'world_time_trial',$replacement$),
    ('private.score_national_federation_hosting_candidacy()', $previous$      and (edition.host_country_id = new.country_id$previous$,
      $replacement$      and not edition.is_neutral_host
      and (edition.host_country_id = new.country_id$replacement$)
  ) as patches(signature, previous, replacement)
  loop
    v_definition := replace(pg_get_functiondef(v_patch.signature::regprocedure), chr(13), '');
    v_previous := replace(v_patch.previous, chr(13), '');
    if length(v_definition) - length(replace(v_definition, v_previous, ''))
      <> length(v_previous) * (case when v_patch.signature like 'private.%' then 2 else 1 end) then
      raise exception 'Unexpected federation hosting history definition in %.', v_patch.signature;
    end if;
    execute replace(v_definition, v_previous, replace(v_patch.replacement, chr(13), ''));
  end loop;
end;
$exclude_neutral_history$;

-- The Olympic time trial shares the road race's physical venue. Its edition
-- can be created after the jury has removed the road federation's host status.
do $neutral_olympic_time_trial$
declare
  v_definition text := replace(pg_get_functiondef('public.ensure_global_olympic_event(uuid)'::regprocedure), chr(13), '');
  v_previous constant text := replace($old$select e.host_country_id,e.race_category_id into v_country,v_category
      from public.race_editions e join public.national_federation_olympic_events o on o.race_edition_id=e.id$old$, chr(13), '');
  v_replacement constant text := replace($new$select coalesce(e.host_country_id, r.country_id),e.race_category_id into v_country,v_category
      from public.race_editions e join public.national_federation_olympic_events o on o.race_edition_id=e.id
      join public.races r on r.id=e.race_id$new$, chr(13), '');
begin
  if length(v_definition) - length(replace(v_definition, v_previous, '')) <> length(v_previous) then
    raise exception 'Unexpected Olympic time trial generator definition.';
  end if;
  execute replace(v_definition, v_previous, v_replacement);
end;
$neutral_olympic_time_trial$;

notify pgrst, 'reload schema';
commit;
