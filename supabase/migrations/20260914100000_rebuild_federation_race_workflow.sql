begin;

-- A project starts as an editable draft. Money and reputation are reserved
-- only when the president opens the 24-hour federation vote.
alter table public.national_federation_race_projects
  alter column race_id drop not null,
  alter column race_category_id drop not null;

alter table public.national_federation_race_projects
  drop constraint if exists national_federation_race_projects_status_allowed;
alter table public.national_federation_race_projects
  add constraint national_federation_race_projects_status_allowed check (
    status in ('draft', 'voting', 'scheduled', 'active', 'rejected', 'cancelled')
  );

alter table public.national_federation_race_projects
  add column vote_round integer not null default 0,
  add column vote_opened_at timestamptz,
  add column vote_closes_at timestamptz,
  add column approved_at timestamptz,
  add column rejected_at timestamptz,
  add column creation_cost numeric(14, 2) not null default 0,
  add column reputation_cost numeric(12, 2) not null default 0,
  add column annual_maintenance_cost numeric(14, 2) not null default 0,
  add column reservation_account_id uuid references public.national_federation_accounts(id) on delete set null,
  add column resources_reserved boolean not null default false,
  add column gazette_day_number smallint;

alter table public.national_federation_race_projects
  add constraint national_federation_race_projects_costs_non_negative check (
    creation_cost >= 0 and reputation_cost >= 0 and annual_maintenance_cost >= 0
  ),
  add constraint national_federation_race_projects_vote_dates_valid check (
    vote_closes_at is null or vote_opened_at is null or vote_closes_at > vote_opened_at
  ),
  add constraint national_federation_race_projects_gazette_day_valid check (
    gazette_day_number is null or gazette_day_number between 1 and 28
  );

create table public.national_federation_race_electorate (
  project_id uuid not null references public.national_federation_race_projects(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, team_id),
  unique (project_id, sporting_director_id)
);

create table public.national_federation_race_votes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.national_federation_race_projects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  choice text not null check (choice in ('approve', 'reject')),
  cast_at timestamptz not null default now(),
  unique (project_id, team_id),
  unique (project_id, sporting_director_id)
);

create table public.national_federation_race_maintenance_charges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.national_federation_race_projects(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  account_id uuid references public.national_federation_accounts(id) on delete set null,
  amount numeric(14, 2) not null check (amount >= 0),
  status text not null check (status in ('paid', 'cancelled_insufficient_funds')),
  charged_at timestamptz not null default now(),
  unique (project_id, season_id)
);

alter table public.national_federation_race_electorate enable row level security;
alter table public.national_federation_race_votes enable row level security;
alter table public.national_federation_race_maintenance_charges enable row level security;
create policy national_federation_race_electorate_select_authenticated
  on public.national_federation_race_electorate for select to authenticated using (true);
create policy national_federation_race_votes_select_authenticated
  on public.national_federation_race_votes for select to authenticated using (true);
create policy national_federation_race_maintenance_select_authenticated
  on public.national_federation_race_maintenance_charges for select to authenticated using (true);
grant select on public.national_federation_race_electorate,
  public.national_federation_race_votes,
  public.national_federation_race_maintenance_charges to authenticated;
grant all on public.national_federation_race_electorate,
  public.national_federation_race_votes,
  public.national_federation_race_maintenance_charges to service_role;

alter table public.national_federation_transactions
  drop constraint if exists national_federation_transactions_category_allowed;
alter table public.national_federation_transactions
  add constraint national_federation_transactions_category_allowed check (
    category in (
      'opening_grant', 'race_revenue', 'objective_bonus', 'donation',
      'solidarity', 'infrastructure', 'refund', 'hosting',
      'race_creation', 'race_maintenance'
    )
  );

create or replace function private.get_national_federation_race_costs(
  p_category_code text,
  p_stage_count integer
)
returns table (
  creation_cost numeric,
  reputation_cost numeric,
  annual_maintenance_cost numeric
)
language sql
immutable
security definer
set search_path = ''
as $$
  select
    case p_category_code
      when 'regional' then 300000 + greatest(0, p_stage_count - 1) * 75000
      when 'national' then 900000 + greatest(0, p_stage_count - 1) * 250000
      when 'continental' then 3000000 + greatest(0, p_stage_count - 1) * 750000
    end::numeric,
    case p_category_code
      when 'regional' then 20 + greatest(0, p_stage_count - 1) * 4
      when 'national' then 50 + greatest(0, p_stage_count - 1) * 8
      when 'continental' then 120 + greatest(0, p_stage_count - 1) * 15
    end::numeric,
    case p_category_code
      when 'regional' then 90000 + greatest(0, p_stage_count - 1) * 20000
      when 'national' then 300000 + greatest(0, p_stage_count - 1) * 75000
      when 'continental' then 1000000 + greatest(0, p_stage_count - 1) * 250000
    end::numeric
$$;

-- Reconnect the territorial specialization without duplicating the five
-- objective calculations maintained by the canonical score function.
alter function public.get_national_federation_race_creation_score(uuid, uuid)
  rename to get_national_federation_race_creation_score_base;

