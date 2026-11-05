-- Ordinary consumables only. No owned stock, provenance, expiry, odds or effect is rewritten.
begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';

create or replace function private.inventory_consumable_equivalence(p_source text,p_key text,p_kind text,p_payload jsonb)
returns text language sql immutable set search_path='' as $equivalence$
 select coalesce((select mapping.canonical from (values
    ('daily_reward','secondary-specialization','rating_boost','{"amount":1,"statScope":"secondary"}'::jsonb,'secondary-technique'),
    ('daily_reward','secondary-technique','rating_boost','{"amount":1,"statScope":"secondary"}'::jsonb,'secondary-technique'),
    ('daily_reward','talent-revealed','special_ability','{}'::jsonb,'talent-revealed'),
    ('daily_reward','talent-revealed-plus','special_ability','{}'::jsonb,'talent-revealed'),
    ('daily_reward','elite-equipment','equipment','{"rarity":"premium"}'::jsonb,'premium-equipment'),
    ('daily_reward','premium-equipment','equipment','{"rarity":"premium"}'::jsonb,'premium-equipment'),
    ('daily_reward','ultimate-prototype','equipment','{"rarity":"premium"}'::jsonb,'premium-equipment'),
    ('item','classified-talent-dossier','potential_boost','{"potentialBonus":1}'::jsonb,'potential-notebook'),
    ('item','potential-notebook','potential_boost','{"potentialBonus":1}'::jsonb,'potential-notebook'),
    ('daily_reward','construction-square','construction_time_reduction','{"days":2}'::jsonb,'construction-square'),
    ('item','construction-square','other','{"days":2,"effectKind":"construction_time_reduction","level":4}'::jsonb,'construction-square'),
    ('daily_reward','custom-staff-mandate','custom_staff_recruitment','{"signingFeeWaived":true,"uniformLevelOdds":true}'::jsonb,'custom-staff-mandate'),
    ('item','custom-staff-mandate','other','{"effectKind":"custom_staff_recruitment","level":10,"signingFeeWaived":true,"uniformLevelOdds":true}'::jsonb,'custom-staff-mandate'),
    ('daily_reward','injury-care-anti-inflammatory-protocol','injury_care','{"level":5,"recoveryHours":48}'::jsonb,'injury-care-anti-inflammatory-protocol'),
    ('item','injury-care-anti-inflammatory-protocol','injury_care','{"effectKind":"injury_care","level":5,"recoveryHours":48}'::jsonb,'injury-care-anti-inflammatory-protocol'),
    ('daily_reward','injury-care-compressive-dressing','injury_care','{"level":1,"recoveryHours":2}'::jsonb,'injury-care-compressive-dressing'),
    ('item','injury-care-compressive-dressing','injury_care','{"effectKind":"injury_care","level":1,"recoveryHours":2}'::jsonb,'injury-care-compressive-dressing'),
    ('daily_reward','injury-care-cryotherapy-pack','injury_care','{"level":2,"recoveryHours":6}'::jsonb,'injury-care-cryotherapy-pack'),
    ('item','injury-care-cryotherapy-pack','injury_care','{"effectKind":"injury_care","level":2,"recoveryHours":6}'::jsonb,'injury-care-cryotherapy-pack'),
    ('daily_reward','injury-care-physiotherapy-session','injury_care','{"level":4,"recoveryHours":24}'::jsonb,'injury-care-physiotherapy-session'),
    ('item','injury-care-physiotherapy-session','injury_care','{"effectKind":"injury_care","level":4,"recoveryHours":24}'::jsonb,'injury-care-physiotherapy-session'),
    ('daily_reward','injury-care-recovery-kit','injury_care','{"level":3,"recoveryHours":12}'::jsonb,'injury-care-recovery-kit'),
    ('item','injury-care-recovery-kit','injury_care','{"effectKind":"injury_care","level":3,"recoveryHours":12}'::jsonb,'injury-care-recovery-kit'),
    ('daily_reward','instant-youth-contract','instant_youth_promotion','{}'::jsonb,'instant-youth-contract'),
    ('item','instant-youth-contract','other','{"effectKind":"instant_youth_promotion","level":8}'::jsonb,'instant-youth-contract'),
    ('daily_reward','precision-architect-tee','construction_time_reduction','{"days":7}'::jsonb,'precision-architect-tee'),
    ('item','precision-architect-tee','other','{"days":7,"effectKind":"construction_time_reduction","level":7}'::jsonb,'precision-architect-tee'),
    ('daily_reward','scouting-clarity-pass','scouting_visibility','{"durationHours":24}'::jsonb,'scouting-clarity-pass'),
    ('item','scouting-clarity-pass','other','{"durationHours":24,"effectKind":"scouting_visibility","level":6}'::jsonb,'scouting-clarity-pass'),
    ('daily_reward','staff-expertise-badge','staff_level_boost','{}'::jsonb,'staff-expertise-badge'),
    ('item','staff-expertise-badge','other','{"effectKind":"staff_level_boost","level":10,"maximumLevel":5}'::jsonb,'staff-expertise-badge')
 ) as mapping(source,key,kind,payload,canonical)
 where mapping.source=p_source and mapping.key=p_key and mapping.kind=p_kind and mapping.payload=p_payload
 limit 1),p_source||':'||p_key);
