begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';

do $migration$
declare
  v_change record;
  v_definition text;
  v_replaced text;
  v_contract_cleanup constant text := $cleanup$    and partner_contract.status = 'completed';$cleanup$;
  v_keep_active_equipment constant text := $keep$    and partner_contract.status = 'completed'
    and not exists (
      select 1
      from public.equipment_partner_contracts as active_contract
      join public.equipment_partner_item_effects as active_item
        on active_item.contract_id = active_contract.id
        and active_item.equipment_item_id = product.equipment_item_id
      join public.seasons as start_season on start_season.id = active_contract.start_season_id
      join public.seasons as end_season on end_season.id = active_contract.end_season_id
      where active_contract.team_id = partner_contract.team_id
        and active_contract.supplier_key = partner_contract.supplier_key
        and active_contract.status = 'active'
        and %s between start_season.game_year and end_season.game_year
    );$keep$;
begin
  -- Keep the latest definitions of the Bureau and rollover routines, which
  -- contain unrelated game rules added by earlier migrations.
  for v_change in
    select * from (values
      (
        'public.sign_equipment_partner_contract(text)',
        $previous$
  -- Only the most recent partner is excluded: A -> B -> A is allowed.
  if p_supplier_key = (
    select contract.supplier_key
    from public.equipment_partner_contracts as contract
    where contract.team_id = v_context.team_id
    order by contract.signed_at desc, contract.id desc
    limit 1
  ) then
    raise exception 'Vous devez changer d’équipementier après chaque contrat de deux saisons. Un ancien partenaire redevient disponible après un contrat avec une autre marque.';
  end if;
$previous$,
        '',
        1
      ),
      (
        'public.get_current_dashboard_assistant_summary()',
        $previous$
              and not exists (
                select 1
                from public.equipment_partner_contracts as used_contract
                where used_contract.team_id = context.team_id
                  and used_contract.supplier_key = supplier.supplier_key
              )$previous$,
        '',
        1
      ),
      (
        'public.sync_current_team_equipment_partner()',
        v_contract_cleanup,
        format(v_keep_active_equipment, 'v_context.game_year'),
        2
      ),
      (
        'public.rollover_game_season(uuid,boolean)',
        v_contract_cleanup,
        format(v_keep_active_equipment, 'v_target.game_year'),
        2
      )
    ) as changes(function_name, previous_sql, replacement_sql, expected_matches)
  loop
    v_definition := replace(pg_get_functiondef(v_change.function_name::regprocedure), chr(13), '');
    v_replaced := replace(v_definition, v_change.previous_sql, '');
    if length(v_definition) - length(v_replaced)
      <> v_change.expected_matches * length(v_change.previous_sql) then
      raise exception 'Unexpected equipment partner definition for %', v_change.function_name;
    end if;

    execute replace(v_definition, v_change.previous_sql, v_change.replacement_sql);
  end loop;
end;
$migration$;

comment on table public.equipment_partner_contracts is
  'Contrats équipementiers de deux saisons, renouvelables à leur terme.';

commit;
