begin;

create or replace function public.dismiss_current_team_youth_riders_bulk(
  p_academy_rider_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_count integer;
  v_distinct_count integer;
  v_academy_rider_id uuid;
  v_release jsonb;
  v_releases jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Vous devez être authentifié.';
  end if;

  v_requested_count := coalesce(cardinality(p_academy_rider_ids), 0);
  if v_requested_count < 1 or v_requested_count > 20 then
    raise exception 'Sélectionnez entre 1 et 20 juniors.';
  end if;

  if array_position(p_academy_rider_ids, null) is not null then
    raise exception 'La sélection contient un junior invalide.';
  end if;

  select count(distinct selected.academy_rider_id)::integer
  into v_distinct_count
  from unnest(p_academy_rider_ids) as selected(academy_rider_id);

  if v_distinct_count <> v_requested_count then
    raise exception 'Un junior ne peut être sélectionné qu’une fois.';
  end if;

  -- The called function owns every business guard. Keeping every call inside
  -- this RPC also makes the complete selection atomic: one failure rolls back
  -- every scheduled departure from the batch.
  for v_academy_rider_id in
    select selected.academy_rider_id
    from unnest(p_academy_rider_ids) as selected(academy_rider_id)
    order by selected.academy_rider_id
  loop
    v_release := public.dismiss_current_team_youth_rider(v_academy_rider_id);
    v_releases := v_releases || jsonb_build_array(v_release);
  end loop;

  return jsonb_build_object(
    'dismissedCount', v_requested_count,
    'releases', v_releases
  );
end;
$$;

comment on function public.dismiss_current_team_youth_riders_bulk(uuid[]) is
  'Programme atomiquement le départ en fin de saison de plusieurs juniors de l’équipe courante.';

revoke all on function public.dismiss_current_team_youth_riders_bulk(uuid[])
from public, anon;
grant execute on function public.dismiss_current_team_youth_riders_bulk(uuid[])
to authenticated;

commit;
