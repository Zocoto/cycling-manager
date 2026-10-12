begin;
set local lock_timeout='5s';
set local statement_timeout='15s';

-- Calendar mornings in Paris, not 84 * 24 hours (daylight saving time matters).
-- A renewed pact banks time only, never multiple reductions at the same training.
create or replace function public.halloween_pact_expires_at(p_now timestamptz,p_previous timestamptz)
returns timestamptz language sql immutable set search_path=public,pg_temp as $$
  select (((greatest(
    (((p_now at time zone 'Europe/Paris')::date
      +case when (p_now at time zone 'Europe/Paris')::time>=time '08:00' then 1 else 0 end)::timestamp
      +time '08:00') at time zone 'Europe/Paris',
    coalesce(p_previous,'-infinity'::timestamptz)) at time zone 'Europe/Paris')::date+84)::timestamp
    +time '08:00') at time zone 'Europe/Paris';
$$;
revoke all on function public.halloween_pact_expires_at(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.halloween_pact_expires_at(timestamptz,timestamptz) to service_role;

do $$
declare v_pk text;v_use text;v_action text;
  v_once text:=$old$    if p_item in('spectres-tea','giants-syrup','witches-star','youth-fountain','immortality-pact') then
      if exists(select 1 from public.halloween_rider_effects where rider_id=p_target and item_id=p_item) then raise exception 'Ce coureur a déjà bénéficié de cet objet sur sa carrière.'; end if;
    end if;$old$;
  v_expiry text:=$old$case when p_item='immortality-pact' then ((((now() at time zone 'Europe/Paris')::date+84+case when (now() at time zone 'Europe/Paris')::time>=time '08:00' then 1 else 0 end)::timestamp+time '08:00') at time zone 'Europe/Paris') end$old$;
  v_limit text:=$old$case when v_item.kind='cosmetic' or v_item.price>=180 then 1 when v_item.kind='transformation' then 10 else 30 end$old$;
begin
  select conname into v_pk from pg_constraint where conrelid='public.halloween_rider_effects'::regclass
    and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (rider_id, item_id)';
  if v_pk is null or exists(select 1 from pg_constraint where confrelid='public.halloween_rider_effects'::regclass and contype='f') then
    raise exception 'Unexpected Halloween effect key or incoming foreign key; inspect before migrating.';
  end if;
  v_use:=replace(pg_get_functiondef('public.halloween_use_item(uuid,text,uuid)'::regprocedure),chr(13),'');
  v_action:=replace(pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure),chr(13),'');
  v_once:=replace(v_once,chr(13),'');
  if (length(v_use)-length(replace(v_use,v_once,'')))/length(v_once)<>1
    or (length(v_use)-length(replace(v_use,v_expiry,'')))/length(v_expiry)<>1
    or (length(v_action)-length(replace(v_action,v_limit,'')))/length(v_limit)<>1 then
    raise exception 'Halloween function anchors changed; review the live definitions.';
  end if;
  -- Preserve every existing application, its timestamp, owner and expiry.
  alter table public.halloween_rider_effects add column id uuid not null default gen_random_uuid();
  execute format('alter table public.halloween_rider_effects drop constraint %I',v_pk);
  alter table public.halloween_rider_effects add constraint halloween_rider_effects_pkey primary key(id);
  create index halloween_rider_effects_rider_item_idx on public.halloween_rider_effects(rider_id,item_id,used_at);

  v_use:=replace(v_use,v_once,'    -- halloween_repeat_consumables_v1: each successful dose is recorded separately.');
  v_use:=replace(v_use,v_expiry,$new$case when p_item='immortality-pact' then public.halloween_pact_expires_at(now(),
          (select max(effect.protection_expires_at) from public.halloween_rider_effects effect where effect.rider_id=p_target and effect.item_id=p_item)) end$new$);
  execute v_use;
  -- Quotas must not depend on the price: a more expensive ordinary potion is not a relic.
  v_action:=replace(v_action,v_limit,$new$case when v_item.kind='cosmetic' then 1 when v_item.kind='transformation' then 10
      else coalesce((v_item.effect->>'purchaseLimit')::integer,30) end /* halloween_repeat_consumables_v1 */$new$);
  execute v_action;
end $$;

do $$
declare v_count integer;
begin
  update public.halloween_catalog catalog set price=changes.price,
    max_obtained=changes.max_obtained,
    effect=catalog.effect||jsonb_build_object('purchaseLimit',changes.purchase_limit)
  from (values
    ('pumpkin-juice',12,30,30),('mummy-bandage',16,30,30),('scouts-candy',20,30,30),
    ('gravediggers-hourglass',24,30,30),('midnight-chocolate',16,30,30),
    ('spectres-tea',100,30,30),('giants-syrup',100,30,30),
    ('immortality-pact',1800,6,5),('mummy-resurrection',720,6,5),('full-moon-elixir',560,6,5),
    ('cursed-builders-seal',900,6,5),('witches-star',3600,5,5),('youth-fountain',6000,6,5)
  ) changes(id,price,max_obtained,purchase_limit)
  where catalog.id=changes.id and catalog.kind='consumable';
  get diagnostics v_count=row_count;
  if v_count<>13 then raise exception 'Expected exactly 13 Halloween consumables, found %.',v_count; end if;
end $$;

-- Existing wallets, requests, purchases, inventory, draws and effects are untouched.
notify pgrst,'reload schema';
commit;
