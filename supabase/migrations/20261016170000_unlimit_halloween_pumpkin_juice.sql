begin;
set local lock_timeout='3s';
set local statement_timeout='10s';
set local application_name='halloween-pumpkin-quota-migration';

-- NULL expresses no obtained quota; every other item must remain capped.
alter table public.halloween_catalog alter column max_obtained drop not null;
alter table public.halloween_catalog add constraint halloween_catalog_other_items_remain_capped
  check(max_obtained is not null or id='pumpkin-juice');
update public.halloween_catalog set max_obtained=null,
  effect=effect || jsonb_build_object('purchaseLimit',null)
where id='pumpkin-juice';

do $purchase_guard$
declare definition text; anchor text := 'if coalesce((v_wallet.purchases->>v_item.id)::integer,0)>=';
begin
  select replace(pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure),chr(13),'') into definition;
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
    raise exception 'Unknown Halloween purchase guard; review before migrating';
  end if;
  execute replace(definition,anchor,'if v_item.max_obtained is not null and coalesce((v_wallet.purchases->>v_item.id)::integer,0)>=');
end;
$purchase_guard$;

-- Obtained-limit checks in buying/gifting already use >= max_obtained:
-- with NULL they do not cap or convert juice gifts back into coins.
-- Existing wallets, purchase counts, stock, prices and rider effects stay intact.
notify pgrst,'reload schema';
commit;