$equivalence$;
revoke all on function private.inventory_consumable_equivalence(text,text,text,jsonb) from public,anon,authenticated;

-- Preserve historical keys and reward levels: the existing recipes keep exactly
-- the same chances. Canonical wording is shared by all equivalent references.
update public.daily_reward_catalog set name='Perfectionnement technique',description='Un travail ciblé améliore définitivement une qualité secondaire.',effect_summary='+1 dans la statistique secondaire choisie',icon_key='rating'
 where reward_key='secondary-specialization' and effect_kind='rating_boost' and effect_payload='{"amount":1,"statScope":"secondary"}'::jsonb;
update public.daily_reward_catalog set name='Perfectionnement technique',description='Un travail ciblé améliore définitivement une qualité secondaire.',effect_summary='+1 dans la statistique secondaire choisie',icon_key='rating'
 where reward_key='secondary-technique' and effect_kind='rating_boost' and effect_payload='{"amount":1,"statScope":"secondary"}'::jsonb;
update public.daily_reward_catalog set name='Talent révélé',description='Le staff révèle une capacité qui restera attachée au coureur.',effect_summary='1 capacité spéciale au choix pour un coureur',icon_key='ability'
 where reward_key='talent-revealed' and effect_kind='special_ability' and effect_payload='{}'::jsonb;
update public.daily_reward_catalog set name='Talent révélé',description='Le staff révèle une capacité qui restera attachée au coureur.',effect_summary='1 capacité spéciale au choix pour un coureur',icon_key='ability'
 where reward_key='talent-revealed-plus' and effect_kind='special_ability' and effect_payload='{}'::jsonb;
update public.daily_reward_catalog set name='Équipement premium',description='Une référence haut de gamme rejoint le stock sans transaction.',effect_summary='1 équipement commercial premium',icon_key='equipment'
 where reward_key='elite-equipment' and effect_kind='equipment' and effect_payload='{"rarity":"premium"}'::jsonb;
update public.daily_reward_catalog set name='Équipement premium',description='Une référence haut de gamme rejoint le stock sans transaction.',effect_summary='1 équipement commercial premium',icon_key='equipment'
 where reward_key='premium-equipment' and effect_kind='equipment' and effect_payload='{"rarity":"premium"}'::jsonb;
update public.daily_reward_catalog set name='Équipement premium',description='Une référence haut de gamme rejoint le stock sans transaction.',effect_summary='1 équipement commercial premium',icon_key='equipment'
 where reward_key='ultimate-prototype' and effect_kind='equipment' and effect_payload='{"rarity":"premium"}'::jsonb;
update public.inventory_catalog_items set name='Carnet de progression',description='Un programme individuel qui ouvre une nouvelle marge de progression.',effect_summary='+1 potentiel au coureur sélectionné.',icon_key='potential'
 where item_key='classified-talent-dossier' and category='potential_boost' and effect_payload='{"potentialBonus":1}'::jsonb;
