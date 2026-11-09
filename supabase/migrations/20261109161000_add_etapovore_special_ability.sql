begin;
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

alter table public.special_ability_catalog
  drop constraint if exists special_ability_catalog_code_allowed,
  add constraint special_ability_catalog_code_allowed check (
    code in (
      'flahute', 'panache', 'bottle_carrier', 'locomotive', 'giclette',
      'chase_potato', 'sandwich_man', 'iron_health', 'first_in_class', 'homegrown',
      'pistard', 'three_lungs', 'cyclocrossman', 'metronome', 'etapovore'
    )
  );

insert into public.special_ability_catalog (code, name, effect_description, icon_key, medallion_tone)
values (
  'etapovore',
  'Étapovore',
  'Remplace le malus habituel par +0,5 point de moral par jour de course, dès le 31e de la saison.',
  'stage_course',
  'amber'
)
on conflict (code) do update set
  name = excluded.name,
  effect_description = excluded.effect_description,
  icon_key = excluded.icon_key,
  medallion_tone = excluded.medallion_tone,
  is_active = true;

insert into public.inventory_catalog_items (
  item_key, name, category, rarity, description, effect_summary, effect_payload, icon_key, is_consumable
)
values (
  'medallion-etapovore',
  'Médaillon Étapovore',
  'special_ability',
  'epic',
  'Un médaillon ambré gravé d’un profil d’étape et de son drapeau d’arrivée.',
  'Remplace le malus habituel par +0,5 point de moral par jour de course, dès le 31e de la saison.',
  '{"abilityCode":"etapovore"}'::jsonb,
  'medallion',
  true
)
on conflict (item_key) do update set
  name = excluded.name,
  category = excluded.category,
  rarity = excluded.rarity,
  description = excluded.description,
  effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload,
  icon_key = excluded.icon_key,
  is_consumable = excluded.is_consumable,
  status = 'active',
  updated_at = now();

commit;
