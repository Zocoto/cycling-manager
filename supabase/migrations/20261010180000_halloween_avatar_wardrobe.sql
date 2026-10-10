begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

-- New purchases only: acquired items, balances and past ledger entries stay intact.
update public.halloween_catalog catalog set price=prices.price
from (values ('lord-vlad',50),('halloween-background',30),('devil-trident',24),
  ('pumpkin-cap',14),('pocket-bat',8),('spectral-wheel',16),('cobweb-frame',14),('ghost-scarf',20)) prices(id,price)
where catalog.id=prices.id and catalog.kind='cosmetic';

-- The web occupies a corner; it can coexist with the spectral border.
update public.halloween_catalog set effect=jsonb_set(effect,'{slot}','"frame_corner"') where id='cobweb-frame' and kind='cosmetic';
update public.halloween_wallets set cosmetics=(cosmetics-'frame')||jsonb_build_object('frame_corner','cobweb-frame')
where edition_id='halloween-2026' and cosmetics->>'frame'='cobweb-frame';

-- Called only after the authenticated Server Action's existing trophy/referral
-- validations. Ownership and exclusivity are rechecked inside this transaction.
create function public.save_sporting_director_avatar_cosmetics(
  p_user uuid,p_display_name text,p_country uuid,p_avatar text,p_frame text,p_email_visible boolean,p_items text[]
) returns void language plpgsql security definer set search_path=public,pg_temp set lock_timeout='3s' as $$
declare
  v_wallet public.halloween_wallets%rowtype;
  v_profile public.sporting_directors%rowtype;
  v_item public.halloween_catalog%rowtype;
  v_id text; v_slot text; v_cosmetics jsonb:='{}';
begin
  if p_user is null or p_items is null or cardinality(p_items)>9 then raise exception 'Sélection d’accessoires invalide.'; end if;
  select * into v_wallet from public.halloween_wallets where edition_id='halloween-2026' and user_id=p_user for update;
  foreach v_id in array p_items loop
    if v_id is null then raise exception 'Sélection d’accessoires invalide.'; end if;
    select * into v_item from public.halloween_catalog where id=v_id and kind='cosmetic';
    if v_item.id is null or coalesce((v_wallet.inventory->>v_id)::integer,0)<1 then
      raise exception 'Vous ne possédez pas ce cosmétique.';
    end if;
    v_slot:=coalesce(v_item.effect->>'slot','accessory');
    if v_cosmetics ? v_slot then raise exception 'Choisissez un seul élément par emplacement.'; end if;
    v_cosmetics:=v_cosmetics||jsonb_build_object(v_slot,v_id);
  end loop;
  select * into strict v_profile from public.sporting_directors where auth_user_id=p_user for update;
  if v_profile.country_id is not null and v_profile.country_id is distinct from p_country then
    raise exception 'La nationalité ne peut plus être modifiée.';
  end if;
  if p_frame is not null and p_frame<>'alpha_tester' then raise exception 'Liseré invalide.'; end if;
  -- Existing sync triggers regenerate the authoritative decorated key. Doing
  -- this before the profile update avoids nested updates of the same tuple.
  if v_wallet.user_id is not null and v_wallet.cosmetics is distinct from v_cosmetics then
    update public.halloween_wallets set cosmetics=v_cosmetics where edition_id='halloween-2026' and user_id=p_user;
  end if;
  update public.sporting_directors set display_name=p_display_name,country_id=p_country,
    avatar_key=split_part(p_avatar,'~halloween~',1),avatar_frame_key=p_frame,is_email_visible=p_email_visible
  where auth_user_id=p_user;
end $$;
revoke all on function public.save_sporting_director_avatar_cosmetics(uuid,text,uuid,text,text,boolean,text[]) from public,anon,authenticated;
grant execute on function public.save_sporting_director_avatar_cosmetics(uuid,text,uuid,text,text,boolean,text[]) to service_role;
notify pgrst,'reload schema';
commit;
