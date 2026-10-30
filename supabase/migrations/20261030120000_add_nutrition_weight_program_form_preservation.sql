begin;
set local statement_timeout = '8s';
set local lock_timeout = '500ms';
set local application_name = 'nutrition-weight-form-preservation-20261030';

-- New generated nutritionists can draw this as their sole initial affix;
-- existing nutritionists can acquire it through the ordinary Academy flow.
-- Never reroll or append talents to historical staff automatically.
insert into public.staff_talent_catalog(code,role,display_name,minimum_level)
values('nutrition_weight_program_form_preservation','nutritionist','Préservation de la forme',1)
on conflict(code) do update set role=excluded.role,display_name=excluded.display_name,
  minimum_level=excluded.minimum_level,is_active=true;

-- Weight programmes do not select a particular nutritionist. Only the strongest
-- eligible active specialist contributes; multiple copies never stack. Reuse
-- the normal level, nationality and federal-institute efficiency multipliers.
create function private.get_team_weight_program_form_preservation(p_team_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select least(35::numeric,greatest(0::numeric,coalesce(max(
    public.get_staff_contract_talent_percentage(
      contract.id,'nutrition_weight_program_form_preservation',5
    )
  ),0)))
  from public.staff_contracts contract
  join public.staff_members member on member.id=contract.staff_member_id and member.role='nutritionist'
  join public.staff_member_talents talent on talent.staff_member_id=member.id
    and talent.talent_code='nutrition_weight_program_form_preservation'
  where contract.team_id=p_team_id and contract.status='active';
$$;
revoke all on function private.get_team_weight_program_form_preservation(uuid)
  from public,anon,authenticated,service_role;

-- Keep ownership, cooldown, weight bounds, condition locks, supplement batching,
-- exact retries and historical costs unchanged. Guard each replacement instead
-- of restoring an old full function definition over subsequent corrections.
do $patch$
declare
  v_definition text;
  v_old_declaration constant text := $old_declaration$  v_cost numeric;$old_declaration$;
  v_new_declaration constant text := $new_declaration$  v_cost numeric;
  v_form_preservation_percentage numeric := 0;$new_declaration$;
  v_old_loop constant text := $old_loop$  for v_entry in select value from jsonb_array_elements(p_weight_programs) e(value)$old_loop$;
  v_new_loop constant text := $new_loop$  if jsonb_array_length(p_weight_programs) > 0 then
    v_form_preservation_percentage := private.get_team_weight_program_form_preservation(v_context.team_id);
  end if;

  for v_entry in select value from jsonb_array_elements(p_weight_programs) e(value)$new_loop$;
  v_old_cost constant text := $old_cost$    v_cost := abs(v_delta) * 20;$old_cost$;
  v_new_cost constant text := $new_cost$    v_cost := round(abs(v_delta) * 20 * (1 - v_form_preservation_percentage / 100.0), 1);$new_cost$;
begin
  v_definition := replace(pg_get_functiondef('public.apply_current_team_nutrition_plan(jsonb,jsonb)'::regprocedure),chr(13),'');
  if position('v_form_preservation_percentage' in v_definition)>0
    or (length(v_definition)-length(replace(v_definition,v_old_declaration,'')))/length(v_old_declaration)<>1
    or (length(v_definition)-length(replace(v_definition,v_old_loop,'')))/length(v_old_loop)<>1
    or (length(v_definition)-length(replace(v_definition,v_old_cost,'')))/length(v_old_cost)<>1 then
    raise exception 'Unexpected nutrition plan function; form-preservation update cancelled.';
  end if;
  execute replace(replace(replace(v_definition,v_old_declaration,v_new_declaration),v_old_loop,v_new_loop),v_old_cost,v_new_cost);
end;
$patch$;

-- Share the exact authoritative percentage through the existing service-only
-- medical quote read: no additional client RPC and no per-rider staff reads.
do $preview$
declare
  v_definition text;
  v_old constant text := $old_preview$    'nutritionists', coalesce(($old_preview$;
  v_new constant text := $new_preview$    'weightProgramFormPreservationPercentage', coalesce((
      select private.get_team_weight_program_form_preservation(valid_context.team_id)
      from valid_context
    ),0),
    'nutritionists', coalesce(($new_preview$;
begin
  v_definition := replace(pg_get_functiondef('public.get_team_medical_staff_effective_quotes(uuid,uuid)'::regprocedure),chr(13),'');
  if position('weightProgramFormPreservationPercentage' in v_definition)>0
    or (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old)<>1 then
    raise exception 'Unexpected medical quote function; form-preservation preview update cancelled.';
  end if;
  execute replace(v_definition,v_old,v_new);
end;
$preview$;

notify pgrst,'reload schema';
commit;
