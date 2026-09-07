begin;

-- La fédération sportive d'une équipe reste pilotée par son sponsor principal
-- dans team_seasons.registration_country_id. Ce parcours permet uniquement
-- d'aligner l'identité nationale durable de l'équipe sur cette fédération,
-- après une saison complète et continue d'appartenance.
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
  v_previous_country public.countries%rowtype;
  v_federation_country public.countries%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour changer la nationalité de votre équipe.';
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
    raise exception 'Votre équipe peut uniquement adopter la nationalité de sa fédération actuelle.';
  end if;

  select country.* into v_previous_country
  from public.countries as country
  where country.id = v_team.home_country_id;
  if v_previous_country.id is null then
    raise exception 'La nationalité actuelle de votre équipe est introuvable.';
  end if;
  if v_previous_country.id = v_federation_country.id then
    raise exception 'Votre équipe porte déjà la nationalité sportive de cette fédération.';
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

  if exists (
    select 1
    from public.team_national_affiliation_changes as change
    where change.team_id = v_team.id
      and change.season_id = v_season.id
  ) then
    raise exception 'Le changement de nationalité a déjà été utilisé cette saison.';
  end if;

  update public.teams
  set home_country_id = v_federation_country.id
  where id = v_team.id;

  insert into public.team_national_affiliation_changes (
    team_id, season_id, previous_country_id, new_country_id, changed_by
  ) values (
    v_team.id,
    v_season.id,
    v_previous_country.id,
    v_federation_country.id,
    v_director.id
  );

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference, metadata
  ) values (
    v_federation_country.id,
    v_season.id,
    v_season.current_day_number,
    'system',
    'Nationalité sportive adoptée',
    coalesce(v_team.amateur_name, v_team.internal_name) ||
      ' adopte durablement la nationalité de ' ||
      v_federation_country.name || '.',
    'team-nationality-change:' || v_team.id::text || ':' || v_season.id::text,
    jsonb_build_object(
      'teamId', v_team.id,
      'previousCountryId', v_previous_country.id,
      'newCountryId', v_federation_country.id,
      'federationCountryId', v_federation_country.id
    )
  ) on conflict (source_reference) do nothing;

  return jsonb_build_object(
    'teamId', v_team.id,
    'countryId', v_federation_country.id,
    'countryCode', v_federation_country.iso_alpha2,
    'countryName', v_federation_country.name
  );
end;
$$;

revoke all on function public.change_current_amateur_team_national_affiliation(uuid)
  from public, anon;
grant execute on function public.change_current_amateur_team_national_affiliation(uuid)
  to authenticated, service_role;

comment on function public.change_current_amateur_team_national_affiliation(uuid) is
  'Aligne la nationalité durable d’une équipe amateur sur sa fédération actuelle après une saison complète d’appartenance, sans déplacer son affiliation sportive.';

commit;
