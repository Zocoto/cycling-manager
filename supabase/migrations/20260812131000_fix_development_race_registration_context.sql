begin;

create or replace function public.register_current_development_race(
  p_race_edition_id uuid,
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
  v_edition public.development_race_editions%rowtype;
  v_day_number integer;
  v_registration_id uuid;
  v_count integer;
begin
  if v_auth_user_id is null then
    raise exception 'Vous devez être authentifié.';
  end if;

  select development_team.* into v_development_team
  from public.development_teams as development_team
  join public.seasons as season on season.id = development_team.season_id
  where season.status = 'active'
    and development_team.status = 'active'
    and public.current_user_manages_team(development_team.team_id)
  limit 1;

  if v_development_team.id is null then
    raise exception 'Constituez d’abord votre Development Team.';
  end if;

  select coalesce(current_day_number, 1) into v_day_number
  from public.seasons
  where id = v_development_team.season_id;

  select * into v_edition
  from public.development_race_editions
  where id = p_race_edition_id
    and season_id = v_development_team.season_id
  for update;

  if v_edition.id is null then
    raise exception 'Cette épreuve junior est introuvable.';
  end if;
  if v_edition.status <> 'planned' then
    raise exception 'Cette épreuve est déjà terminée.';
  end if;
  if v_day_number >= v_edition.start_day_number then
    raise exception 'Les inscriptions sont closes depuis le début de J%.',
      v_edition.start_day_number;
  end if;

  v_count := coalesce(array_length(p_academy_rider_ids, 1), 0);
  if v_count < v_edition.selection_minimum
    or v_count > v_edition.selection_maximum
  then
    raise exception 'Cette épreuve demande entre % et % coureurs.',
      v_edition.selection_minimum, v_edition.selection_maximum;
  end if;
  if (
    select count(distinct rider_id)
    from unnest(p_academy_rider_ids) as rider_id
  ) <> v_count then
    raise exception 'Un même junior ne peut pas être engagé plusieurs fois.';
  end if;
  if (
    select count(*)
    from public.development_team_roster as roster
    where roster.development_team_id = v_development_team.id
      and roster.academy_rider_id = any(p_academy_rider_ids)
  ) <> v_count then
    raise exception 'La sélection contient un junior extérieur à votre Development Team.';
  end if;

  insert into public.development_race_registrations (
    development_team_id, race_edition_id, status
  ) values (v_development_team.id, v_edition.id, 'registered')
  on conflict (development_team_id, race_edition_id) do update set
    status = 'registered', updated_at = now()
  returning id into v_registration_id;

  delete from public.development_race_registration_riders
  where registration_id = v_registration_id;

  insert into public.development_race_registration_riders (
    registration_id, academy_rider_id
  )
  select v_registration_id, rider_id
  from unnest(p_academy_rider_ids) as rider_id;

  return jsonb_build_object(
    'registrationId', v_registration_id,
    'raceName', v_edition.name,
    'riderCount', v_count
  );
end;
$$;

revoke all on function public.register_current_development_race(uuid, uuid[])
  from public, anon;
grant execute on function public.register_current_development_race(uuid, uuid[])
  to authenticated;

notify pgrst, 'reload schema';

commit;
