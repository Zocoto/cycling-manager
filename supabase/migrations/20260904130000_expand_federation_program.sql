begin;

-- Le mode automatique est la sécurité par défaut, y compris avec un président.
create table public.national_federation_selection_preferences (
  country_id uuid not null references public.countries(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  automatic_selection boolean not null default true,
  updated_by_director_id uuid
    references public.sporting_directors(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (country_id, season_id)
);

alter table public.national_federation_selection_preferences
  enable row level security;
create policy national_federation_selection_preferences_read_authenticated
on public.national_federation_selection_preferences
for select to authenticated using (true);
grant select on table public.national_federation_selection_preferences
  to authenticated;
grant all on table public.national_federation_selection_preferences
  to service_role;

create or replace function public.set_national_federation_selection_mode(
  p_country_code text,
  p_automatic_selection boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;
  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null or v_season.game_year < 3 then
    raise exception 'Le mode de sélection sera disponible en Saison 3.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut modifier ce mode.';
  end if;

  insert into public.national_federation_selection_preferences (
    country_id, season_id, automatic_selection,
    updated_by_director_id, updated_at
  ) values (
    v_identity.country_id, v_season.id, p_automatic_selection,
    v_identity.sporting_director_id, now()
  ) on conflict (country_id, season_id) do update set
    automatic_selection = excluded.automatic_selection,
    updated_by_director_id = excluded.updated_by_director_id,
    updated_at = now();

  if p_automatic_selection then
    update public.race_rosters as roster
    set status = 'withdrawn'
    where roster.race_registration_id in (
      select link.race_registration_id
      from public.national_federation_selection_race_links as link
      join public.national_federation_selection_lists as selection_list
        on selection_list.id = link.selection_list_id
      join public.national_federation_selection_slots as slot
        on slot.slot_key = selection_list.slot_key
      where selection_list.country_id = v_identity.country_id
        and selection_list.season_id = v_season.id
        and slot.day_number > v_season.current_day_number
    ) and roster.status in ('selected', 'confirmed');

    update public.race_registrations as registration
    set status = 'withdrawn', decided_at = now()
    where registration.id in (
      select link.race_registration_id
      from public.national_federation_selection_race_links as link
      join public.national_federation_selection_lists as selection_list
        on selection_list.id = link.selection_list_id
      join public.national_federation_selection_slots as slot
        on slot.slot_key = selection_list.slot_key
      where selection_list.country_id = v_identity.country_id
        and selection_list.season_id = v_season.id
        and slot.day_number > v_season.current_day_number
    );

    update public.national_federation_junior_race_registrations as registration
    set status = 'withdrawn', synced_at = now()
    where registration.country_id = v_identity.country_id
      and registration.selection_list_id in (
        select selection_list.id
        from public.national_federation_selection_lists as selection_list
        join public.national_federation_selection_slots as slot
          on slot.slot_key = selection_list.slot_key
        where selection_list.country_id = v_identity.country_id
          and selection_list.season_id = v_season.id
          and slot.day_number > v_season.current_day_number
      );

    update public.national_federation_selection_lists as selection_list
    set status = 'draft', published_at = null,
        created_by_director_id = null, updated_at = now()
    from public.national_federation_selection_slots as slot
    where slot.slot_key = selection_list.slot_key
      and selection_list.country_id = v_identity.country_id
      and selection_list.season_id = v_season.id
      and slot.day_number > v_season.current_day_number;
    update public.national_federation_selection_members as member
    set response_status = 'draft', responded_at = null
    where member.selection_list_id in (
      select selection_list.id
      from public.national_federation_selection_lists as selection_list
      join public.national_federation_selection_slots as slot
        on slot.slot_key = selection_list.slot_key
      where selection_list.country_id = v_identity.country_id
        and selection_list.season_id = v_season.id
        and slot.day_number > v_season.current_day_number
    );
  end if;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number,
    'selection', 'Mode de sélection modifié',
    case when p_automatic_selection
      then 'La sélection automatique est active et sécurise toutes les échéances.'
      else 'Le président prend la main sur les listes internationales.' end,
    'federation-selection-mode:' || v_identity.country_id::text || ':'
      || v_season.id::text || ':' || extract(epoch from now())::bigint::text
  );
  return p_automatic_selection;
end;
$$;

revoke all on function public.set_national_federation_selection_mode(text, boolean)
  from public, anon;
grant execute on function public.set_national_federation_selection_mode(text, boolean)
  to authenticated, service_role;

alter table public.national_federation_selection_lists
  alter column created_by_director_id drop not null;

create or replace function public.enforce_manual_federation_selection_mode()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.created_by_director_id is not null and coalesce((
    select preference.automatic_selection
    from public.national_federation_selection_preferences as preference
    where preference.country_id = new.country_id
      and preference.season_id = new.season_id
  ), true) then
    raise exception
      'Désactivez la sélection automatique avant de modifier une liste.';
  end if;
  return new;
end;
$$;

create trigger enforce_manual_federation_selection_mode
before insert or update
on public.national_federation_selection_lists
for each row execute function public.enforce_manual_federation_selection_mode();

revoke all on function public.enforce_manual_federation_selection_mode()
  from public, anon, authenticated;

create or replace function public.ensure_automatic_federation_junior_lineups(
  p_race_edition_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_edition public.development_race_editions%rowtype;
  v_season public.seasons%rowtype;
  v_slot_key text;
  v_country record;
  v_list_id uuid;
  v_selected integer := 0;
  v_total integer := 0;
begin
  select * into v_edition
  from public.development_race_editions
  where id = p_race_edition_id;
  if v_edition.id is null or v_edition.competition_type not in (
    'continental_road', 'continental_time_trial',
    'world_road', 'world_time_trial', 'nations_cup_junior'
  ) then return 0; end if;
  select * into v_season from public.seasons where id = v_edition.season_id;
  if v_season.game_year < 3 then return 0; end if;

  v_slot_key := case v_edition.competition_type
    when 'continental_road' then 'cc-junior-road'
    when 'continental_time_trial' then 'cc-junior-itt'
    when 'world_road' then 'world-junior-road'
    when 'world_time_trial' then 'world-junior-itt'
    else 'nc-junior-road' end;

  for v_country in
    select distinct country.id
    from public.countries as country
    join public.youth_academy_riders as academy
      on academy.country_id = country.id
     and academy.status in ('active', 'recruited')
     and v_season.game_year - academy.birth_game_year between 16 and 18
    left join public.national_federation_selection_preferences as preference
      on preference.country_id = country.id
     and preference.season_id = v_season.id
    where country.is_active = true
      and coalesce(preference.automatic_selection, true)
      and (
        v_edition.competition_type not in (
          'continental_road', 'continental_time_trial'
        ) or country.continent_code = v_edition.championship_continent_code
      )
  loop
    insert into public.national_federation_selection_lists (
      country_id, season_id, slot_key, status, revision,
      created_by_director_id, published_at, updated_at
    ) values (
      v_country.id, v_season.id, v_slot_key, 'finalized', 1,
      null, now(), now()
    ) on conflict (country_id, season_id, slot_key) do update set
      status = 'finalized',
      revision = public.national_federation_selection_lists.revision + 1,
      created_by_director_id = null,
      published_at = now(),
      updated_at = now()
    returning id into v_list_id;

    delete from public.national_federation_selection_members
    where selection_list_id = v_list_id;
    insert into public.national_federation_selection_members (
      selection_list_id, junior_rider_id, owner_team_id,
      owner_director_id, response_status, responded_at
    )
    select
      v_list_id, academy.id, academy.team_id,
      owner_assignment.sporting_director_id, 'confirmed', now()
    from public.youth_academy_riders as academy
    left join lateral (
      select assignment.sporting_director_id
      from public.team_manager_assignments as assignment
      where assignment.team_id = academy.team_id
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
      order by assignment.created_at desc, assignment.id desc
      limit 1
    ) as owner_assignment on true
    where academy.country_id = v_country.id
      and academy.status in ('active', 'recruited')
      and v_season.game_year - academy.birth_game_year between 16 and 18
    order by
      case when v_edition.profile_type = 'time_trial'
        then academy.time_trial * .52 + academy.prologue * .18
          + academy.flat * .15 + academy.endurance * .15
        else academy.hills * .25 + academy.mountain * .20
          + academy.flat * .16 + academy.sprint * .14
          + academy.endurance * .15 + academy.resistance * .10 end desc,
      academy.id
    limit v_edition.selection_maximum;
    get diagnostics v_selected = row_count;
    v_total := v_total + v_selected;
    perform public.sync_national_federation_junior_lineup(v_list_id);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.ensure_automatic_federation_junior_lineups(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_automatic_federation_junior_lineups(uuid)
  to service_role;

create or replace function public.prepare_due_automatic_federation_junior_lineups()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_season public.seasons%rowtype;
  v_edition record;
  v_selected integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;

  perform public.ensure_federation_junior_championship_calendar(v_season.id);
  for v_edition in
    select edition.id
    from public.development_race_editions as edition
    where edition.season_id = v_season.id
      and edition.status = 'planned'
      and edition.start_day_number between v_season.current_day_number
        and v_season.current_day_number + 3
      and edition.competition_type in (
        'continental_road', 'continental_time_trial',
        'world_road', 'world_time_trial', 'nations_cup_junior'
      )
    order by edition.start_day_number, edition.id
  loop
    v_selected := v_selected
      + public.ensure_automatic_federation_junior_lineups(v_edition.id);
  end loop;
  return v_selected;
end;
$$;

revoke all on function public.prepare_due_automatic_federation_junior_lineups()
  from public, anon, authenticated;
grant execute on function public.prepare_due_automatic_federation_junior_lineups()
  to service_role;

-- Une composition unique est stockée pour la saison suivante. Le maillot actif
-- n'est promu qu'au changement de saison.
alter table public.national_federation_jerseys
  add column active_from_game_year integer,
  add column pending_design jsonb,
  add column pending_version integer,
  add column pending_published_by uuid
    references public.sporting_directors(id) on delete set null,
  add column pending_published_at timestamptz,
  add column pending_activation_game_year integer;

update public.national_federation_jerseys
set active_from_game_year = coalesce(
  (select max(season.game_year) from public.seasons as season
   where season.status = 'active'),
  1
)
where active_from_game_year is null;

alter table public.national_federation_jerseys
  add constraint national_federation_jerseys_pending_shape check (
    (pending_design is null and pending_version is null
      and pending_published_by is null and pending_published_at is null
      and pending_activation_game_year is null)
    or
    (jsonb_typeof(pending_design) = 'object' and pending_version > 0
      and pending_published_by is not null and pending_published_at is not null
      and pending_activation_game_year > 0
      and octet_length(pending_design::text) <= 20000)
  );

drop function public.publish_national_federation_jersey(text, jsonb);

create or replace function public.publish_national_federation_jersey(
  p_country_code text,
  p_design jsonb
)
returns table (
  version integer,
  published_at timestamptz,
  activation_game_year integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_country_id uuid;
  v_director_id uuid;
  v_game_year integer;
  v_version integer;
  v_published_at timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour composer un maillot national.';
  end if;
  if upper(btrim(coalesce(p_country_code, ''))) <> 'BE' then
    raise exception 'La composition est limitée à la fédération belge pendant la bêta.';
  end if;
  if p_design is null or jsonb_typeof(p_design) <> 'object'
     or octet_length(p_design::text) > 20000
     or coalesce(p_design ->> 'schemaVersion', '') <> '2'
     or jsonb_typeof(p_design -> 'elements') <> 'array'
     or jsonb_array_length(p_design -> 'elements') > 16
     or coalesce(p_design ->> 'baseColor', '') !~ '^#[0-9A-F]{6}$' then
    raise exception 'Le maillot transmis est invalide.';
  end if;

  select identity.country_id, identity.sporting_director_id
  into v_country_id, v_director_id
  from public.get_current_federation_identity(p_country_code) as identity;
  select season.game_year into v_game_year
  from public.seasons as season where season.status = 'active' limit 1;
  if v_country_id is null or v_director_id is null or v_game_year is null then
    raise exception 'Seule une équipe affiliée peut composer ce maillot.';
  end if;
  activation_game_year := v_game_year + 1;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_country_id::text || ':federation-jersey', 0)
  );
  select greatest(version, coalesce(pending_version, 0)) + 1
  into v_version
  from public.national_federation_jerseys
  where country_id = v_country_id for update;
  v_version := coalesce(v_version, 1);

  insert into public.national_federation_jerseys (
    country_id, design, version, published_by, published_at,
    active_from_game_year, pending_design, pending_version,
    pending_published_by, pending_published_at,
    pending_activation_game_year, updated_at
  ) values (
    v_country_id, p_design, v_version, v_director_id, v_published_at,
    null, p_design, v_version, v_director_id, v_published_at,
    activation_game_year, now()
  ) on conflict (country_id) do update set
    pending_design = excluded.pending_design,
    pending_version = excluded.pending_version,
    pending_published_by = excluded.pending_published_by,
    pending_published_at = excluded.pending_published_at,
    pending_activation_game_year = excluded.pending_activation_game_year,
    updated_at = now();

  insert into public.national_federation_jersey_history (
    country_id, version, design, published_by, published_at
  ) values (
    v_country_id, v_version, p_design, v_director_id, v_published_at
  );

  version := v_version;
  published_at := v_published_at;
  return next;
end;
$$;

revoke all on function public.publish_national_federation_jersey(text, jsonb)
  from public, anon;
grant execute on function public.publish_national_federation_jersey(text, jsonb)
  to authenticated, service_role;

create or replace function public.activate_due_national_federation_jerseys()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_game_year integer;
  v_activated integer := 0;
begin
  select season.game_year into v_game_year
  from public.seasons as season where season.status = 'active' limit 1;
  if v_game_year is null then return 0; end if;

  update public.national_federation_jerseys
  set design = pending_design,
      version = pending_version,
      published_by = pending_published_by,
      published_at = pending_published_at,
      active_from_game_year = pending_activation_game_year,
      pending_design = null,
      pending_version = null,
      pending_published_by = null,
      pending_published_at = null,
      pending_activation_game_year = null,
      updated_at = now()
  where pending_design is not null
    and pending_activation_game_year <= v_game_year;
  get diagnostics v_activated = row_count;
  return v_activated;
end;
$$;

create or replace function public.activate_federation_jerseys_on_season_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.activate_due_national_federation_jerseys();
  return null;
end;
$$;

create trigger activate_federation_jerseys_on_season_change
after insert or update of status on public.seasons
for each statement execute function public.activate_federation_jerseys_on_season_change();

revoke all on function public.activate_due_national_federation_jerseys()
  from public, anon, authenticated;
grant execute on function public.activate_due_national_federation_jerseys()
  to service_role;

-- Les devis sont rééchelonnés pour des ouvrages nationaux : coûts doublés
-- environ et délais qui se comptent désormais en semaines de jeu.
do $$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.start_national_federation_infrastructure_project(text,text,text)'::regprocedure
  ) into v_definition;
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[450000,\\s*800000,\\s*1300000,\\s*2000000,\\s*2900000\\]',
    'array[900000,1700000,2800000,4400000,6400000]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[500000,\\s*900000,\\s*1450000,\\s*2150000,\\s*3100000\\]',
    'array[1000000,1900000,3100000,4700000,6800000]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[700000,\\s*1200000,\\s*1900000,\\s*2800000,\\s*4000000\\]',
    'array[1400000,2500000,4000000,6000000,8500000]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[400000,\\s*750000,\\s*1200000,\\s*1850000,\\s*2650000\\]',
    'array[800000,1550000,2600000,4000000,5800000]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[550000,\\s*950000,\\s*1500000,\\s*2250000,\\s*3250000\\]',
    'array[1100000,2000000,3200000,4800000,7000000]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[750000,\\s*1300000,\\s*2050000,\\s*3000000,\\s*4300000\\]',
    'array[1500000,2700000,4400000,6500000,9300000]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[450000,\\s*850000,\\s*1400000,\\s*2100000,\\s*3000000\\]',
    'array[900000,1800000,3000000,4600000,6600000]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[600000,\\s*1050000,\\s*1650000,\\s*2450000,\\s*3500000\\]',
    'array[1200000,2200000,3500000,5300000,7600000]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[350000,\\s*650000,\\s*1050000,\\s*1600000,\\s*2300000\\]',
    'array[700000,1350000,2250000,3500000,5000000]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[4,\\s*6,\\s*8,\\s*10,\\s*12\\]',
    'array[10,14,18,23,28]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[5,\\s*6,\\s*8,\\s*10,\\s*12\\]',
    'array[12,16,21,26,32]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[5,\\s*7,\\s*9,\\s*11,\\s*13\\]',
    'array[14,19,24,30,36]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[4,\\s*5,\\s*7,\\s*9,\\s*11\\]',
    'array[10,14,19,24,30]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[5,\\s*7,\\s*9,\\s*11,\\s*14\\]',
    'array[14,19,25,31,38]', 'gi');
  v_definition := pg_catalog.regexp_replace(v_definition,
    E'array\\[3,\\s*5,\\s*7,\\s*9,\\s*11\\]',
    'array[9,13,18,23,28]', 'gi');
  v_definition := replace(v_definition,
    'array[450000,800000,1300000,2000000,2900000]',
    'array[900000,1700000,2800000,4400000,6400000]');
  v_definition := replace(v_definition,
    'array[4,6,8,10,12]', 'array[10,14,18,23,28]');
  v_definition := replace(v_definition,
    'array[500000,900000,1450000,2150000,3100000]',
    'array[1000000,1900000,3100000,4700000,6800000]');
  v_definition := replace(v_definition,
    'array[5,6,8,10,12]', 'array[12,16,21,26,32]');
  v_definition := replace(v_definition,
    'array[700000,1200000,1900000,2800000,4000000]',
    'array[1400000,2500000,4000000,6000000,8500000]');
  v_definition := replace(v_definition,
    'array[5,7,9,11,13]', 'array[14,19,24,30,36]');
  v_definition := replace(v_definition,
    'array[5,7,9,11,14]', 'array[14,19,25,31,38]');
  v_definition := replace(v_definition,
    'array[400000,750000,1200000,1850000,2650000]',
    'array[800000,1550000,2600000,4000000,5800000]');
  v_definition := replace(v_definition,
    'array[4,5,7,9,11]', 'array[10,14,19,24,30]');
  v_definition := replace(v_definition,
    'array[550000,950000,1500000,2250000,3250000]',
    'array[1100000,2000000,3200000,4800000,7000000]');
  v_definition := replace(v_definition,
    'array[750000,1300000,2050000,3000000,4300000]',
    'array[1500000,2700000,4400000,6500000,9300000]');
  v_definition := replace(v_definition,
    'array[450000,850000,1400000,2100000,3000000]',
    'array[900000,1800000,3000000,4600000,6600000]');
  v_definition := replace(v_definition,
    'array[600000,1050000,1650000,2450000,3500000]',
    'array[1200000,2200000,3500000,5300000,7600000]');
  v_definition := replace(v_definition,
    'array[350000,650000,1050000,1600000,2300000]',
    'array[700000,1350000,2250000,3500000,5000000]');
  v_definition := replace(v_definition,
    'array[3,5,7,9,11]', 'array[9,13,18,23,28]');
  execute v_definition;
end;
$$;

create or replace function public.recalculate_national_federation_project(
  p_project_id uuid,
  p_allow_partial_debit boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_project public.national_federation_infrastructure_projects%rowtype;
  v_season public.seasons%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_architect_count integer;
  v_cost_rate numeric;
  v_duration_rate numeric;
  v_new_cost numeric;
  v_new_duration integer;
  v_balance_change numeric;
  v_applied_change numeric;
  v_current_game_day integer;
begin
  select * into v_project
  from public.national_federation_infrastructure_projects
  where id = p_project_id and status = 'active' for update;
  if v_project.id is null then return '{}'::jsonb; end if;
  select * into v_season from public.seasons where status = 'active' limit 1;
  select * into v_account
  from public.national_federation_accounts
  where country_id = v_project.country_id and season_id = v_season.id
  for update;

  select count(*)::integer into v_architect_count
  from public.national_federation_project_architects
  where project_id = v_project.id;
  v_cost_rate := case v_project.priority
    when 'cost' then .04 * v_architect_count
    when 'balanced' then .02 * v_architect_count else 0 end;
  v_duration_rate := case v_project.priority
    when 'time' then .06 * v_architect_count
    when 'balanced' then .03 * v_architect_count else 0 end;
  v_new_cost := round((v_project.base_cost * (1 - v_cost_rate)) / 5000) * 5000;
  v_new_duration := greatest(
    1,
    ceil(v_project.base_duration_days * (1 - v_duration_rate))::integer
  );
  v_balance_change := v_project.final_cost - v_new_cost;
  v_applied_change := v_balance_change;
  if v_balance_change < 0
     and coalesce(v_account.balance, 0) < -v_balance_change then
    if not p_allow_partial_debit then
      raise exception 'La trésorerie ne permet pas ce changement de priorité.';
    end if;
    v_applied_change := -coalesce(v_account.balance, 0);
  end if;

  if v_account.id is not null and v_applied_change <> 0 then
    update public.national_federation_accounts
    set balance = balance + v_applied_change, updated_at = now()
    where id = v_account.id;
    insert into public.national_federation_transactions (
      account_id, day_number, amount, category, description,
      source_reference, metadata
    ) values (
      v_account.id, v_season.current_day_number, v_applied_change,
      case when v_applied_change > 0 then 'refund' else 'infrastructure' end,
      case when v_applied_change > 0
        then 'Réajustement favorable du chantier fédéral'
        else 'Réajustement du chantier après changement d’architecte ou de priorité' end,
      'federation-infrastructure:' || v_project.id::text || ':recalculation:'
        || gen_random_uuid()::text,
      jsonb_build_object('projectId', v_project.id,
        'requestedChange', v_balance_change,
        'appliedChange', v_applied_change)
    );
  end if;

  v_current_game_day := v_season.game_year * 28
    + v_season.current_day_number - 1;
  update public.national_federation_infrastructure_projects
  set final_cost = v_new_cost,
      final_duration_days = v_new_duration,
      completes_game_day_index = greatest(
        v_current_game_day + 1,
        starts_game_day_index + v_new_duration
      ),
      updated_at = now()
  where id = v_project.id;

  update public.national_federation_project_architects
  set cost_refund = case when v_architect_count > 0
        then round((v_project.base_cost - v_new_cost) / v_architect_count, 2)
        else 0 end,
      saved_days = case when v_architect_count > 0
        then floor((v_project.base_duration_days - v_new_duration)::numeric
          / v_architect_count)::integer
        else 0 end
  where project_id = v_project.id;

  return jsonb_build_object(
    'architectCount', v_architect_count,
    'finalCost', v_new_cost,
    'finalDurationDays', v_new_duration,
    'balanceChange', v_applied_change
  );
end;
$$;

create or replace function public.update_national_federation_project_priority(
  p_country_code text,
  p_project_id uuid,
  p_priority text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_project public.national_federation_infrastructure_projects%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  if p_priority not in ('balanced', 'cost', 'time') then
    raise exception 'La priorité du chantier est invalide.';
  end if;
  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  select * into v_project
  from public.national_federation_infrastructure_projects
  where id = p_project_id and status = 'active' for update;
  if v_project.id is null or v_project.country_id <> v_identity.country_id then
    raise exception 'Ce chantier est introuvable.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then raise exception 'Seul le président élu peut modifier la priorité.'; end if;

  update public.national_federation_infrastructure_projects
  set priority = p_priority, updated_at = now()
  where id = v_project.id;
  return public.recalculate_national_federation_project(v_project.id, false);
end;
$$;

create or replace function public.release_federation_architect_on_contract_end()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_contract_id uuid;
  v_project_id uuid;
begin
  v_contract_id := case when tg_op = 'DELETE' then old.id else new.id end;
  if tg_op <> 'DELETE'
     and not (old.status = 'active' and new.status <> 'active') then
    return new;
  end if;

  for v_project_id in
    select distinct contribution.project_id
    from public.national_federation_project_architects as contribution
    join public.national_federation_infrastructure_projects as project
      on project.id = contribution.project_id and project.status = 'active'
    where contribution.staff_contract_id = v_contract_id
  loop
    delete from public.national_federation_project_architects
    where project_id = v_project_id and staff_contract_id = v_contract_id;
    perform public.recalculate_national_federation_project(v_project_id, true);
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger release_federation_architect_after_contract_end
after update of status on public.staff_contracts
for each row execute function public.release_federation_architect_on_contract_end();
create trigger release_federation_architect_before_contract_delete
before delete on public.staff_contracts
for each row execute function public.release_federation_architect_on_contract_end();

revoke all on function public.recalculate_national_federation_project(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.update_national_federation_project_priority(text, uuid, text)
  from public, anon;
grant execute on function public.recalculate_national_federation_project(uuid, boolean)
  to service_role;
grant execute on function public.update_national_federation_project_priority(text, uuid, text)
  to authenticated, service_role;

commit;