update public.inventory_catalog_items set name='Carnet de progression',description='Un programme individuel qui ouvre une nouvelle marge de progression.',effect_summary='+1 potentiel au coureur sélectionné.',icon_key='potential'
 where item_key='potential-notebook' and category='potential_boost' and effect_payload='{"potentialBonus":1}'::jsonb;
update public.daily_reward_catalog set name='Équerre de chantier',description='Un outil de contrôle qui permet de corriger rapidement le planning d’un bâtiment déjà en construction.',effect_summary='Retire 2 jours à un chantier actif · 1 jour minimum restant',icon_key='architect'
 where reward_key='construction-square' and effect_kind='construction_time_reduction' and effect_payload='{"days":2}'::jsonb;
update public.inventory_catalog_items set name='Équerre de chantier',description='Un outil de contrôle qui permet de corriger rapidement le planning d’un bâtiment déjà en construction.',effect_summary='Retire 2 jours à un chantier actif · 1 jour minimum restant',icon_key='architect'
 where item_key='construction-square' and category='other' and effect_payload='{"days":2,"effectKind":"construction_time_reduction","level":4}'::jsonb;
update public.daily_reward_catalog set name='Mandat de recrutement sur mesure',description='Choisissez le métier et la nationalité. Le profil généré reçoit un niveau de 1 à 5 étoiles à chances égales et un talent compatible aléatoire.',effect_summary='1 staff sur mesure · 20 % de chance pour chaque niveau',icon_key='staff'
 where reward_key='custom-staff-mandate' and effect_kind='custom_staff_recruitment' and effect_payload='{"signingFeeWaived":true,"uniformLevelOdds":true}'::jsonb;
update public.inventory_catalog_items set name='Mandat de recrutement sur mesure',description='Choisissez le métier et la nationalité. Le profil généré reçoit un niveau de 1 à 5 étoiles à chances égales et un talent compatible aléatoire.',effect_summary='1 staff sur mesure · 20 % de chance pour chaque niveau',icon_key='staff'
 where item_key='custom-staff-mandate' and category='other' and effect_payload='{"effectKind":"custom_staff_recruitment","level":10,"signingFeeWaived":true,"uniformLevelOdds":true}'::jsonb;
update public.daily_reward_catalog set name='Protocole anti-inflammatoire',description='Un protocole renforcé qui agit sur les traumatismes compatibles avec une reprise accélérée.',effect_summary='Réduit la convalescence de 2 jours.',icon_key='medical'
 where reward_key='injury-care-anti-inflammatory-protocol' and effect_kind='injury_care' and effect_payload='{"level":5,"recoveryHours":48}'::jsonb;
update public.inventory_catalog_items set name='Protocole anti-inflammatoire',description='Un protocole renforcé qui agit sur les traumatismes compatibles avec une reprise accélérée.',effect_summary='Réduit la convalescence de 2 jours.',icon_key='medical'
 where item_key='injury-care-anti-inflammatory-protocol' and category='injury_care' and effect_payload='{"effectKind":"injury_care","level":5,"recoveryHours":48}'::jsonb;
update public.daily_reward_catalog set name='Pansement compressif',description='Un premier soin immédiatement disponible pour gagner quelques heures sur une blessure en cours.',effect_summary='Réduit la convalescence de 2 h.',icon_key='medical'
 where reward_key='injury-care-compressive-dressing' and effect_kind='injury_care' and effect_payload='{"level":1,"recoveryHours":2}'::jsonb;
update public.inventory_catalog_items set name='Pansement compressif',description='Un premier soin immédiatement disponible pour gagner quelques heures sur une blessure en cours.',effect_summary='Réduit la convalescence de 2 h.',icon_key='medical'
 where item_key='injury-care-compressive-dressing' and category='injury_care' and effect_payload='{"effectKind":"injury_care","level":1,"recoveryHours":2}'::jsonb;
