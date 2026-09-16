begin;

-- A team entry alone is not enough: every rider on the reconnaissance must
-- already be on the accepted roster of the target race edition.
create or replace function public.assert_reconnaissance_riders_registered(
  p_edition_id uuid,
  p_team_season_id uuid,
  p_rider_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registered_count integer;
begin
  select count(distinct roster.rider_id)
  into v_registered_count
  from public.race_registrations as registration
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  where registration.race_edition_id = p_edition_id
    and registration.team_season_id = p_team_season_id
    and registration.status = 'accepted'
    and roster.rider_id = any(p_rider_ids);

  if v_registered_count <> cardinality(p_rider_ids) then
    raise exception
      'Tous les coureurs sélectionnés doivent être inscrits à cette course pour organiser sa reconnaissance.';
  end if;
end;
$$;

-- Preserve the duration, staff-talent and pricing patches already installed
-- on both booking overloads instead of redefining their full bodies.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_marker constant text := 'if p_preparer_contract_id is not null then';
  v_replacement constant text :=
    E'perform public.assert_reconnaissance_riders_registered(\n'
    || E'    v_target.edition_id, v_context.team_season_id, v_rider_ids\n'
    || E'  );\n\n  if p_preparer_contract_id is not null then';
  v_count integer;
begin
  foreach v_signature in array array[
    'public.book_current_team_stage_reconnaissance(uuid,uuid[],uuid)'::regprocedure,
    'public.book_current_team_stage_reconnaissance(uuid,uuid[],integer,uuid)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_definition;
    v_count := (
      length(v_definition) - length(replace(v_definition, v_marker, ''))
    ) / length(v_marker);
    if v_count <> 1 then
      raise exception 'Point de contrôle de l’inscription inattendu pour % (% marqueurs).',
        v_signature, v_count;
    end if;
    execute replace(v_definition, v_marker, v_replacement);
  end loop;
end;
$migration$;

revoke all on function public.assert_reconnaissance_riders_registered(
  uuid, uuid, uuid[]
) from public, anon, authenticated;

comment on function public.assert_reconnaissance_riders_registered(
  uuid, uuid, uuid[]
) is 'Refuse une reconnaissance si un coureur manque à la liste engagée et acceptée de la course ciblée.';

commit;
