begin;

-- L'alerte équipementier rejoint le payload JSON du résumé compact existant.
-- Elle reprend strictement les garde-fous de la signature : réputation requise,
-- aucun contrat actif et au moins une marque active jamais utilisée par l'équipe.
do $migration$
declare
  v_definition text;
  v_previous_payload constant text := $previous$
      'nextSeasonRosterProjection', (
$previous$;
  v_replacement_payload constant text := $replacement$
      'equipmentPartnerSignatureAvailable', (
        select
          coalesce(director.reputation_points, 0) >= 200
          and not exists (
            select 1
            from public.equipment_partner_contracts as active_contract
            where active_contract.team_id = context.team_id
              and active_contract.status = 'active'
          )
          and exists (
            select 1
            from public.equipment_suppliers as supplier
            where supplier.status = 'active'
              and supplier.supports_team_contract
              and not exists (
                select 1
                from public.equipment_partner_contracts as used_contract
                where used_contract.team_id = context.team_id
                  and used_contract.supplier_key = supplier.supplier_key
              )
          )
        from current_context as context
        join public.sporting_directors as director
          on director.id = context.sporting_director_id
      ),
      'nextSeasonRosterProjection', (
$replacement$;
begin
  select pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  if strpos(v_definition, v_previous_payload) = 0 then
    raise exception
      'Le payload du résumé du Bureau est introuvable pour l’alerte équipementier.';
  end if;

  if length(v_definition) - length(replace(
    v_definition,
    v_previous_payload,
    ''
  )) <> length(v_previous_payload) then
    raise exception
      'Le point d’insertion de l’alerte équipementier n’est pas unique.';
  end if;

  execute replace(
    v_definition,
    v_previous_payload,
    v_replacement_payload
  );
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau. Il signale aussi la possibilité réelle de signer un équipementier sans requête cliente supplémentaire.';

notify pgrst, 'reload schema';

commit;
