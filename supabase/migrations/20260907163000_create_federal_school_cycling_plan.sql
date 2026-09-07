begin;

create table public.national_federation_school_cycling_plans (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  started_season_id uuid not null references public.seasons(id) on delete restrict,
  historical_archetype text not null,
  target_archetype text not null,
  cost numeric(14, 2) not null,
  starts_game_day_index integer not null,
  completes_game_day_index integer not null,
  activated_game_year integer,
  launched_by_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  status text not null default 'deploying',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint national_federation_school_plan_historical_allowed check (
    historical_archetype in (
      'climber', 'puncheur', 'stage_racer', 'northern_classics',
      'rouleur', 'breakaway', 'sprinter', 'all_rounder'
    )
  ),
  constraint national_federation_school_plan_target_allowed check (
    target_archetype in (
      'climber', 'puncheur', 'stage_racer', 'northern_classics',
      'rouleur', 'breakaway', 'sprinter', 'all_rounder'
    )
  ),
  constraint national_federation_school_plan_changes_style check (
    target_archetype <> historical_archetype
  ),
  constraint national_federation_school_plan_cost_valid check (cost > 0),
  constraint national_federation_school_plan_duration_valid check (
    completes_game_day_index = starts_game_day_index + 56
  ),
  constraint national_federation_school_plan_status_allowed check (
    status in ('deploying', 'active', 'superseded')
  )
);

create unique index national_federation_school_plan_one_current_idx
  on public.national_federation_school_cycling_plans (country_id)
  where status in ('deploying', 'active');
create index national_federation_school_plan_due_idx
  on public.national_federation_school_cycling_plans (
    completes_game_day_index, created_at
  ) where status = 'deploying';

alter table public.national_federation_school_cycling_plans enable row level security;
create policy national_federation_school_plan_select_authenticated
on public.national_federation_school_cycling_plans
for select to authenticated using (true);
grant select on table public.national_federation_school_cycling_plans
  to authenticated;
grant all on table public.national_federation_school_cycling_plans
  to service_role;

alter table public.youth_scouting_candidates
  add column if not exists historical_archetype text,
  add column if not exists school_plan_archetype text,
  add column if not exists school_plan_transfer_points numeric(4, 1)
    not null default 0,
  add column if not exists archetype_probabilities jsonb;

alter table public.youth_scouting_candidates
  add constraint youth_candidates_historical_archetype_allowed check (
    historical_archetype is null or historical_archetype in (
      'climber', 'puncheur', 'stage_racer', 'northern_classics',
      'rouleur', 'breakaway', 'sprinter', 'all_rounder'
    )
  ),
  add constraint youth_candidates_school_plan_archetype_allowed check (
    school_plan_archetype is null or school_plan_archetype in (
      'climber', 'puncheur', 'stage_racer', 'northern_classics',
      'rouleur', 'breakaway', 'sprinter', 'all_rounder'
    )
  ),
  add constraint youth_candidates_school_plan_transfer_valid check (
    school_plan_transfer_points in (0, 3, 6, 10)
  ),
  add constraint youth_candidates_archetype_probabilities_object check (
    archetype_probabilities is null
    or jsonb_typeof(archetype_probabilities) = 'object'
  );

