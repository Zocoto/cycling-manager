begin;
set local statement_timeout = '8s';
set local lock_timeout = '500ms';

-- Youth notes use an internal 1..6 scale; displayed notes are 34 + 8 * note.
-- Federation equipment is expressed in displayed points, as for professionals.
do $equipment$
declare
  v_definition text;
  v_start constant text := E'  select case p_profile_type\n';
  v_end constant text := E'  end\n';
begin
  v_definition := replace(pg_get_functiondef(
    'public.get_national_federation_equipment_junior_stage_bonus(uuid,uuid,text,text)'::regprocedure
  ), chr(13), '');
  if position('junior_equipment_native_scale_v1' in v_definition) = 0 then
    if (length(v_definition) - length(replace(v_definition, v_start, ''))) / length(v_start) <> 1
      or (length(v_definition) - length(replace(v_definition, v_end, ''))) / length(v_end) <> 1 then
      raise exception 'Unexpected junior equipment calculation; correction cancelled.';
    end if;
    v_definition := replace(v_definition, v_start,
      E'  -- junior_equipment_native_scale_v1\n  select (case p_profile_type\n');
    v_definition := replace(v_definition, v_end, E'  end) / 8.0\n');
    execute v_definition;
  end if;
end;
$equipment$;

-- Virtual riders fill the field. Even a minimum-rated academy rider scores
-- at least 1 - .36 = .64 before equipment, above the virtual maximum .38.
-- Keep deterministic variation among the fillers, and real riders unchanged.
do $virtuals$
declare
  v_signature regprocedure;
  v_definition text;
  v_anchor text;
begin
  foreach v_signature in array array[
    'public.simulate_development_race_pre_federation_juniors(uuid)'::regprocedure,
    'public.simulate_development_race_stage(uuid,uuid)'::regprocedure
  ] loop
    v_definition := replace(pg_get_functiondef(v_signature), chr(13), '');
    if position('junior_virtual_fillers_v1' in v_definition) > 0 then continue; end if;
    foreach v_anchor in array array['select 4.15', '* 3.45', '* .58'] loop
      if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1 then
        raise exception 'Unexpected junior virtual score in %; correction cancelled.', v_signature;
      end if;
    end loop;
    v_definition := replace(v_definition, 'select 4.15', 'select 0.10 /* junior_virtual_fillers_v1 */');
    v_definition := replace(v_definition, '* 3.45', '* 0.25');
    v_definition := replace(v_definition, '* .58', '* .06');
    execute v_definition;
  end loop;
end;
$virtuals$;

-- Definition-only delivery: never replay a completed edition or award prizes.
commit;