update public.daily_reward_catalog set name='Pack de cryothérapie',description='Un traitement par le froid qui accélère la première phase de récupération.',effect_summary='Réduit la convalescence de 6 h.',icon_key='medical'
 where reward_key='injury-care-cryotherapy-pack' and effect_kind='injury_care' and effect_payload='{"level":2,"recoveryHours":6}'::jsonb;
update public.inventory_catalog_items set name='Pack de cryothérapie',description='Un traitement par le froid qui accélère la première phase de récupération.',effect_summary='Réduit la convalescence de 6 h.',icon_key='medical'
 where item_key='injury-care-cryotherapy-pack' and category='injury_care' and effect_payload='{"effectKind":"injury_care","level":2,"recoveryHours":6}'::jsonb;
update public.daily_reward_catalog set name='Session de physiothérapie',description='Une prise en charge individuelle destinée à faire gagner une journée de récupération.',effect_summary='Réduit la convalescence de 1 jour.',icon_key='medical'
 where reward_key='injury-care-physiotherapy-session' and effect_kind='injury_care' and effect_payload='{"level":4,"recoveryHours":24}'::jsonb;
update public.inventory_catalog_items set name='Session de physiothérapie',description='Une prise en charge individuelle destinée à faire gagner une journée de récupération.',effect_summary='Réduit la convalescence de 1 jour.',icon_key='medical'
 where item_key='injury-care-physiotherapy-session' and category='injury_care' and effect_payload='{"effectKind":"injury_care","level":4,"recoveryHours":24}'::jsonb;
update public.daily_reward_catalog set name='Trousse de récupération',description='Une sélection complète de soins légers pour raccourcir une indisponibilité.',effect_summary='Réduit la convalescence de 12 h.',icon_key='medical'
 where reward_key='injury-care-recovery-kit' and effect_kind='injury_care' and effect_payload='{"level":3,"recoveryHours":12}'::jsonb;
update public.inventory_catalog_items set name='Trousse de récupération',description='Une sélection complète de soins légers pour raccourcir une indisponibilité.',effect_summary='Réduit la convalescence de 12 h.',icon_key='medical'
 where item_key='injury-care-recovery-kit' and category='injury_care' and effect_payload='{"effectKind":"injury_care","level":3,"recoveryHours":12}'::jsonb;
update public.daily_reward_catalog set name='Contrat Espoir immédiat',description='Permet à un junior de 17 ans ou plus de quitter immédiatement l’école pour rejoindre l’équipe première, même en cours de saison.',effect_summary='Promotion professionnelle immédiate d’un junior éligible',icon_key='contract'
 where reward_key='instant-youth-contract' and effect_kind='instant_youth_promotion' and effect_payload='{}'::jsonb;
update public.inventory_catalog_items set name='Contrat Espoir immédiat',description='Permet à un junior de 17 ans ou plus de quitter immédiatement l’école pour rejoindre l’équipe première, même en cours de saison.',effect_summary='Promotion professionnelle immédiate d’un junior éligible',icon_key='contract'
 where item_key='instant-youth-contract' and category='other' and effect_payload='{"effectKind":"instant_youth_promotion","level":8}'::jsonb;
update public.daily_reward_catalog set name='Té d’architecte de précision',description='Un instrument rare réservé aux grands chantiers, capable de raccourcir nettement un calendrier de construction en cours.',effect_summary='Retire 7 jours à un chantier actif · 1 jour minimum restant',icon_key='architect'
 where reward_key='precision-architect-tee' and effect_kind='construction_time_reduction' and effect_payload='{"days":7}'::jsonb;
update public.inventory_catalog_items set name='Té d’architecte de précision',description='Un instrument rare réservé aux grands chantiers, capable de raccourcir nettement un calendrier de construction en cours.',effect_summary='Retire 7 jours à un chantier actif · 1 jour minimum restant',icon_key='architect'
 where item_key='precision-architect-tee' and category='other' and effect_payload='{"days":7,"effectKind":"construction_time_reduction","level":7}'::jsonb;
