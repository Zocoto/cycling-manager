begin;
set local statement_timeout = '8s';
set local lock_timeout = '500ms';
set local application_name = 'halloween-shop-season-four-deadline-20261030';

-- Owner decision: keep the shop through the last day of season 4, November 5
-- inclusive in Paris. Games still end at the start of November 3. Nothing in
-- wallets, purchases, rewards, owned objects or past runs is rewritten.
do $edition$
declare v_edition public.halloween_editions%rowtype;
begin
  select * into strict v_edition from public.halloween_editions
    where id='halloween-2026' for update;
  if v_edition.ends_at <> timestamptz '2026-11-02 23:00:00Z'
    or v_edition.shop_ends_at not in (
      timestamptz '2026-11-09 23:00:00Z',timestamptz '2026-11-05 23:00:00Z'
    ) then
    raise exception 'Unexpected Halloween dates; shop deadline update cancelled.';
  end if;
  update public.halloween_editions
  set shop_ends_at=timestamptz '2026-11-05 23:00:00Z'
  where id='halloween-2026' and shop_ends_at<>timestamptz '2026-11-05 23:00:00Z';
end;
$edition$;

-- The real guards already use edition dates. Only remove the obsolete date
-- embedded in their explanatory error, retaining every other current patch.
do $message$
declare
  v_definition text;
  v_old constant text := $old_message$Les jeux sont terminés. La boutique reste ouverte jusqu’au 9 novembre inclus.$old_message$;
  v_new constant text := $new_message$Les jeux sont terminés. La boutique reste ouverte jusqu’à la date indiquée dans l’événement.$new_message$;
begin
  v_definition:=pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure);
  if position(v_old in v_definition)>0 then
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old)<>1
      or position(v_new in v_definition)>0 then
      raise exception 'Unexpected Halloween message; deadline update cancelled.';
    end if;
    execute replace(v_definition,v_old,v_new);
  elsif (length(v_definition)-length(replace(v_definition,v_new,'')))/length(v_new)<>1 then
    raise exception 'Unexpected Halloween action function; deadline update cancelled.';
  end if;
end;
$message$;

notify pgrst,'reload schema';
commit;