create function public.get_national_federation_race_creation_score(
  p_country_id uuid,
  p_season_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_score jsonb;
  v_effects record;
  v_total integer;
  v_penalty integer;
begin
  v_score := public.get_national_federation_race_creation_score_base(
    p_country_id,
    p_season_id
  );
  select * into v_effects
  from public.get_national_federation_race_organization_effects(p_country_id);
  v_penalty := coalesce((v_score ->> 'existingRaceCount')::integer, 0)
    * coalesce(v_effects.calendar_penalty_per_existing_race, 10);
  v_total := greatest(0, least(100,
    coalesce((v_score ->> 'rankingPoints')::integer, 0)
    + coalesce((v_score ->> 'objectivePoints')::integer, 0)
    - v_penalty
  ));
  return v_score || jsonb_build_object(
    'calendarPenaltyPerRace', coalesce(v_effects.calendar_penalty_per_existing_race, 10),
    'calendarPenalty', v_penalty,
    'total', v_total,
    'threshold', coalesce(v_effects.regional_national_homologation_threshold, 60),
    'continentalThreshold', 60,
    'eligible', v_total >= coalesce(v_effects.regional_national_homologation_threshold, 60)
  );
end;
$$;

create or replace function public.vote_national_federation_race(
  p_country_code text,
  p_project_id uuid,
  p_choice text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_project public.national_federation_race_projects%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  if p_choice not in ('approve', 'reject') then raise exception 'Ce choix de vote est invalide.'; end if;
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select project.* into v_project
  from public.national_federation_race_projects as project
  where project.id = p_project_id and project.country_id = v_identity.country_id
  for update;
  if v_project.id is null or v_project.status <> 'voting'
    or v_project.vote_closes_at <= now() then
    raise exception 'Ce vote est clos ou introuvable.';
  end if;
  if not exists (
    select 1 from public.national_federation_race_electorate as electorate
    where electorate.project_id = v_project.id
      and electorate.team_id = v_identity.team_id
      and electorate.sporting_director_id = v_identity.sporting_director_id
  ) then raise exception 'Vous ne faites pas partie du corps électoral de ce scrutin.'; end if;

  insert into public.national_federation_race_votes (
    project_id, team_id, sporting_director_id, choice, cast_at
  ) values (
    v_project.id, v_identity.team_id, v_identity.sporting_director_id, p_choice, now()
  ) on conflict (project_id, team_id) do update
    set choice = excluded.choice, sporting_director_id = excluded.sporting_director_id,
        cast_at = excluded.cast_at;
  return v_project.id;
end;
$$;

create or replace function public.settle_due_national_federation_race_maintenance()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_project public.national_federation_race_projects%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_paid integer := 0;
  v_cancelled integer := 0;
  v_country_code text;
  v_member record;
begin
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null then return jsonb_build_object('paid', 0, 'cancelled', 0); end if;
  perform public.initialize_due_national_federation_accounts();
  for v_project in
    select project.* from public.national_federation_race_projects as project
    where project.status = 'active'
      and project.activation_game_year < v_season.game_year
      and not exists (
        select 1 from public.national_federation_race_maintenance_charges as charge
        where charge.project_id = project.id and charge.season_id = v_season.id
      )
    order by project.id
    for update skip locked
  loop
    select * into v_account from public.national_federation_accounts
    where country_id = v_project.country_id and season_id = v_season.id for update;
    if v_account.id is not null and v_account.balance >= v_project.annual_maintenance_cost then
      update public.national_federation_accounts
      set balance = balance - v_project.annual_maintenance_cost, updated_at = now()
      where id = v_account.id;
      insert into public.national_federation_race_maintenance_charges (
        project_id, season_id, account_id, amount, status
      ) values (
        v_project.id, v_season.id, v_account.id,
        v_project.annual_maintenance_cost, 'paid'
      );
      insert into public.national_federation_transactions (
        account_id, day_number, amount, category, description, source_reference, metadata
      ) values (
        v_account.id, coalesce(v_season.current_day_number, 1),
        -v_project.annual_maintenance_cost, 'race_maintenance',
        'Maintenance annuelle de ' || v_project.name || '.',
        'federation-race:' || v_project.id::text || ':maintenance:s'
          || v_season.game_year::text,
        jsonb_build_object('projectId', v_project.id, 'gameYear', v_season.game_year)
      );
      v_paid := v_paid + 1;
    else
      insert into public.national_federation_race_maintenance_charges (
        project_id, season_id, account_id, amount, status
      ) values (
        v_project.id, v_season.id, v_account.id,
        v_project.annual_maintenance_cost, 'cancelled_insufficient_funds'
      );
      update public.national_federation_race_projects
      set status = 'cancelled', updated_at = now() where id = v_project.id;
      update public.races set status = 'discontinued' where id = v_project.race_id;
      update public.race_editions set status = 'cancelled'
      where race_id = v_project.race_id
        and status in ('planned', 'registration_open', 'registration_closed');
      update public.stages set status = 'cancelled'
      where race_edition_id in (
        select edition.id from public.race_editions as edition
        where edition.race_id = v_project.race_id and edition.status = 'cancelled'
      ) and status = 'planned';
      select upper(country.iso_alpha2) into v_country_code
      from public.countries as country where country.id = v_project.country_id;
      for v_member in
        select team_season.team_id from public.team_seasons as team_season
        where team_season.season_id = v_season.id
          and team_season.registration_country_id = v_project.country_id
          and team_season.status in ('planned', 'active', 'completed')
      loop
        perform private.create_team_operational_message(
          v_member.team_id, 'system', 'Assistant de la fédération',
          'Course arrêtée faute de maintenance',
          v_project.name || ' ne peut pas être reconduite : fonds fédéraux insuffisants.',
          'La maintenance annuelle n’a pas pu être débitée. La course est retirée des prochaines éditions.',
          '/jeu/federations/' || lower(v_country_code) || '?onglet=races',
          'Consulter les courses',
          'federation-race:' || v_project.id::text || ':maintenance:s'
            || v_season.game_year::text || ':failed:' || v_member.team_id::text,
          true, now()
        );
      end loop;
      v_cancelled := v_cancelled + 1;
    end if;
  end loop;
  return jsonb_build_object('paid', v_paid, 'cancelled', v_cancelled);
end;
$$;

create or replace function private.prevent_cancelled_federation_race_edition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.national_federation_race_projects as project
    where project.race_id = new.race_id and project.status = 'cancelled'
  ) then return null; end if;
  return new;
end;
$$;

drop trigger if exists prevent_cancelled_federation_race_edition on public.race_editions;
create trigger prevent_cancelled_federation_race_edition
before insert on public.race_editions
for each row execute function private.prevent_cancelled_federation_race_edition();

create or replace function private.preserve_federation_race_stage_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.national_federation_race_projects%rowtype;
  v_season_id uuid;
  v_stage jsonb;
  v_slot_index integer;
  v_day_number integer;
  v_day_slot text;
begin
  select project.* into v_project
  from public.race_editions as edition
  join public.national_federation_race_projects as project on project.race_id = edition.race_id
  where edition.id = new.race_edition_id and project.status in ('scheduled', 'active');
  if v_project.id is null then return new; end if;
  select edition.season_id into v_season_id
  from public.race_editions as edition where edition.id = new.race_edition_id;
  v_stage := v_project.stage_blueprint -> (new.stage_number - 1);
  if v_stage is null then return new; end if;
  v_slot_index := (v_project.start_day_number - 1) * 2
    + case v_project.start_day_slot when 'late' then 1 else 0 end
    + new.stage_number - 1;
  v_day_number := floor(v_slot_index / 2.0)::integer + 1;
  v_day_slot := case mod(v_slot_index, 2) when 0 then 'early' else 'late' end;
  select day.id into new.season_day_id from public.season_days as day
  where day.season_id = v_season_id and day.day_number = v_day_number;
  new.name := btrim(v_stage ->> 'name');
  new.stage_type := v_stage ->> 'stageType';
  new.profile_type := v_stage ->> 'profileType';
  new.distance_km := (
    select sum((segment.value ->> 'distanceKm')::numeric)
    from jsonb_array_elements(v_stage -> 'segments') as segment(value)
  );
  new.day_slot := v_day_slot;
  new.departure_at := (
    select (day.calendar_date::timestamp
      + case v_day_slot when 'early' then time '14:00' else time '18:00' end)
      at time zone 'Europe/Paris'
    from public.season_days as day where day.id = new.season_day_id
  );
  return new;
end;
$$;

drop trigger if exists preserve_federation_race_stage_schedule on public.stages;
create trigger preserve_federation_race_stage_schedule
before insert or update on public.stages
for each row execute function private.preserve_federation_race_stage_schedule();

-- Backfill legacy, already-materialized projects with the same visible scale.
update public.national_federation_race_projects as project
set creation_cost = case project.category_code
      when 'regional' then 300000 + greatest(0, jsonb_array_length(project.stage_blueprint) - 1) * 75000
      when 'national' then 900000 + greatest(0, jsonb_array_length(project.stage_blueprint) - 1) * 250000
      else 3000000 + greatest(0, jsonb_array_length(project.stage_blueprint) - 1) * 750000 end,
    reputation_cost = case project.category_code
      when 'regional' then 20 + greatest(0, jsonb_array_length(project.stage_blueprint) - 1) * 4
      when 'national' then 50 + greatest(0, jsonb_array_length(project.stage_blueprint) - 1) * 8
      else 120 + greatest(0, jsonb_array_length(project.stage_blueprint) - 1) * 15 end,
    annual_maintenance_cost = case project.category_code
      when 'regional' then 90000 + greatest(0, jsonb_array_length(project.stage_blueprint) - 1) * 20000
      when 'national' then 300000 + greatest(0, jsonb_array_length(project.stage_blueprint) - 1) * 75000
      else 1000000 + greatest(0, jsonb_array_length(project.stage_blueprint) - 1) * 250000 end,
    approved_at = coalesce(project.approved_at, project.created_at)
where project.creation_cost = 0;

create or replace function private.materialize_national_federation_race(
  p_project_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_project public.national_federation_race_projects%rowtype;
  v_target_season public.seasons%rowtype;
  v_current_season public.seasons%rowtype;
  v_category public.race_categories%rowtype;
  v_stage record;
  v_segment record;
  v_slot_index integer;
  v_day_number integer;
  v_day_slot text;
  v_stage_distance numeric;
  v_stage_id uuid;
  v_first_departure timestamptz;
  v_race_id uuid := gen_random_uuid();
  v_edition_id uuid := gen_random_uuid();
  v_slug text;
  v_gazette_day integer;
  v_country_code text;
begin
  select * into v_project from public.national_federation_race_projects
  where id = p_project_id for update;
  if v_project.id is null or v_project.status <> 'voting' then
    raise exception 'Ce projet ne peut pas être matérialisé.';
  end if;
  select * into v_current_season from public.seasons where status = 'active' limit 1;
  select * into v_target_season from public.seasons
  where game_year = v_project.activation_game_year and status = 'planned';
  if v_target_season.id is null then raise exception 'La saison cible est introuvable.'; end if;
  perform private.validate_national_federation_race_blueprint(
    v_target_season.id, v_project.id, v_project.race_format, v_project.category_code,
    v_project.start_day_number, v_project.start_day_slot, v_project.stage_blueprint
  );
  select * into v_category from public.race_categories
  where id = v_project.race_category_id and is_active = true;
  if v_category.id is null then raise exception 'La catégorie de course est indisponible.'; end if;
  select upper(country.iso_alpha2) into v_country_code
  from public.countries as country where country.id = v_project.country_id;
  v_slug := 'federation-' || lower(v_country_code) || '-'
    || substr(replace(v_race_id::text, '-', ''), 1, 12);

  insert into public.races (
    id, country_id, name, short_name, race_format, status, slug,
    competition_type, is_monument, is_grand_tour
  ) values (
    v_race_id, v_project.country_id, v_project.name, v_project.short_name,
    v_project.race_format, 'active', v_slug, 'standard', false, false
  );
  insert into public.race_editions (
    id, race_id, season_id, race_category_id, edition_number, display_name,
    status, minimum_reputation, registration_policy, field_limit
  ) values (
    v_edition_id, v_race_id, v_target_season.id, v_category.id, 1,
    v_project.name, 'registration_open',
    case when v_project.category_code in ('national', 'regional') then 0 else null end,
    case when v_project.category_code in ('national', 'regional') then 'open' else 'criteria_pending' end,
    case when v_project.category_code = 'regional' then 16 else 24 end
  );

  for v_stage in
    select value as data, ordinality::integer as stage_number
    from jsonb_array_elements(v_project.stage_blueprint) with ordinality
  loop
    v_slot_index := (v_project.start_day_number - 1) * 2
      + case v_project.start_day_slot when 'late' then 1 else 0 end
      + v_stage.stage_number - 1;
    v_day_number := floor(v_slot_index / 2.0)::integer + 1;
    v_day_slot := case mod(v_slot_index, 2) when 0 then 'early' else 'late' end;
    select sum((segment.value ->> 'distanceKm')::numeric) into v_stage_distance
    from jsonb_array_elements(v_stage.data -> 'segments') as segment(value);
    insert into public.stages (
      race_edition_id, season_day_id, stage_number, name, stage_type,
      distance_km, status, departure_at, profile_type, day_slot
    )
    select v_edition_id, season_day.id, v_stage.stage_number,
      btrim(v_stage.data ->> 'name'), v_stage.data ->> 'stageType',
      v_stage_distance, 'planned',
      (season_day.calendar_date::timestamp + case v_day_slot when 'early' then time '14:00' else time '18:00' end)
        at time zone 'Europe/Paris',
      v_stage.data ->> 'profileType', v_day_slot
    from public.season_days as season_day
    where season_day.season_id = v_target_season.id and season_day.day_number = v_day_number
    returning id, departure_at into v_stage_id, v_first_departure;
    if v_stage_id is null then raise exception 'La journée J% est absente.', v_day_number; end if;
    if v_stage.stage_number = 1 then
      update public.race_editions
      set registration_closes_at = v_first_departure - interval '8 hours',
          withdrawal_closes_at = v_first_departure - interval '8 hours'
      where id = v_edition_id;
    end if;
    insert into public.stage_segments (
      stage_id, segment_number, distance_km, terrain_type, surface_type, average_gradient_pct
    )
    select v_stage_id, segment.ordinality::integer,
      (segment.value ->> 'distanceKm')::numeric,
      segment.value ->> 'terrainType', segment.value ->> 'surfaceType',
      (segment.value ->> 'averageGradientPct')::numeric
    from jsonb_array_elements(v_stage.data -> 'segments')
      with ordinality as segment(value, ordinality);
  end loop;

  v_gazette_day := coalesce(v_current_season.current_day_number, 1);
  if exists (
    select 1 from public.cyclogazette_editions as gazette
    join public.season_days as gazette_day on gazette_day.id = gazette.season_day_id
    where gazette.season_id = v_current_season.id
      and gazette_day.day_number = v_gazette_day
  ) and v_gazette_day < 28 then
    v_gazette_day := v_gazette_day + 1;
  end if;
  update public.national_federation_race_projects
  set race_id = v_race_id, status = 'scheduled', approved_at = now(),
      gazette_day_number = v_gazette_day, resources_reserved = false, updated_at = now()
  where id = v_project.id;
  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_project.country_id, v_current_season.id, v_current_season.current_day_number,
    'governance', 'Nouvelle course fédérale approuvée',
    v_project.name || ' rejoint durablement le calendrier à partir de la Saison '
      || v_target_season.game_year::text || '.',
    'federation-race:' || v_project.id::text || ':approved'
  ) on conflict (source_reference) do nothing;
  return v_race_id;
end;
$$;

create or replace function public.save_national_federation_race_draft(
  p_country_code text,
  p_name text,
  p_short_name text,
  p_race_format text,
  p_category_code text,
  p_start_day_number integer,
  p_start_day_slot text,
  p_stage_blueprint jsonb
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
  v_season public.seasons%rowtype;
  v_target_season public.seasons%rowtype;
  v_target_season_id uuid;
  v_project public.national_federation_race_projects%rowtype;
  v_score jsonb;
  v_costs record;
  v_category_id uuid;
  v_threshold integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_identity.country_id is null or v_identity.sporting_director_id is null then
    raise exception 'Cette action est réservée à une équipe affiliée à la fédération.';
  end if;
  if v_season.id is null or v_season.game_year < 4 then
    raise exception 'La création de course sera disponible à partir de la Saison 4.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then raise exception 'Seul le président élu peut préparer une course.'; end if;
  if coalesce((
    select infrastructure.level from public.national_federation_infrastructures as infrastructure
    where infrastructure.country_id = v_identity.country_id
      and infrastructure.infrastructure_code = 'race_organization_office'
  ), 0) < 1 then raise exception 'Le Bureau d’organisation doit atteindre le niveau 1.'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'federation-race:' || v_identity.country_id::text || ':' || v_season.id::text, 0
  ));
  select * into v_project
  from public.national_federation_race_projects as project
  where project.country_id = v_identity.country_id
    and project.submitted_season_id = v_season.id
  for update;
  if v_project.id is not null and v_project.status not in ('draft', 'rejected') then
    raise exception 'Cette fédération a déjà engagé son projet de course cette saison.';
  end if;

  if length(btrim(coalesce(p_name, ''))) not between 4 and 80 then
    raise exception 'Le nom de la course doit contenir entre 4 et 80 caractères.';
  end if;
  if length(btrim(coalesce(p_short_name, ''))) not between 2 and 12
    or btrim(p_short_name) !~ '^[[:alnum:]À-ÖØ-öø-ÿ -]+$' then
    raise exception 'Le sigle de la course est invalide.';
  end if;
  if exists (
    select 1 from public.races as race
    where lower(race.name) = lower(btrim(p_name))
      and race.id is distinct from v_project.race_id
  ) then raise exception 'Une course porte déjà ce nom.'; end if;

  v_score := public.get_national_federation_race_creation_score(v_identity.country_id, v_season.id);
  v_threshold := case when p_category_code = 'continental' then 60
    else coalesce((v_score ->> 'threshold')::integer, 60) end;
  if coalesce((v_score ->> 'total')::integer, 0) < v_threshold then
    raise exception 'L’indice d’homologation requis pour ce rang n’est pas atteint.';
  end if;

  select public.ensure_transfer_next_season(v_season.id) into v_target_season_id;
  select * into v_target_season from public.seasons where id = v_target_season_id;
  if v_target_season.id is null or v_target_season.game_year <> v_season.game_year + 1
    or v_target_season.status <> 'planned' then
    raise exception 'La saison suivante n’est pas prête à recevoir cette course.';
  end if;
  perform private.validate_national_federation_race_blueprint(
    v_target_season.id, v_project.id, p_race_format, p_category_code,
    p_start_day_number, p_start_day_slot, p_stage_blueprint
  );

  select category.id into v_category_id
  from public.race_categories as category
  where category.code = p_category_code and category.is_active = true
    and category.race_format_scope in ('both', p_race_format);
  if v_category_id is null then
    raise exception 'Ce rang de course n’est pas disponible pour ce format.';
  end if;
  select * into v_costs from private.get_national_federation_race_costs(
    p_category_code, jsonb_array_length(p_stage_blueprint)
  );

  if v_project.id is null then
    insert into public.national_federation_race_projects (
      country_id, submitted_season_id, activation_game_year,
      race_category_id, submitted_by_director_id, name, short_name,
      race_format, category_code, start_day_number, start_day_slot,
      stage_blueprint, score_snapshot, status, creation_cost,
      reputation_cost, annual_maintenance_cost
    ) values (
      v_identity.country_id, v_season.id, v_target_season.game_year,
      v_category_id, v_identity.sporting_director_id, btrim(p_name),
      upper(btrim(p_short_name)), p_race_format, p_category_code,
      p_start_day_number, p_start_day_slot, p_stage_blueprint, v_score,
      'draft', v_costs.creation_cost, v_costs.reputation_cost,
      v_costs.annual_maintenance_cost
    ) returning id into v_project.id;
  else
    update public.national_federation_race_projects
    set race_category_id = v_category_id,
        submitted_by_director_id = v_identity.sporting_director_id,
        name = btrim(p_name), short_name = upper(btrim(p_short_name)),
        race_format = p_race_format, category_code = p_category_code,
        start_day_number = p_start_day_number, start_day_slot = p_start_day_slot,
        stage_blueprint = p_stage_blueprint, score_snapshot = v_score,
        status = 'draft', rejected_at = null,
        creation_cost = v_costs.creation_cost,
        reputation_cost = v_costs.reputation_cost,
        annual_maintenance_cost = v_costs.annual_maintenance_cost,
        updated_at = now()
    where id = v_project.id;
  end if;
  return v_project.id;