update public.daily_reward_catalog set name='Loupe du recruteur',description='Une fenêtre d’observation privilégiée pour examiner sans approximation les talents disponibles.',effect_summary='Révèle pendant 24 h toutes les notes et le potentiel des coureurs libres et des juniors repérés',icon_key='scouting-clarity'
 where reward_key='scouting-clarity-pass' and effect_kind='scouting_visibility' and effect_payload='{"durationHours":24}'::jsonb;
update public.inventory_catalog_items set name='Loupe du recruteur',description='Une fenêtre d’observation privilégiée pour examiner sans approximation les talents disponibles.',effect_summary='Révèle pendant 24 h toutes les notes et le potentiel des coureurs libres et des juniors repérés',icon_key='scouting-clarity'
 where item_key='scouting-clarity-pass' and category='other' and effect_payload='{"durationHours":24,"effectKind":"scouting_visibility","level":6}'::jsonb;
update public.daily_reward_catalog set name='Insigne d’expertise',description='Récompense un membre actif du staff par une progression immédiate de son niveau professionnel.',effect_summary='+1 étoile au membre du staff choisi · maximum 5★',icon_key='staff'
 where reward_key='staff-expertise-badge' and effect_kind='staff_level_boost' and effect_payload='{}'::jsonb;
update public.inventory_catalog_items set name='Insigne d’expertise',description='Récompense un membre actif du staff par une progression immédiate de son niveau professionnel.',effect_summary='+1 étoile au membre du staff choisi · maximum 5★',icon_key='staff'
 where item_key='staff-expertise-badge' and category='other' and effect_payload='{"effectKind":"staff_level_boost","level":10,"maximumLevel":5}'::jsonb;

CREATE OR REPLACE FUNCTION public.redeem_current_daily_rewards(p_inventory_id uuid, p_quantity integer, p_rider_id uuid DEFAULT NULL::uuid, p_rating_key text DEFAULT NULL::text, p_ability_code text DEFAULT NULL::text, p_race_edition_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reward record;
  v_inventory_ids uuid[];
  v_inventory_id uuid;
  v_result jsonb;
  v_current_game_year integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    raise exception 'La quantité demandée est invalide.';
  end if;

  select season.game_year
  into v_current_game_year
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  select
    inventory.sporting_director_id,
    inventory.reward_key,
    catalog.name,
    catalog.effect_kind,
    private.inventory_consumable_equivalence('daily_reward',catalog.reward_key,catalog.effect_kind,catalog.effect_payload) as group_key
  into v_reward
  from public.daily_reward_inventory as inventory
  join public.sporting_directors as director
    on director.id = inventory.sporting_director_id
   and director.auth_user_id = auth.uid()
   and director.status = 'active'
  join public.daily_reward_catalog as catalog
    on catalog.reward_key = inventory.reward_key
   and catalog.is_active
  where inventory.id = p_inventory_id
    and inventory.status = 'available'
    and inventory.expires_after_game_year >= v_current_game_year;

  if v_reward is null then
    raise exception 'Ce cadeau n’est plus disponible.';
  end if;

  if v_reward.effect_kind not in (
    'form_boost',
    'rider_experience',
    'rating_boost',
    'scouting_boost'
  ) and p_quantity > 1 then
    raise exception 'Ce type de cadeau doit être utilisé un exemplaire à la fois.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'daily-reward-use:' || v_reward.sporting_director_id::text || ':' || v_reward.group_key,
      0
    )
  );

  select array_agg(
    candidate.id
    order by candidate.expires_after_game_year, candidate.acquired_at, candidate.id
  )
  into v_inventory_ids
  from (
    select
      inventory.id,
      inventory.expires_after_game_year,
      inventory.acquired_at
    from public.daily_reward_inventory as inventory
    join public.daily_reward_catalog as catalog on catalog.reward_key=inventory.reward_key and catalog.is_active
    where inventory.sporting_director_id = v_reward.sporting_director_id
      and private.inventory_consumable_equivalence('daily_reward',catalog.reward_key,catalog.effect_kind,catalog.effect_payload) = v_reward.group_key
      and inventory.status = 'available'
      and inventory.expires_after_game_year >= v_current_game_year
    order by inventory.expires_after_game_year, inventory.acquired_at, inventory.id
    limit p_quantity
    for update of inventory
  ) as candidate;

  if coalesce(cardinality(v_inventory_ids), 0) < p_quantity then
    raise exception 'Le contingent disponible est insuffisant pour cette attribution.';
  end if;

  foreach v_inventory_id in array v_inventory_ids loop
    v_result := public.redeem_current_daily_reward(
      v_inventory_id,
      p_rider_id,
      p_rating_key,
      p_ability_code,
      p_race_edition_id
    );
  end loop;

  if p_quantity = 1 then
    return v_result;
  end if;

  return jsonb_build_object(
    'inventoryId', p_inventory_id,
    'quantityApplied', p_quantity,
    'message', format(
      '%s × %s utilisés : l’effet cumulé a été appliqué.',
      p_quantity,
      v_reward.name
    )
  );
