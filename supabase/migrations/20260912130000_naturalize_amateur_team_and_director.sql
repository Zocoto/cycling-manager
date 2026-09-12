begin;

-- Historise séparément la naturalisation du profil du Directeur Sportif.
-- La table d'affiliation de l'équipe conserve sa contrainte historique
-- d'un changement maximum par saison.
create table public.sporting_director_federation_naturalizations (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete restrict,
  previous_country_id uuid references public.countries(id) on delete restrict,
  new_country_id uuid not null references public.countries(id) on delete restrict,
  naturalized_at timestamptz not null default now(),
  constraint sporting_director_federation_naturalization_distinct
    check (
      previous_country_id is null
      or previous_country_id <> new_country_id
    ),
  constraint sporting_director_federation_naturalization_once_per_season
    unique (sporting_director_id, season_id)
);

create index sporting_director_federation_naturalizations_team_idx
  on public.sporting_director_federation_naturalizations (
    team_id,
    season_id,
    naturalized_at desc
  );

alter table public.sporting_director_federation_naturalizations
  enable row level security;

create policy sporting_director_federation_naturalizations_select_own
  on public.sporting_director_federation_naturalizations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sporting_directors as director
      where director.id = sporting_director_id
        and director.auth_user_id = (select auth.uid())
    )
  );

grant select
  on table public.sporting_director_federation_naturalizations
  to authenticated;
grant all
  on table public.sporting_director_federation_naturalizations
  to service_role;

-- Les pays restent immuables depuis les écrans de profil et la Data API.
-- Seule la RPC fédérale contrôlée ouvre une fenêtre transactionnelle étroite.
create or replace function private.prevent_sporting_director_country_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.country_id is not null
    and new.country_id is distinct from old.country_id
    and coalesce(
      pg_catalog.current_setting(
        'app.allow_federation_identity_naturalization',
        true
      ),
      'off'
    ) <> 'on'
  then
    raise exception
      'La nationalité du Directeur Sportif a été validée définitivement.';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_team_home_country_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.home_country_id is distinct from old.home_country_id
    and coalesce(
      pg_catalog.current_setting(
        'app.allow_federation_identity_naturalization',
        true
      ),
      'off'
    ) <> 'on'
  then
    raise exception
      'Le pays d affiliation de l équipe a été validé définitivement.';
  end if;

  return new;
end;
$$;

revoke all
  on function private.prevent_sporting_director_country_change()
  from public, anon, authenticated;
revoke all
  on function private.prevent_team_home_country_change()
  from public, anon, authenticated;

