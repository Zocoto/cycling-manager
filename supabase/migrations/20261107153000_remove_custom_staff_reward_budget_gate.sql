begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- A staff recruitment item does not require a positive season projection.
-- The actual cash check for already due salary installments still applies.
do $patch$
declare
  v_definition text := replace(pg_get_functiondef(
    'public.redeem_custom_staff_recruitment_reward(uuid,uuid,uuid,text,text,text,integer,text,text,text)'::regprocedure
  ), chr(13), '');
  v_anchor text;
  v_anchors constant text[] := array[
$anchor$  v_projected_budget numeric(14, 2);
$anchor$,
$anchor$  v_projected_budget := public.get_projected_transfer_budget(
    v_context.team_season_id
  );

$anchor$,
$anchor$  if v_projected_budget < v_salary then
    raise exception 'Le budget projeté ne couvre pas le salaire de la saison.';
  end if;
$anchor$
  ];
begin
  foreach v_anchor in array v_anchors loop
    if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1 then
      raise exception 'Unexpected custom staff reward function definition.';
    end if;
    v_definition := replace(v_definition, v_anchor, '');
  end loop;

  if position('v_projected_budget' in v_definition) <> 0
    or position('if v_context.cash_balance < v_due_salary then' in v_definition) = 0 then
    raise exception 'Unexpected custom staff reward financial checks.';
  end if;

  execute v_definition;
end;
$patch$;

commit;