end;
$function$
;

create or replace function public.use_current_team_inventory_items(p_rider_id uuid,p_inventory_item_id uuid,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public as $bulk$
declare
 v_item record; v_context record; v_stock record; v_result jsonb;
 v_remaining integer := p_quantity; v_count integer; v_index integer;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Vous devez être connecté.';end if;
 if p_quantity is null or p_quantity<1 or p_quantity>1000 then raise exception 'La quantité demandée est invalide.';end if;
 select item.name,item.category,item.effect_summary,
   private.inventory_consumable_equivalence('item',item.item_key,item.category,item.effect_payload) as group_key
 into v_item from public.inventory_catalog_items item
 where item.id=p_inventory_item_id and item.status='active' and item.is_consumable;
 if v_item is null then raise exception 'Cet objet consommable est indisponible.';end if;
 if v_item.category='special_ability' and p_quantity>1 then
   raise exception 'Une capacité spéciale ne peut être attribuée qu’une fois par utilisation.';end if;

 select ts.id as team_season_id into v_context
 from public.sporting_directors d
 join public.team_manager_assignments a on a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
 join public.seasons s on s.status='active'
 join public.team_seasons ts on ts.team_id=a.team_id and ts.season_id=s.id and ts.status in ('active','planned')
 where d.auth_user_id=auth.uid() and d.status='active' limit 1;
 if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';end if;
 perform pg_advisory_xact_lock(hashtextextended('inventory-consumable-use:'||v_context.team_season_id::text||':'||v_item.group_key,0));

 for v_stock in
   select stock.inventory_item_id,stock.quantity
   from public.team_item_inventory stock
   join public.inventory_catalog_items item on item.id=stock.inventory_item_id and item.status='active' and item.is_consumable
   where stock.team_season_id=v_context.team_season_id and stock.quantity>0
     and private.inventory_consumable_equivalence('item',item.item_key,item.category,item.effect_payload)=v_item.group_key
   order by stock.acquired_at,stock.id for update of stock
 loop
   v_count:=least(v_remaining,v_stock.quantity);
   for v_index in 1..v_count loop
     v_result:=public.use_current_team_inventory_item(p_rider_id,v_stock.inventory_item_id);
   end loop;
   v_remaining:=v_remaining-v_count;
   exit when v_remaining=0;
 end loop;
 if v_remaining>0 then raise exception 'Le contingent disponible est insuffisant pour cette attribution.';end if;
 return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('itemName',v_item.name,'effectSummary',
   v_item.effect_summary||case when p_quantity>1 then format(' Effet appliqué %s fois.',p_quantity)else '' end,
   'quantityApplied',p_quantity);
end;
$bulk$;
revoke all on function public.use_current_team_inventory_items(uuid,uuid,integer) from public,anon;
grant execute on function public.use_current_team_inventory_items(uuid,uuid,integer) to authenticated;
revoke all on function public.redeem_current_daily_rewards(uuid,integer,uuid,text,text,uuid) from public,anon;
grant execute on function public.redeem_current_daily_rewards(uuid,integer,uuid,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
