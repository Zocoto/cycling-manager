begin;

set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- The finance ledger remains the source of actual cash and gross expenses.
-- Add only the director's unbooked forecast receipts to the two consumers of
-- the season-end projection. Never credit cash or alter purchase cash limits.
do $migration$
declare
  v_patch record;
  v_definition text;
  v_anchor text;
  v_replacement text;
begin
  -- Resolve the shared, read-only forecast helper before changing any caller.
  perform 'private.get_team_financial_director_projection(uuid)'::regprocedure;

  for v_patch in select * from (values
    (
      'public.get_current_team_purchase_financial_risk(numeric)'::regprocedure,
      $old$  where transaction.team_season_id = v_team_season.id;

  return query$old$,
      $new$  where transaction.team_season_id = v_team_season.id;

  -- financial_director_purchase_projection_v1: expected receipts, not cash.
  select round(v_projected_balance + coalesce(sum(projection.amount), 0), 2)
  into v_projected_balance
  from private.get_team_financial_director_projection(v_team_season.id) as projection;

  return query$new$
    ),
    (
      'private.restock_fan_club_shop(uuid,integer)'::regprocedure,
      $old$    into v_cash,v_projection from public.team_finance_transactions t where t.team_season_id=p_team_season_id;
  if v_cash<=0 or (not v_settings.allow_negative_projection and v_projection<=0) then return 0; end if;$old$,
      $new$    into v_cash,v_projection from public.team_finance_transactions t where t.team_season_id=p_team_season_id;
  -- financial_director_restock_projection_v1: keep v_cash and its hard limits unchanged.
  select v_projection + coalesce(sum(projection.amount), 0)
    into v_projection
    from private.get_team_financial_director_projection(p_team_season_id) as projection;
  if v_cash<=0 or (not v_settings.allow_negative_projection and v_projection<=0) then return 0; end if;$new$
    )
  ) as patches(signature, anchor, replacement)
  loop
    v_definition := replace(pg_catalog.pg_get_functiondef(v_patch.signature), chr(13), '');
    v_anchor := replace(v_patch.anchor, chr(13), '');
    v_replacement := replace(v_patch.replacement, chr(13), '');

    if (length(v_definition) - length(replace(v_definition, v_replacement, '')))
      = length(v_replacement)
      and position(v_anchor in v_definition) = 0 then
      continue;
    end if;

    if (length(v_definition) - length(replace(v_definition, v_anchor, '')))
      <> length(v_anchor)
      or position('financial_director_purchase_projection_v1' in v_definition) > 0
      or position('financial_director_restock_projection_v1' in v_definition) > 0
    then
      raise exception 'Unexpected financial projection body for %; no changes applied.', v_patch.signature;
    end if;

    -- CREATE OR REPLACE keeps the original owner, grants, SECURITY DEFINER,
    -- search_path, validation, locks and all non-projection business rules.
    execute replace(v_definition, v_anchor, v_replacement);
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
