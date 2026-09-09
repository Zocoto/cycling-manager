begin;

create table public.national_federation_sponsor_creation_jobs (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  requested_season_id uuid not null references public.seasons(id) on delete restrict,
  requested_game_year integer not null,
  requested_by_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  status text not null default 'pending',
  sponsor_id uuid references public.sponsors(id) on delete restrict,
  sponsor_catalog_key text,
  sponsor_name text,
  failure_reason text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint national_federation_sponsor_jobs_year_valid check (
    requested_game_year >= 3
  ),
  constraint national_federation_sponsor_jobs_status_allowed check (
    status in ('pending', 'in_progress', 'completed', 'failed')
  ),
  constraint national_federation_sponsor_jobs_result_consistent check (
    (
      status = 'completed'
      and sponsor_id is not null
      and btrim(coalesce(sponsor_catalog_key, '')) <> ''
      and btrim(coalesce(sponsor_name, '')) <> ''
      and completed_at is not null
    )
    or (
      status <> 'completed'
      and sponsor_id is null
      and sponsor_catalog_key is null
      and sponsor_name is null
      and completed_at is null
    )
  ),
  constraint national_federation_sponsor_jobs_country_season_unique
    unique (country_id, requested_season_id)
);

create index national_federation_sponsor_jobs_work_queue_idx
  on public.national_federation_sponsor_creation_jobs (
    status, requested_at, id
  ) where status in ('pending', 'failed');
create index national_federation_sponsor_jobs_country_history_idx
  on public.national_federation_sponsor_creation_jobs (
    country_id, requested_game_year desc, requested_at desc
  );

alter table public.national_federation_sponsor_creation_jobs
  enable row level security;
create policy national_federation_sponsor_jobs_select_authenticated
on public.national_federation_sponsor_creation_jobs
for select to authenticated using (true);
grant select on table public.national_federation_sponsor_creation_jobs
  to authenticated;
grant all on table public.national_federation_sponsor_creation_jobs
  to service_role;

create or replace function public.request_national_federation_sponsor_creation(
  p_country_code text
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
  v_job_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;

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
    raise exception 'La prospection de sponsors sera disponible à partir de la Saison 3.';
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
    raise exception 'Seul le président élu peut lancer cette prospection.';
  end if;

  if coalesce((
    select infrastructure.level
    from public.national_federation_infrastructures as infrastructure
    where infrastructure.country_id = v_identity.country_id
      and infrastructure.infrastructure_code = 'race_organization_office'
  ), 0) < 5 then
    raise exception 'Le Bureau d’organisation doit atteindre le niveau 5.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_identity.country_id::text || ':federation-sponsor:' || v_season.id::text,
      0
    )
  );

  if exists (
    select 1
    from public.national_federation_sponsor_creation_jobs as job
    where job.country_id = v_identity.country_id
      and job.requested_season_id = v_season.id
  ) then
    raise exception 'La fédération a déjà lancé sa prospection sponsor cette saison.';
  end if;

  insert into public.national_federation_sponsor_creation_jobs (
    country_id,
    requested_season_id,
    requested_game_year,
    requested_by_director_id
  ) values (
    v_identity.country_id,
    v_season.id,
    v_season.game_year,
    v_identity.sporting_director_id
  ) returning id into v_job_id;

  insert into public.national_federation_journal_entries (
    country_id,
    season_id,
    day_number,
    category,
    title,
    detail,
    source_reference,
    metadata
  ) values (
    v_identity.country_id,
    v_season.id,
    v_season.current_day_number,
    'infrastructure',
    'Prospection d’un sponsor national lancée',
    'Le Bureau d’organisation recherche un nouveau partenaire appelé à rejoindre durablement le cyclisme professionnel du pays.',
    'federation-sponsor-job:' || v_job_id::text || ':request',
    jsonb_build_object(
      'jobId', v_job_id,
      'gameYear', v_season.game_year,
      'infrastructureCode', 'race_organization_office'
    )
  );

  return v_job_id;
end;
$$;