create or replace function public.change_current_amateur_team_national_affiliation(
  p_country_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_director public.sporting_directors%rowtype;
  v_team public.teams%rowtype;
  v_season public.seasons%rowtype;
  v_team_season public.team_seasons%rowtype;
  v_previous_team_country public.countries%rowtype;
  v_federation_country public.countries%rowtype;
  v_team_needs_change boolean;
  v_director_needs_change boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour naturaliser votre structure amateure.';
  end if;

  select director.* into v_director
  from public.sporting_directors as director
  where director.auth_user_id = (select auth.uid())
    and director.status = 'active'
  limit 1;

  select team.* into v_team
  from public.teams as team
  join public.team_manager_assignments as assignment
    on assignment.team_id = team.id
   and assignment.sporting_director_id = v_director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where team.status = 'active'
  limit 1;

  select season.* into v_season
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_director.id is null or v_team.id is null or v_season.id is null then
    raise exception 'Aucune équipe active ne peut être rattachée à votre compte.';
  end if;
  if nullif(btrim(v_team.amateur_name), '') is null then
    raise exception 'Finalisez d’abord l’identité de votre équipe amateur.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_team.id::text || ':national-affiliation', 0)
  );

  -- Recharge les deux identités sous verrou afin que la décision soit atomique.
  select director.* into v_director
  from public.sporting_directors as director
  where director.id = v_director.id
  for update;

  select team.* into v_team
  from public.teams as team
  where team.id = v_team.id
  for update;

  select team_season.* into v_team_season
  from public.team_seasons as team_season
  where team_season.team_id = v_team.id
    and team_season.season_id = v_season.id
    and team_season.status in ('planned', 'active')
  limit 1;
  if v_team_season.id is null then
    raise exception 'La saison sportive de votre équipe est introuvable.';
  end if;

  select country.* into v_federation_country
  from public.countries as country
  where country.id = v_team_season.registration_country_id
    and country.is_active = true;
  if v_federation_country.id is null then
    raise exception 'La fédération actuelle de votre équipe est invalide.';
  end if;
  if p_country_id is distinct from v_federation_country.id then
    raise exception 'Votre structure peut uniquement adopter la nationalité de sa fédération actuelle.';
  end if;

  select country.* into v_previous_team_country
  from public.countries as country
  where country.id = v_team.home_country_id;
  if v_previous_team_country.id is null then
    raise exception 'La nationalité actuelle de votre équipe est introuvable.';
  end if;

  v_team_needs_change :=
    v_team.home_country_id is distinct from v_federation_country.id;
  v_director_needs_change :=
    v_director.country_id is distinct from v_federation_country.id;

  if not v_team_needs_change and not v_director_needs_change then
    raise exception 'Votre équipe amateure et votre entraîneur portent déjà la nationalité sportive de cette fédération.';
  end if;

  if not exists (
    select 1
    from public.team_seasons as previous_team_season
    join public.seasons as previous_season
      on previous_season.id = previous_team_season.season_id
     and previous_season.game_year = v_season.game_year - 1
     and previous_season.status = 'completed'
    where previous_team_season.team_id = v_team.id
      and previous_team_season.registration_country_id = v_federation_country.id
      and previous_team_season.status = 'completed'
  ) then
    raise exception 'Une saison complète au sein de cette fédération est requise avant de pouvoir adopter sa nationalité.';
  end if;

  -- Une ancienne naturalisation de l'équipe ne bloque pas la réparation du
  -- profil DS si celui-ci est encore rattaché à son pays précédent.
  if v_team_needs_change and exists (
    select 1
    from public.team_national_affiliation_changes as change
    where change.team_id = v_team.id
      and change.season_id = v_season.id
  ) then
    raise exception 'Le changement de nationalité de l’équipe a déjà été utilisé cette saison.';
  end if;

  if v_director_needs_change and exists (
    select 1
    from public.sporting_director_federation_naturalizations as naturalization
    where naturalization.sporting_director_id = v_director.id
      and naturalization.season_id = v_season.id
  ) then
    raise exception 'Le changement de nationalité de l’entraîneur a déjà été utilisé cette saison.';
  end if;

  perform pg_catalog.set_config(
    'app.allow_federation_identity_naturalization',
    'on',
    true
  );

  if v_team_needs_change then
    update public.teams
    set home_country_id = v_federation_country.id
    where id = v_team.id
      and home_country_id = v_team.home_country_id;

    if not found then
      raise exception 'La nationalité de l’équipe a changé entre-temps. Rechargez la page.';
    end if;

    insert into public.team_national_affiliation_changes (
      team_id,
      season_id,
      previous_country_id,
      new_country_id,
      changed_by
    ) values (
      v_team.id,
      v_season.id,
      v_previous_team_country.id,
      v_federation_country.id,
      v_director.id
    );
  end if;

  if v_director_needs_change then
    update public.sporting_directors
    set country_id = v_federation_country.id
    where id = v_director.id
      and country_id is not distinct from v_director.country_id;

    if not found then
      raise exception 'La nationalité de l’entraîneur a changé entre-temps. Rechargez la page.';
    end if;

    insert into public.sporting_director_federation_naturalizations (
      sporting_director_id,
      team_id,
      season_id,
      previous_country_id,
      new_country_id
    ) values (
      v_director.id,
      v_team.id,
      v_season.id,
      v_director.country_id,
      v_federation_country.id
    );
  end if;

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
    v_federation_country.id,
    v_season.id,
    v_season.current_day_number,
    'system',
    'Structure amateure naturalisée',
    coalesce(v_team.amateur_name, v_team.internal_name) ||
      ' et son entraîneur adoptent la nationalité de ' ||
      v_federation_country.name || '.',
    'federation-identity-naturalization:' ||
      v_team.id::text || ':' || v_season.id::text,
    jsonb_build_object(
      'teamId', v_team.id,
      'sportingDirectorId', v_director.id,
      'previousTeamCountryId', v_previous_team_country.id,
      'previousDirectorCountryId', v_director.country_id,
      'newCountryId', v_federation_country.id,
      'federationCountryId', v_federation_country.id,
      'teamCountryChanged', v_team_needs_change,
      'trainerCountryChanged', v_director_needs_change
    )
  ) on conflict (source_reference) do nothing;

  return jsonb_build_object(
    'teamId', v_team.id,
    'sportingDirectorId', v_director.id,
    'countryId', v_federation_country.id,
    'countryCode', v_federation_country.iso_alpha2,
    'countryName', v_federation_country.name,
    'teamCountryChanged', v_team_needs_change,
    'trainerCountryChanged', v_director_needs_change
  );
end;
$$;

revoke all
  on function public.change_current_amateur_team_national_affiliation(uuid)
  from public, anon;
grant execute
  on function public.change_current_amateur_team_national_affiliation(uuid)
  to authenticated, service_role;

comment on table public.sporting_director_federation_naturalizations is
  'Historique des naturalisations fédérales du profil entraîneur/Directeur Sportif.';

comment on function public.change_current_amateur_team_national_affiliation(uuid) is
  'Naturalise atomiquement l’équipe amateure et son Directeur Sportif dans leur fédération actuelle après une saison complète, sans modifier l’affiliation sportive.';

commit;
