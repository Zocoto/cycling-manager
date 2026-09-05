-- Run the first global CR immediately after enabling scheduled shop settlements.

begin;

do $initial_fan_club_sales_report$
declare
  v_settlement record;
begin
  select *
  into v_settlement
  from public.settle_due_fan_club_shop_sales();

  if coalesce(v_settlement.failed_teams, 0) > 0 then
    raise exception
      'Initial Fan Club sales CR failed for % team(s).',
      v_settlement.failed_teams;
  end if;

  raise notice
    'Initial Fan Club sales CR: % teams, % days, % units sold.',
    coalesce(v_settlement.processed_teams, 0),
    coalesce(v_settlement.processed_days, 0),
    coalesce(v_settlement.units_sold, 0);
end;
$initial_fan_club_sales_report$;

commit;