end;
$$;

create or replace function public.submit_national_federation_race_vote(
  p_country_code text,
  p_project_id uuid
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
  v_season public.seasons%rowtype;
  v_target_season_id uuid;
  v_project public.national_federation_race_projects%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_reputation numeric;
  v_electorate_count integer;
  v_round integer;
  v_country_code text;
  v_member record;
  v_score jsonb;
  v_threshold integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_identity.country_id is null or v_identity.sporting_director_id is null then
    raise exception 'Cette action est réservée à une équipe affiliée à la fédération.';
  end if;
  select * into v_project from public.national_federation_race_projects
  where id = p_project_id and country_id = v_identity.country_id
    and submitted_season_id = v_season.id for update;
  if v_project.id is null or v_project.status not in ('draft', 'rejected') then
    raise exception 'Ce brouillon ne peut pas être soumis au vote.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then raise exception 'Seul le président élu peut ouvrir le vote.'; end if;
  if coalesce((
    select infrastructure.level from public.national_federation_infrastructures as infrastructure
    where infrastructure.country_id = v_identity.country_id
      and infrastructure.infrastructure_code = 'race_organization_office'
  ), 0) < 1 then raise exception 'Le Bureau d’organisation doit atteindre le niveau 1.'; end if;
  v_score := public.get_national_federation_race_creation_score(v_identity.country_id, v_season.id);
  v_threshold := case when v_project.category_code = 'continental' then 60
    else coalesce((v_score ->> 'threshold')::integer, 60) end;
  if coalesce((v_score ->> 'total')::integer, 0) < v_threshold then
    raise exception 'L’indice d’homologation requis pour ce rang n’est plus atteint.';
  end if;

  select id into v_target_season_id from public.seasons
  where game_year = v_project.activation_game_year and status = 'planned';
  if v_target_season_id is null then raise exception 'La saison cible est introuvable.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'federation-race-calendar:' || v_target_season_id::text, 0
  ));
  perform private.validate_national_federation_race_blueprint(
    v_target_season_id, v_project.id, v_project.race_format, v_project.category_code,
    v_project.start_day_number, v_project.start_day_slot, v_project.stage_blueprint
  );

  perform public.initialize_due_national_federation_accounts();
  select * into v_account from public.national_federation_accounts
  where country_id = v_identity.country_id and season_id = v_season.id for update;
  if v_account.id is null or v_account.balance < v_project.creation_cost then
    raise exception 'Les fonds de la fédération sont insuffisants pour ouvrir ce vote.';
  end if;
  select reputation_points into v_reputation from public.sporting_directors
  where id = v_identity.sporting_director_id for update;
  if coalesce(v_reputation, 0) < v_project.reputation_cost then
    raise exception 'La réputation du président est insuffisante pour porter ce projet.';
  end if;

  delete from public.national_federation_race_votes where project_id = v_project.id;
  delete from public.national_federation_race_electorate where project_id = v_project.id;
  insert into public.national_federation_race_electorate (
    project_id, team_season_id, team_id, sporting_director_id
  )
  select v_project.id, team_season.id, team_season.team_id, assignment.sporting_director_id
  from public.team_seasons as team_season
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  where team_season.season_id = v_season.id
    and team_season.registration_country_id = v_identity.country_id
    and team_season.status in ('planned', 'active', 'completed')
  on conflict do nothing;
  get diagnostics v_electorate_count = row_count;
  if v_electorate_count = 0 then raise exception 'Aucun membre ne peut prendre part à ce vote.'; end if;

  v_round := v_project.vote_round + 1;
  update public.national_federation_accounts
  set balance = balance - v_project.creation_cost, updated_at = now()
  where id = v_account.id;
  update public.sporting_directors
  set reputation_points = reputation_points - v_project.reputation_cost
  where id = v_identity.sporting_director_id;
  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description, source_reference, metadata
  ) values (
    v_account.id, v_season.current_day_number, -v_project.creation_cost,
    'race_creation', 'Réservation pour la création de ' || v_project.name || '.',
    'federation-race:' || v_project.id::text || ':vote:' || v_round::text || ':reservation',
    jsonb_build_object('projectId', v_project.id, 'voteRound', v_round,
      'reputationCost', v_project.reputation_cost)
  );
  update public.national_federation_race_projects
  set status = 'voting', vote_round = v_round, vote_opened_at = now(),
      vote_closes_at = now() + interval '24 hours', rejected_at = null,
      reservation_account_id = v_account.id, resources_reserved = true,
      submitted_by_director_id = v_identity.sporting_director_id, updated_at = now()
  where id = v_project.id;

  insert into public.national_federation_race_votes (
    project_id, team_id, sporting_director_id, choice
  ) values (
    v_project.id, v_identity.team_id, v_identity.sporting_director_id, 'approve'
  );

  select upper(country.iso_alpha2) into v_country_code
  from public.countries as country where country.id = v_identity.country_id;
  for v_member in
    select electorate.team_id
    from public.national_federation_race_electorate as electorate
    where electorate.project_id = v_project.id
  loop
    perform private.create_team_operational_message(
      v_member.team_id, 'system', 'Assistant de la fédération',
      'Vote : une nouvelle course pour le pays',
      v_project.name || ' est soumise au vote pendant 24 heures.',
      'Le président propose une nouvelle épreuve permanente. Consultez son parcours, son coût et votez avant la clôture.',
      '/jeu/federations/' || lower(v_country_code) || '?onglet=races',
      'Consulter et voter',
      'federation-race:' || v_project.id::text || ':vote:' || v_round::text || ':open:' || v_member.team_id::text,
      true, now()
    );
  end loop;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number,
    'governance', 'Vote ouvert pour une nouvelle course',
    v_project.name || ' est soumise aux membres pendant 24 heures.',
    'federation-race:' || v_project.id::text || ':vote:' || v_round::text || ':opened'
  );
  return v_project.id;