create or replace function public.claim_national_federation_sponsor_creation_job(
  p_job_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_job public.national_federation_sponsor_creation_jobs%rowtype;
  v_country public.countries%rowtype;
begin
  if p_job_id is null then
    select * into v_job
    from public.national_federation_sponsor_creation_jobs as job
    where job.status in ('pending', 'failed')
    order by job.requested_at, job.id
    limit 1
    for update skip locked;
  else
    select * into v_job
    from public.national_federation_sponsor_creation_jobs as job
    where job.id = p_job_id
    for update;
  end if;

  if v_job.id is null then
    raise exception 'Aucune demande sponsor disponible.';
  end if;
  if v_job.status = 'completed' then
    raise exception 'Cette demande sponsor est déjà terminée.';
  end if;
  if v_job.status not in ('pending', 'failed', 'in_progress') then
    raise exception 'Cette demande sponsor ne peut pas être prise en charge.';
  end if;

  if v_job.status <> 'in_progress' then
    update public.national_federation_sponsor_creation_jobs
    set status = 'in_progress',
        started_at = now(),
        failure_reason = null,
        updated_at = now()
    where id = v_job.id
    returning * into v_job;
  end if;

  select * into v_country
  from public.countries
  where id = v_job.country_id;

  return jsonb_build_object(
    'jobId', v_job.id,
    'countryId', v_job.country_id,
    'countryCode', v_country.iso_alpha2,
    'countryName', v_country.name,
    'gameYear', v_job.requested_game_year,
    'status', v_job.status,
    'requestedAt', v_job.requested_at,
    'startedAt', v_job.started_at
  );
end;
$$;

create or replace function public.complete_national_federation_sponsor_creation_job(
  p_job_id uuid,
  p_sponsor_catalog_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_job public.national_federation_sponsor_creation_jobs%rowtype;
  v_sponsor public.sponsors%rowtype;
  v_current_season public.seasons%rowtype;
begin
  select * into v_job
  from public.national_federation_sponsor_creation_jobs
  where id = p_job_id
  for update;
  if v_job.id is null then
    raise exception 'Cette demande sponsor n’existe pas.';
  end if;

  select * into v_sponsor
  from public.sponsors
  where catalog_key = lower(btrim(coalesce(p_sponsor_catalog_key, '')))
  limit 1;
  if v_sponsor.id is null then
    raise exception 'Le sponsor doit être synchronisé dans le registre avant publication.';
  end if;
  if v_sponsor.country_id <> v_job.country_id then
    raise exception 'Le sponsor synchronisé n’appartient pas au pays demandé.';
  end if;

  if v_job.status = 'completed' then
    if v_job.sponsor_id <> v_sponsor.id then
      raise exception 'Cette demande est déjà associée à un autre sponsor.';
    end if;
  elsif v_job.status <> 'in_progress' then
    raise exception 'La demande doit être prise en charge avant sa publication.';
  else
    update public.national_federation_sponsor_creation_jobs
    set status = 'completed',
        sponsor_id = v_sponsor.id,
        sponsor_catalog_key = v_sponsor.catalog_key,
        sponsor_name = v_sponsor.name,
        failure_reason = null,
        completed_at = now(),
        updated_at = now()
    where id = v_job.id
    returning * into v_job;

    select * into v_current_season
    from public.seasons
    where status = 'active'
    limit 1;

    insert into public.national_federation_journal_entries (
      country_id,
      season_id,
      day_number,
      category,
      title,
      detail,
      source_reference,
      metadata
    ) values (
      v_job.country_id,
      coalesce(v_current_season.id, v_job.requested_season_id),
      v_current_season.current_day_number,
      'infrastructure',
      'Nouveau sponsor national',
      v_sponsor.name || ' rejoint durablement le catalogue des partenaires du pays.',
      'federation-sponsor-job:' || v_job.id::text || ':completed',
      jsonb_build_object(
        'jobId', v_job.id,
        'sponsorId', v_sponsor.id,
        'sponsorCatalogKey', v_sponsor.catalog_key,
        'sponsorName', v_sponsor.name
      )
    ) on conflict (source_reference) do nothing;
  end if;

  return jsonb_build_object(
    'jobId', v_job.id,
    'status', v_job.status,
    'sponsorCatalogKey', v_job.sponsor_catalog_key,
    'sponsorName', v_job.sponsor_name
  );
end;
$$;

create or replace function public.fail_national_federation_sponsor_creation_job(
  p_job_id uuid,
  p_failure_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
begin
  if btrim(coalesce(p_failure_reason, '')) = '' then
    raise exception 'Le motif d’échec est obligatoire.';
  end if;

  update public.national_federation_sponsor_creation_jobs
  set status = 'failed',
      failure_reason = left(btrim(p_failure_reason), 500),
      updated_at = now()
  where id = p_job_id
    and status = 'in_progress';

  if not found then
    raise exception 'Aucune demande en cours ne correspond à cet identifiant.';
  end if;
end;
$$;

revoke all on function public.request_national_federation_sponsor_creation(text)
  from public, anon;
revoke all on function public.claim_national_federation_sponsor_creation_job(uuid)
  from public, anon, authenticated;
revoke all on function public.complete_national_federation_sponsor_creation_job(uuid, text)
  from public, anon, authenticated;
revoke all on function public.fail_national_federation_sponsor_creation_job(uuid, text)
  from public, anon, authenticated;
grant execute on function public.request_national_federation_sponsor_creation(text)
  to authenticated, service_role;
grant execute on function public.claim_national_federation_sponsor_creation_job(uuid)
  to service_role;
grant execute on function public.complete_national_federation_sponsor_creation_job(uuid, text)
  to service_role;
grant execute on function public.fail_national_federation_sponsor_creation_job(uuid, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
