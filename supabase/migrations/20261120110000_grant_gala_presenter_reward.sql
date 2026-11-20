begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Owner-requested one-off gift for the S4 Gala presenter.
-- The private mailbox source is the durable receipt, even after using the gifts.
do $grant$
declare
  director_id constant uuid := '14243193-46f6-4003-8b7b-8da292baba14';
  gift_reference constant text := 'gala-s4:presenter-reward';
  target record;
  album record;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('gala-s4:presenter-reward:14243193-46f6-4003-8b7b-8da292baba14', 0)
  );

  if exists (
    select 1 from public.sporting_director_messages as message
    where message.sporting_director_id = director_id
      and message.source_reference = gift_reference
  ) then
    return;
  end if;

  select director.id, season.id as season_id, team_season.id as team_season_id
  into strict target
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.team_seasons as team_season on team_season.team_id = assignment.team_id
    and team_season.status in ('active', 'planned')
  join public.seasons as season on season.id = team_season.season_id and season.status = 'active'
  where director.id = director_id
    and director.auth_user_id = 'ee244935-5722-4626-a28f-dc3cf63aa6f4'
    and director.username = 'gouilleTW' and director.status = 'active'
  for update of team_season;

  select edition.edition_id, edition.collection_season_id
  into strict album
  from public.cyclo_stickers_editions as edition
  join public.seasons as source on source.id = edition.source_season_id
    and source.game_year = 4 and source.status = 'completed'
  join public.seasons as collection on collection.id = edition.collection_season_id and collection.game_year = 5
  where edition.configuration->>'enabled' = 'true'
    and edition.configuration->>'publicApproved' = 'true';

  insert into public.equipment_catalog_items (
    catalog_key, name, slot_type, status, supplier_key, supplier_name, description,
    price, rarity, image_path, effect_summary, effect_payload, acquisition_channel
  ) values (
    'gala-s4-presenter-gloves', 'Gants · Maître de cérémonie', 'gloves', 'active',
    'gala-saison-4', 'Grand Gala · Saison 4', 'Distinction de l’animateur du Grand Gala de la saison 4.',
    0, 'premium', '/images/equipment/products/montclair-podium-atelier.webp',
    '+2 VAL et +1 DES', '{"ratingBonuses":{"hills":2,"downhill":1}}', 'event_reward'
  ), (
    'gala-s4-presenter-helmet', 'Casque · Voix du Gala', 'helmet', 'active',
    'gala-saison-4', 'Grand Gala · Saison 4', 'Distinction de l’animateur du Grand Gala de la saison 4.',
    0, 'premium', '/images/equipment/products/aerion-stratos-pro.webp',
    '+1 SPR, +1 ACC et +1 END', '{"ratingBonuses":{"sprint":1,"acceleration":1,"endurance":1}}', 'event_reward'
  )
  on conflict (catalog_key) do nothing;

  if (select count(*) from public.equipment_catalog_items
    where (catalog_key = 'gala-s4-presenter-gloves'
        and slot_type = 'gloves' and effect_payload = '{"ratingBonuses":{"hills":2,"downhill":1}}'::jsonb
      or catalog_key = 'gala-s4-presenter-helmet'
        and slot_type = 'helmet' and effect_payload = '{"ratingBonuses":{"sprint":1,"acceleration":1,"endurance":1}}'::jsonb)
      and status = 'active' and acquisition_channel = 'event_reward') <> 2 then
    raise exception 'Unexpected Gala presenter equipment.';
  end if;

  insert into public.team_equipment_inventory (
    team_season_id, equipment_item_id, quantity, last_purchase_price
  )
  select target.team_season_id, item.id, 1, 0
  from public.equipment_catalog_items as item
  where item.catalog_key in ('gala-s4-presenter-gloves', 'gala-s4-presenter-helmet')
  on conflict (team_season_id, equipment_item_id) do update
    set quantity = public.team_equipment_inventory.quantity + 1, updated_at = now();

  insert into public.cyclo_stickers_boosters (
    sporting_director_id, collection_season_id, acquisition_source, source_reference, awarded_on
  )
  select director_id, album.collection_season_id, 'gala_presenter',
    'gala-s4:presenter-reward:' || copy.number, (now() at time zone 'Europe/Paris')::date
  from generate_series(1, 3) as copy(number)
  on conflict (sporting_director_id, acquisition_source, source_reference) do nothing;

  if (select count(*) from public.cyclo_stickers_boosters as booster
    where booster.sporting_director_id = director_id
      and booster.acquisition_source = 'gala_presenter'
      and booster.source_reference in (
        'gala-s4:presenter-reward:1', 'gala-s4:presenter-reward:2', 'gala-s4:presenter-reward:3'
      )
      and booster.collection_season_id = album.collection_season_id) <> 3 then
    raise exception 'Incomplete Gala presenter booster gift.';
  end if;

  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type,
    sender_name, subject, preview, body, action_href, action_label, source_reference, is_important
  ) values (
    director_id, target.season_id, target.team_season_id, 'system',
    'Organisation du Grand Gala',
    'Merci pour l’animation du Grand Gala !',
    '3 boosters et 2 pièces exclusives pour remercier l’animateur.',
    E'Gouille,\n\nMerci d’avoir animé le Grand Gala de la saison 4 et fait vivre les courses à la communauté !\n\nPour saluer ton implication, nous t’offrons une gratification spéciale, en complément du cadeau spectateur :\n\n• 3 boosters de l’album Cyclo-Stickers consacré à la saison 4, disponibles dans ton album.\n• Gants « Maître de cérémonie » : +2 VAL et +1 DES.\n• Casque « Voix du Gala » : +1 SPR, +1 ACC et +1 END.\n\nLes deux équipements ont rejoint le stock de Cidrerie de l’Aulne et peuvent être affectés à tes coureurs depuis la rubrique Matériel.\n\nMerci pour cette soirée et pour ton engagement auprès du peloton !\n\nL’équipe Cyclo Stratège',
    '/jeu/materiel', 'Voir mon matériel', gift_reference, true
  );
end;
$grant$;

commit;
