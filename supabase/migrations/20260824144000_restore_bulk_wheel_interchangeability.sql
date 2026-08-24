begin;

-- L'optimisation ensembliste des affectations groupées a réintroduit une
-- égalité stricte entre l'emplacement et le type de roue. Elle doit utiliser
-- la règle centrale, qui conserve le comportement habituel et autorise le
-- montage croisé uniquement si l'équipe possède le talent mécanicien requis.
do $restore_bulk_wheel_interchangeability$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
  v_legacy_check constant text :=
    'and item.slot_type = requested.slot';
  v_compatible_check constant text :=
    'and public.equipment_slots_are_compatible(v_context.team_id, requested.slot, item.slot_type)';
begin
  v_signature :=
    'public.save_current_team_equipment_assignments(jsonb)'::regprocedure;

  select pg_get_functiondef(v_signature)
  into v_definition;

  if position(v_compatible_check in v_definition) > 0 then
    return;
  end if;

  v_patched_definition := replace(
    v_definition,
    v_legacy_check,
    v_compatible_check
  );

  if v_patched_definition = v_definition then
    raise exception
      'La validation groupée du matériel a une définition inattendue.';
  end if;

  execute v_patched_definition;
end;
$restore_bulk_wheel_interchangeability$;

comment on function public.save_current_team_equipment_assignments(jsonb) is
  'Valide le stock final et les emplacements, y compris les roues interchangeables autorisées par le talent mécanicien, puis applique le lot.';

notify pgrst, 'reload schema';

commit;
