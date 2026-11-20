begin;
set local application_name = 'nail-layer-crowd-surge-install';
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

do $extend_catalog$
declare
  v_constraint text;
begin
  select pg_get_expr(conbin, conrelid) into v_constraint
  from pg_constraint
  where conrelid = 'public.special_ability_catalog'::regclass
    and conname = 'special_ability_catalog_code_allowed' and contype = 'c';

  if v_constraint is null or strpos(v_constraint, '''locker_room_favorite''') = 0 then
    raise exception 'Unexpected special ability catalogue constraint.';
  end if;
  alter table public.special_ability_catalog drop constraint special_ability_catalog_code_allowed;
  execute format(
    'alter table public.special_ability_catalog add constraint special_ability_catalog_code_allowed check ((%s) or code in (''nail_layer'', ''crowd_surge''))',
    v_constraint
  );
end;
$extend_catalog$;

insert into public.special_ability_catalog (
  code, name, effect_description, icon_key, medallion_tone
) values
(
  'nail_layer',
  'Poseur de clous',
  'Une échappée installée donne 20 % de chance de provoquer une crevaison chez un poursuivant. Une seule tentative par étape.',
  'nails',
  'anthracite'
),
(
  'crowd_surge',
  'Coup de pression',
  'Sur le secteur décisif, gagne jusqu’à +4 de performance selon sa popularité (+6 avec un car de supporters).',
  'beer_mug',
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
select
  case ability.code when 'nail_layer' then 'medallion-nail-layer' else 'medallion-crowd-surge' end,
  'Médaillon ' || ability.name,
  'special_ability',
  'epic',
  case ability.code
    when 'nail_layer' then 'Un médaillon anthracite gravé de clous croisés.'
    else 'Un médaillon ambré gravé d’une pinte de bière.'
  end,
  ability.effect_description,
  jsonb_build_object('abilityCode', ability.code),
  'medallion',
  true
from public.special_ability_catalog as ability
where ability.code in ('nail_layer', 'crowd_surge')
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

notify pgrst, 'reload schema';
commit;