end;
$$;

revoke all on function public.get_national_federation_race_creation_score_base(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_national_federation_race_creation_score_base(uuid, uuid)
  to service_role;
revoke all on function public.get_national_federation_race_creation_score(uuid, uuid)
  from public, anon;
grant execute on function public.get_national_federation_race_creation_score(uuid, uuid)
  to authenticated, service_role;

create or replace function private.validate_national_federation_race_blueprint(
  p_target_season_id uuid,
  p_project_id uuid,
  p_race_format text,
  p_category_code text,
  p_start_day_number integer,
  p_start_day_slot text,
  p_stage_blueprint jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stage record;
  v_segment record;
  v_stage_count integer;
  v_segment_count integer;
  v_slot_index integer;
  v_day_number integer;
  v_day_slot text;
  v_stage_distance numeric;
  v_terrain text;
  v_gradient numeric;
  v_profile text;
  v_stage_type text;
begin
  if p_race_format not in ('one_day', 'stage_race') then
    raise exception 'Le format de course est invalide.';
  end if;
  if p_category_code not in ('continental', 'national', 'regional') then
    raise exception 'Les rangs Elite et Mondial ne peuvent pas être créés par une fédération.';
  end if;
  if p_start_day_number not between 1 and 28 or p_start_day_slot not in ('early', 'late') then
    raise exception 'Le créneau de départ est invalide.';
  end if;
  if jsonb_typeof(p_stage_blueprint) <> 'array' then
    raise exception 'Le profil des étapes est invalide.';
  end if;
  v_stage_count := jsonb_array_length(p_stage_blueprint);
  if (p_race_format = 'one_day' and v_stage_count <> 1)
    or (p_race_format = 'stage_race' and v_stage_count not between 2 and 8) then
    raise exception 'Une classique compte une étape ; un tour en compte de 2 à 8.';
  end if;
  v_slot_index := (p_start_day_number - 1) * 2
    + case p_start_day_slot when 'late' then 1 else 0 end;
  if v_slot_index + v_stage_count - 1 > 55 then
    raise exception 'La dernière étape dépasserait la J28.';
  end if;

  for v_stage in
    select value as data, ordinality::integer as stage_number
    from jsonb_array_elements(p_stage_blueprint) with ordinality
  loop
    if length(btrim(coalesce(v_stage.data ->> 'name', ''))) not between 3 and 80 then
      raise exception 'Chaque étape doit posséder un nom valide.';
    end if;
    v_stage_type := v_stage.data ->> 'stageType';
    v_profile := v_stage.data ->> 'profileType';
    if v_stage_type not in ('road', 'individual_time_trial', 'team_time_trial', 'prologue')
      or v_profile not in ('flat', 'sprint', 'hilly', 'mountain', 'cobbles', 'time_trial', 'mixed')
      or (v_stage_type = 'road' and v_profile = 'time_trial')
      or (v_stage_type <> 'road' and v_profile <> 'time_trial') then
      raise exception 'Le type ou le profil d’une étape est invalide.';
    end if;
    if jsonb_typeof(v_stage.data -> 'segments') <> 'array' then
      raise exception 'Les tronçons d’une étape sont invalides.';
    end if;
    v_segment_count := jsonb_array_length(v_stage.data -> 'segments');
    if v_segment_count not between 1 and 12 then
      raise exception 'Une étape doit compter de 1 à 12 tronçons.';
    end if;
    v_stage_distance := 0;
    for v_segment in
      select value as data from jsonb_array_elements(v_stage.data -> 'segments')
    loop
      v_terrain := v_segment.data ->> 'terrainType';
      v_gradient := (v_segment.data ->> 'averageGradientPct')::numeric;
      if (v_segment.data ->> 'distanceKm')::numeric not between 2 and 250
        or (v_segment.data ->> 'surfaceType') not in ('asphalt', 'cobbles')
        or v_terrain not in ('flat', 'climb', 'descent')
        or v_gradient not between -30 and 30
        or (v_terrain = 'flat' and v_gradient <> 0)
        or (v_terrain = 'climb' and v_gradient <= 0)
        or (v_terrain = 'descent' and v_gradient >= 0) then
        raise exception 'Un tronçon contient une distance, un relief ou une pente invalide.';
      end if;
      v_stage_distance := v_stage_distance + (v_segment.data ->> 'distanceKm')::numeric;
    end loop;
    if v_stage_distance not between 5 and 350
      or (v_stage_type = 'prologue' and v_stage_distance > 30) then
      raise exception 'La distance totale d’une étape est invalide.';
    end if;

    v_slot_index := (p_start_day_number - 1) * 2
      + case p_start_day_slot when 'late' then 1 else 0 end
      + v_stage.stage_number - 1;
    v_day_number := floor(v_slot_index / 2.0)::integer + 1;
    v_day_slot := case mod(v_slot_index, 2) when 0 then 'early' else 'late' end;

    if exists (
      select 1
      from public.stages as protected_stage
      join public.season_days as protected_day on protected_day.id = protected_stage.season_day_id
      join public.race_editions as protected_edition on protected_edition.id = protected_stage.race_edition_id
      join public.races as protected_race on protected_race.id = protected_edition.race_id
      where protected_edition.season_id = p_target_season_id
        and protected_day.day_number = v_day_number
        and protected_edition.status <> 'cancelled'
        and protected_race.status = 'active'
        and protected_race.competition_type in (
          'national_road', 'national_time_trial', 'continental_championship',
          'world_championship', 'nations_cup'
        )
    ) or exists (
      select 1 from public.development_race_editions as protected_development
      where protected_development.season_id = p_target_season_id
        and v_day_number between protected_development.start_day_number and protected_development.end_day_number
        and protected_development.status <> 'cancelled'
        and protected_development.competition_type in (
          'national_road', 'national_time_trial', 'continental_road',
          'continental_time_trial', 'world_road', 'world_time_trial',
          'nations_cup_junior'
        )
    ) then
      raise exception 'La J% est protégée par un CN, CC, CM, JQ ou une Nations Cup.', v_day_number;
    end if;

    if (
      select count(*)
      from public.stages as occupied_stage
      join public.season_days as occupied_day on occupied_day.id = occupied_stage.season_day_id
      join public.race_editions as occupied_edition on occupied_edition.id = occupied_stage.race_edition_id
      join public.races as occupied_race on occupied_race.id = occupied_edition.race_id
      where occupied_edition.season_id = p_target_season_id
        and occupied_day.day_number = v_day_number
        and occupied_edition.status <> 'cancelled'
        and occupied_stage.day_slot = v_day_slot
        and occupied_race.competition_type = 'standard'
        and occupied_race.status = 'active'
        and not exists (
          select 1 from public.national_federation_race_projects as own_project
          where own_project.id = p_project_id and own_project.race_id = occupied_race.id
        )
    ) >= 2 then
      raise exception 'La vague de J% est déjà complète (deux courses).', v_day_number;
    end if;

    if exists (
      select 1
      from public.national_federation_race_projects as reserved_project
      join public.seasons as reserved_season
        on reserved_season.game_year = reserved_project.activation_game_year
      where reserved_season.id = p_target_season_id
        and reserved_project.id is distinct from p_project_id
        and reserved_project.status in ('voting', 'scheduled', 'active')
        and v_slot_index between
          ((reserved_project.start_day_number - 1) * 2
            + case reserved_project.start_day_slot when 'late' then 1 else 0 end)
          and ((reserved_project.start_day_number - 1) * 2
            + case reserved_project.start_day_slot when 'late' then 1 else 0 end
            + jsonb_array_length(reserved_project.stage_blueprint) - 1)
    ) then
      raise exception 'Ce créneau est déjà réservé par un autre projet fédéral.';
    end if;
  end loop;
end;
$$;

create or replace function public.settle_due_national_federation_race_votes()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_project public.national_federation_race_projects%rowtype;
  v_season public.seasons%rowtype;
  v_approve integer;
  v_reject integer;
  v_approved integer := 0;
  v_rejected integer := 0;
  v_country_code text;
  v_member record;
begin
  select * into v_season from public.seasons where status = 'active' limit 1;
  for v_project in
    select project.* from public.national_federation_race_projects as project
    where project.status = 'voting' and project.vote_closes_at <= now()
    order by project.vote_closes_at, project.id
    for update skip locked
  loop
    select
      count(*) filter (where vote.choice = 'approve')::integer,
      count(*) filter (where vote.choice = 'reject')::integer
    into v_approve, v_reject
    from public.national_federation_race_votes as vote
    where vote.project_id = v_project.id;
    select upper(country.iso_alpha2) into v_country_code
    from public.countries as country where country.id = v_project.country_id;

    if coalesce(v_approve, 0) > coalesce(v_reject, 0) then
      perform private.materialize_national_federation_race(v_project.id);
      v_approved := v_approved + 1;
      for v_member in
        select electorate.team_id from public.national_federation_race_electorate as electorate
        where electorate.project_id = v_project.id
      loop
        perform private.create_team_operational_message(
          v_member.team_id, 'system', 'Assistant de la fédération',
          'Course approuvée par la fédération',
          v_project.name || ' rejoint le calendrier à partir de la Saison '
            || v_project.activation_game_year::text || '.',
          'Le vote est favorable. La course devient permanente et sa maintenance annuelle sera intégrée aux finances fédérales.',
          '/jeu/federations/' || lower(v_country_code) || '?onglet=races',
          'Voir la course',
          'federation-race:' || v_project.id::text || ':vote:' || v_project.vote_round::text
            || ':approved:' || v_member.team_id::text,
          true, now()
        );
      end loop;
    else
      if v_project.resources_reserved then
        update public.national_federation_accounts
        set balance = balance + v_project.creation_cost, updated_at = now()
        where id = v_project.reservation_account_id;
        update public.sporting_directors
        set reputation_points = reputation_points + v_project.reputation_cost
        where id = v_project.submitted_by_director_id;
        insert into public.national_federation_transactions (
          account_id, day_number, amount, category, description, source_reference, metadata
        ) values (
          v_project.reservation_account_id, coalesce(v_season.current_day_number, 1),
          v_project.creation_cost, 'refund',
          'Remboursement du projet refusé : ' || v_project.name || '.',
          'federation-race:' || v_project.id::text || ':vote:' || v_project.vote_round::text || ':refund',
          jsonb_build_object('projectId', v_project.id, 'voteRound', v_project.vote_round,
            'reputationRefund', v_project.reputation_cost)
        ) on conflict (source_reference) do nothing;
      end if;
      update public.national_federation_race_projects
      set status = 'rejected', rejected_at = now(), resources_reserved = false, updated_at = now()
      where id = v_project.id;
      insert into public.national_federation_journal_entries (
        country_id, season_id, day_number, category, title, detail, source_reference
      ) values (
        v_project.country_id, v_project.submitted_season_id,
        coalesce(v_season.current_day_number, 1), 'governance',
        'Projet de course refusé',
        v_project.name || ' n’obtient pas la majorité. Les ressources réservées sont rendues.',
        'federation-race:' || v_project.id::text || ':vote:' || v_project.vote_round::text || ':rejected'
      ) on conflict (source_reference) do nothing;
      v_rejected := v_rejected + 1;
      for v_member in
        select electorate.team_id from public.national_federation_race_electorate as electorate
        where electorate.project_id = v_project.id
      loop
        perform private.create_team_operational_message(
          v_member.team_id, 'system', 'Assistant de la fédération',
          'Projet de course refusé',
          v_project.name || ' n’a pas obtenu la majorité.',
          'Le vote est défavorable. Le coût financier et la réputation réservés sont remboursés ; le président peut retravailler le brouillon.',
          '/jeu/federations/' || lower(v_country_code) || '?onglet=races',
          'Voir le résultat',
          'federation-race:' || v_project.id::text || ':vote:' || v_project.vote_round::text
            || ':rejected:' || v_member.team_id::text,
          true, now()
        );
      end loop;
    end if;
  end loop;
  return jsonb_build_object('approved', v_approved, 'rejected', v_rejected);
end;
$$;

create or replace function public.cancel_national_federation_race(
  p_country_code text,
  p_project_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_project public.national_federation_race_projects%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  select * into v_project from public.national_federation_race_projects
  where id = p_project_id and country_id = v_identity.country_id for update;
  if v_project.id is null or v_project.status not in ('scheduled', 'active') then
    raise exception 'Cette course ne peut pas être annulée.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then raise exception 'Seul le président élu peut annuler une course fédérale.'; end if;
  if exists (
    select 1 from public.race_editions as edition
    where edition.race_id = v_project.race_id and edition.status = 'in_progress'
  ) then raise exception 'Une édition en cours ne peut pas être annulée.'; end if;

  update public.national_federation_race_projects
  set status = 'cancelled', updated_at = now() where id = v_project.id;
  update public.races set status = 'discontinued' where id = v_project.race_id;
  update public.race_editions set status = 'cancelled'
  where race_id = v_project.race_id
    and status in ('planned', 'registration_open', 'registration_closed');
  update public.stages set status = 'cancelled'
  where race_edition_id in (
    select edition.id from public.race_editions as edition
    where edition.race_id = v_project.race_id and edition.status = 'cancelled'
  ) and status = 'planned';
  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_project.country_id, v_season.id, v_season.current_day_number,
    'governance', 'Course fédérale arrêtée',
    v_project.name || ' ne sera plus reconduite. Les frais déjà engagés ne sont pas remboursés.',
    'federation-race:' || v_project.id::text || ':cancelled'
  ) on conflict (source_reference) do nothing;
  return v_project.id;
end;
$$;

revoke execute on function public.create_national_federation_race(
  text, text, text, text, text, integer, text, jsonb
) from authenticated;
revoke all on function private.get_national_federation_race_costs(text, integer),
  private.validate_national_federation_race_blueprint(uuid, uuid, text, text, integer, text, jsonb),
  private.materialize_national_federation_race(uuid),
  private.prevent_cancelled_federation_race_edition(),
  private.preserve_federation_race_stage_schedule()
from public, anon, authenticated;
revoke all on function public.save_national_federation_race_draft(
  text, text, text, text, text, integer, text, jsonb
), public.submit_national_federation_race_vote(text, uuid),
  public.vote_national_federation_race(text, uuid, text),
  public.cancel_national_federation_race(text, uuid)
from public, anon;
grant execute on function public.save_national_federation_race_draft(
  text, text, text, text, text, integer, text, jsonb
) to authenticated, service_role;
grant execute on function public.submit_national_federation_race_vote(text, uuid),
  public.vote_national_federation_race(text, uuid, text),
  public.cancel_national_federation_race(text, uuid)
to authenticated, service_role;
revoke all on function public.settle_due_national_federation_race_votes(),
  public.settle_due_national_federation_race_maintenance()
from public, anon, authenticated;
grant execute on function public.settle_due_national_federation_race_votes(),
  public.settle_due_national_federation_race_maintenance()
to service_role;

comment on table public.national_federation_race_projects is
  'Brouillons, votes et courses fédérales permanentes, créés une fois par fédération et par saison.';
comment on function public.save_national_federation_race_draft(text, text, text, text, text, integer, text, jsonb) is
  'Enregistre sans frais un brouillon contrôlé sur le calendrier de la saison suivante.';
comment on function public.submit_national_federation_race_vote(text, uuid) is
  'Réserve les coûts du projet et ouvre le vote des membres pendant exactement 24 heures.';

notify pgrst, 'reload schema';

commit;
