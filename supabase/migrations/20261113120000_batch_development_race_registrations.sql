begin;

set local lock_timeout = '1s';
set local statement_timeout = '8s';

create function public.register_current_development_races(p_updates jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '1s'
set statement_timeout = '8s'
as $$
declare
  v_update record;
  v_race_name text;
begin
  if auth.uid() is null then
    raise exception 'Vous devez être authentifié.';
  end if;

  if jsonb_typeof(p_updates) is distinct from 'array' then
    raise exception 'La liste des inscriptions juniors est invalide.';
  end if;
  if jsonb_array_length(p_updates) not between 1 and 100 then
    raise exception 'La liste des inscriptions juniors est invalide.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_updates) as selection(value)
    where jsonb_typeof(selection.value) <> 'object'
      or coalesce(selection.value ->> 'raceEditionId', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or case when jsonb_typeof(selection.value -> 'riderIds') = 'array'
        then jsonb_array_length(selection.value -> 'riderIds') not between 1 and 6
        else true
      end
  ) then
    raise exception 'La liste des inscriptions juniors est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as selection(value)
    group by (selection.value ->> 'raceEditionId')::uuid
    having count(*) > 1
  ) then
    raise exception 'Une épreuve ne peut apparaître qu’une fois dans la validation.';
  end if;

  -- Concurrent batches acquire the existing edition locks in a stable order.
  for v_update in
    select (selection.value ->> 'raceEditionId')::uuid as race_id,
           selection.value -> 'riderIds' as riders
    from jsonb_array_elements(p_updates) as selection(value)
    order by race_id
  loop
    begin
      perform public.register_current_development_race(
        v_update.race_id,
        array(select rider.id::uuid from jsonb_array_elements_text(v_update.riders) as rider(id))
      );
    exception
      when raise_exception or invalid_text_representation then
        select edition.name into v_race_name
        from public.development_race_editions as edition
        where edition.id = v_update.race_id;
        raise exception '%', concat_ws(' · ', v_race_name, sqlerrm);
    end;
  end loop;

  return jsonb_array_length(p_updates);
end;
$$;

revoke all on function public.register_current_development_races(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.register_current_development_races(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
