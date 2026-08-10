begin;

create or replace function public.save_current_youth_training_settings_bulk(
  p_changes jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change jsonb;
  v_academy_rider_id uuid;
  v_training_priority text;
  v_training_mode text;
  v_seen_rider_ids uuid[] := array[]::uuid[];
  v_saved_count integer := 0;
begin
  if p_changes is null
    or jsonb_typeof(p_changes) <> 'array'
    or jsonb_array_length(p_changes) < 1
    or jsonb_array_length(p_changes) > 100 then
    raise exception 'La liste des entraînements juniors à modifier est invalide.';
  end if;

  for v_change in
    select entry.value
    from jsonb_array_elements(p_changes) as entry(value)
  loop
    if jsonb_typeof(v_change) <> 'object' then
      raise exception 'Un réglage d’entraînement junior est invalide.';
    end if;

    begin
      v_academy_rider_id := nullif(
        btrim(v_change ->> 'academyRiderId'),
        ''
      )::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Un jeune transmis est invalide.';
    end;

    v_training_priority := btrim(
      coalesce(v_change ->> 'trainingPriority', '')
    );
    v_training_mode := btrim(coalesce(v_change ->> 'trainingMode', ''));

    if v_academy_rider_id is null
      or v_training_priority not in (
        'climber',
        'puncheur',
        'northern_classics',
        'rouleur',
        'breakaway',
        'sprinter'
      )
      or v_training_mode not in ('automatic', 'manual') then
      raise exception 'Un réglage d’entraînement junior est invalide.';
    end if;

    if v_academy_rider_id = any(v_seen_rider_ids) then
      raise exception 'Un jeune ne peut apparaître qu’une fois dans la validation.';
    end if;
    v_seen_rider_ids := array_append(v_seen_rider_ids, v_academy_rider_id);

    perform public.save_current_youth_training_settings(
      v_academy_rider_id,
      v_training_priority,
      v_training_mode
    );
    v_saved_count := v_saved_count + 1;
  end loop;

  return v_saved_count;
end;
$$;

revoke all on function public.save_current_youth_training_settings_bulk(jsonb)
  from public, anon;
grant execute on function public.save_current_youth_training_settings_bulk(jsonb)
  to authenticated, service_role;

comment on function public.save_current_youth_training_settings_bulk(jsonb) is
  'Valide atomiquement plusieurs programmations d’entraînement de l’école de cyclisme.';

commit;
