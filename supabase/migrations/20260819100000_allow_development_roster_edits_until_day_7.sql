begin;

create or replace function public.update_current_development_team_roster(
  p_academy_rider_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_development_team public.development_teams%rowtype;
  v_day_number integer;
  v_count integer;
  v_withdrawn_registration_count integer := 0;
begin
  if v_auth_user_id is null then
    raise exception 'Vous devez être authentifié.';
  end if;

  select development_team.*
  into v_development_team
  from public.development_teams as development_team
  join public.seasons as season on season.id = development_team.season_id
  where season.status = 'active'
    and development_team.status = 'active'
    and public.current_user_manages_team(development_team.team_id)
  limit 1
  for update of development_team;

  if v_development_team.id is null then
    raise exception 'Constituez d’abord votre Development Team.';
  end if;

  select coalesce(season.current_day_number, 1)
  into v_day_number
  from public.seasons as season
  where season.id = v_development_team.season_id;

  if v_day_number not between 1 and 7 then
    raise exception 'L’effectif de la Development Team est verrouillé depuis le début de J8.';
  end if;

  v_count := coalesce(array_length(p_academy_rider_ids, 1), 0);
  if v_count < 1 or v_count > 11 then
    raise exception 'Sélectionnez entre 1 et 11 juniors.';
  end if;
  if (
    select count(distinct rider_id)
    from unnest(p_academy_rider_ids) as rider_id
  ) <> v_count then
    raise exception 'Un même junior ne peut pas être sélectionné plusieurs fois.';
  end if;
  if (
    select count(*)
    from public.youth_academy_riders as youth
    where youth.id = any(p_academy_rider_ids)
      and youth.team_id = v_development_team.team_id
      and youth.status in ('active', 'recruited')
  ) <> v_count then
    raise exception 'Un ou plusieurs juniors ne sont pas éligibles.';
  end if;

  delete from public.development_team_roster
  where development_team_id = v_development_team.id;

  insert into public.development_team_roster (
    development_team_id,
    academy_rider_id,
    race_number
  )
  select
    v_development_team.id,
    selected.rider_id,
    row_number() over (
      order by youth.last_name, youth.first_name, youth.id
    )::smallint
  from unnest(p_academy_rider_ids) as selected(rider_id)
  join public.youth_academy_riders as youth on youth.id = selected.rider_id;

  -- Une inscription déjà préparée reste valable si elle conserve le minimum
  -- requis. Les coureurs retirés de l'effectif en sont automatiquement ôtés.
  delete from public.development_race_registration_riders as selected
  using public.development_race_registrations as registration
  where selected.registration_id = registration.id
    and registration.development_team_id = v_development_team.id
    and selected.academy_rider_id <> all(p_academy_rider_ids);

  -- Si le nouvel effectif rend une sélection trop courte, l'inscription est
  -- retirée proprement afin que le DS puisse la recomposer avant le départ.
  with invalid_registrations as (
    select registration.id
    from public.development_race_registrations as registration
    join public.development_race_editions as edition
      on edition.id = registration.race_edition_id
    where registration.development_team_id = v_development_team.id
      and registration.status = 'registered'
      and (
        select count(*)
        from public.development_race_registration_riders as selected
        where selected.registration_id = registration.id
      ) < edition.selection_minimum
  ),
  withdrawn as (
    update public.development_race_registrations as registration
    set status = 'withdrawn', updated_at = now()
    where registration.id in (
      select invalid_registration.id from invalid_registrations as invalid_registration
    )
    returning registration.id
  ),
  cleared_selections as (
    delete from public.development_race_registration_riders as selected
    where selected.registration_id in (
      select withdrawn_registration.id from withdrawn as withdrawn_registration
    )
  )
  select count(*)::integer
  into v_withdrawn_registration_count
  from withdrawn;

  update public.development_teams
  set updated_at = now()
  where id = v_development_team.id;

  return jsonb_build_object(
    'developmentTeamId', v_development_team.id,
    'rosterCount', v_count,
    'withdrawnRegistrationCount', v_withdrawn_registration_count
  );
end;
$$;

revoke all on function public.update_current_development_team_roster(uuid[])
  from public, anon;
grant execute on function public.update_current_development_team_roster(uuid[])
  to authenticated;

comment on function public.update_current_development_team_roster(uuid[]) is
  'Remplace l’effectif de la Development Team active de J1 à J7 inclus, puis le verrouille à partir de J8.';

notify pgrst, 'reload schema';

commit;