create or replace function public.get_country_historical_youth_archetype(
  p_country_code text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(btrim(coalesce(p_country_code, ''))) in ('BE', 'NL')
      then 'northern_classics'
    when upper(btrim(coalesce(p_country_code, ''))) in (
      'CO', 'EC', 'BO', 'PE', 'ES', 'IT', 'FR', 'PT',
      'ER', 'ET', 'RW', 'UG', 'KE'
    ) then 'climber'
    when upper(btrim(coalesce(p_country_code, ''))) in (
      'SI', 'HR', 'BA', 'ME', 'CH', 'AT'
    ) then 'stage_racer'
    when upper(btrim(coalesce(p_country_code, ''))) in (
      'GB', 'AU', 'NZ', 'DE', 'DK', 'NO', 'SE', 'FI', 'EE', 'LV', 'LT',
      'US', 'CA', 'ZA', 'NA', 'BW', 'ZW'
    ) then 'rouleur'
    when upper(btrim(coalesce(p_country_code, ''))) in ('JP', 'KR', 'CN')
      then 'sprinter'
    when upper(btrim(coalesce(p_country_code, ''))) in (
      'CZ', 'SK', 'PL', 'HU'
    ) then 'northern_classics'
    when upper(btrim(coalesce(p_country_code, ''))) in ('IE', 'IS')
      then 'breakaway'
    when upper(btrim(coalesce(p_country_code, ''))) in (
      'MA', 'DZ', 'TN', 'TR', 'GR', 'AR', 'UY', 'BR', 'PY', 'CL'
    ) then 'puncheur'
    else 'all_rounder'
  end;
$$;

create or replace function public.settle_due_national_federation_school_plans()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_plan public.national_federation_school_cycling_plans%rowtype;
  v_current_game_day integer;
  v_completed integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;

  if v_season.id is null then return 0; end if;
  v_current_game_day := v_season.game_year * 28
    + coalesce(v_season.current_day_number, 1) - 1;

  for v_plan in
    select *
    from public.national_federation_school_cycling_plans
    where status = 'deploying'
      and completes_game_day_index <= v_current_game_day
    order by completes_game_day_index, created_at
    for update skip locked
  loop
    update public.national_federation_school_cycling_plans
    set status = 'active',
        activated_game_year = floor(v_plan.completes_game_day_index / 28),
        updated_at = now()
    where id = v_plan.id;

    insert into public.national_federation_journal_entries (
      country_id, season_id, day_number, category, title, detail,
      source_reference, metadata
    ) values (
      v_plan.country_id, v_season.id, v_season.current_day_number,
      'infrastructure', 'Plan vélo scolaire déployé',
      'La première promotion bénéficie de 3 points de probabilité vers le profil '
        || v_plan.target_archetype || '.',
      'federation-school-plan:' || v_plan.id::text || ':activated',
      jsonb_build_object(
        'historicalArchetype', v_plan.historical_archetype,
        'targetArchetype', v_plan.target_archetype,
        'transferPoints', 3
      )
    ) on conflict (source_reference) do nothing;

    v_completed := v_completed + 1;
  end loop;

  return v_completed;
end;
$$;

create or replace function public.start_national_federation_school_cycling_plan(
  p_country_code text,
  p_target_archetype text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_historical_archetype text;
  v_current_plan public.national_federation_school_cycling_plans%rowtype;
  v_current_game_day integer;
  v_plan_id uuid;
  v_cost constant numeric := 1500000;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;

  perform public.initialize_due_national_federation_accounts();
  perform public.settle_due_national_federation_school_plans();

  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  if v_identity.country_id is null then
    raise exception 'Votre équipe n’est pas affiliée à cette fédération.';
  end if;

  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;
  if v_season.id is null or v_season.game_year < 3 then
    raise exception 'Le Plan vélo scolaire sera disponible à partir de la Saison 3.';
  end if;

  if not exists (
    select 1
    from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut engager ce programme.';
  end if;

  if coalesce((
    select infrastructure.level
    from public.national_federation_infrastructures as infrastructure
    where infrastructure.country_id = v_identity.country_id
      and infrastructure.infrastructure_code = 'regional_academies'
  ), 0) < 2 then
    raise exception 'Les Académies régionales doivent atteindre le niveau 2.';
  end if;

  if p_target_archetype not in (
    'climber', 'puncheur', 'stage_racer', 'northern_classics',
    'rouleur', 'breakaway', 'sprinter', 'all_rounder'
  ) then
    raise exception 'Le profil de formation choisi est invalide.';
  end if;

  select public.get_country_historical_youth_archetype(country.iso_alpha2)
  into v_historical_archetype
  from public.countries as country
  where country.id = v_identity.country_id;
  if p_target_archetype = v_historical_archetype then
    raise exception 'Le style historique ne peut pas être choisi comme nouvelle orientation.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_identity.country_id::text || ':school-cycling-plan', 0
    )
  );

  select * into v_current_plan
  from public.national_federation_school_cycling_plans
  where country_id = v_identity.country_id
    and status in ('deploying', 'active')
  order by created_at desc
  limit 1
  for update;

  if v_current_plan.id is not null
    and v_current_plan.target_archetype = p_target_archetype then
    raise exception 'Cette orientation est déjà celle du plan en cours.';
  end if;

  select * into v_account
  from public.national_federation_accounts
  where country_id = v_identity.country_id
    and season_id = v_season.id
  for update;
  if v_account.id is null or v_account.balance < v_cost then
    raise exception 'La trésorerie fédérale est insuffisante pour ce programme.';
  end if;

  if v_current_plan.id is not null then
    update public.national_federation_school_cycling_plans
    set status = 'superseded', updated_at = now()
    where id = v_current_plan.id;
  end if;

  v_current_game_day := v_season.game_year * 28
    + coalesce(v_season.current_day_number, 1) - 1;
  insert into public.national_federation_school_cycling_plans (
    country_id, started_season_id, historical_archetype, target_archetype,
    cost, starts_game_day_index, completes_game_day_index,
    launched_by_director_id
  ) values (
    v_identity.country_id, v_season.id, v_historical_archetype,
    p_target_archetype, v_cost, v_current_game_day,
    v_current_game_day + 56, v_identity.sporting_director_id
  ) returning id into v_plan_id;

  update public.national_federation_accounts
  set balance = balance - v_cost, updated_at = now()
  where id = v_account.id;

  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description, source_reference,
    metadata
  ) values (
    v_account.id, v_season.current_day_number, -v_cost, 'infrastructure',
    'Lancement du Plan vélo scolaire vers le profil ' || p_target_archetype,
    'federation-school-plan:' || v_plan_id::text || ':launch',
    jsonb_build_object(
      'historicalArchetype', v_historical_archetype,
      'targetArchetype', p_target_archetype,
      'durationDays', 56
    )
  );

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference, metadata
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number,
    'infrastructure', 'Plan vélo scolaire lancé',
    'Orientation ' || p_target_archetype
      || ' · déploiement sur 56 jours · trois promotions de montée en puissance.',
    'federation-school-plan:' || v_plan_id::text || ':journal',
    jsonb_build_object(
      'historicalArchetype', v_historical_archetype,
      'targetArchetype', p_target_archetype,
      'durationDays', 56
    )
  );

  return v_plan_id;
end;
$$;

revoke all on function public.get_country_historical_youth_archetype(text)
  from public, anon;
revoke all on function public.settle_due_national_federation_school_plans()
  from public, anon, authenticated;
revoke all on function public.start_national_federation_school_cycling_plan(text, text)
  from public, anon;
grant execute on function public.get_country_historical_youth_archetype(text)
  to authenticated, service_role;
grant execute on function public.settle_due_national_federation_school_plans()
  to service_role;
grant execute on function public.start_national_federation_school_cycling_plan(text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
