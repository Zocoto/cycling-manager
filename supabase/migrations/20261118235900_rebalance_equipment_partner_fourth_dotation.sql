begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Purchases lock the contract before reading the catalogue and copying its effects.
-- Keep reads available while the catalogue and active grants are aligned.
lock table public.equipment_partner_contracts in exclusive mode;

do $migration$
declare
  accessory record;
  item_id uuid;
begin
  for accessory in
    select * from (values
      ('altura-forge', 'partner-altura-aeropeak-helmet', 'helmet',
        '+1 MON, +2 REC et +1 DES.', '{"mountain":1,"recovery":2,"downhill":1}'::jsonb),
      ('vektor-aerolab', 'partner-vektor-phase-helmet', 'helmet',
        '+1 CLM, +1 PLA et +2 PRL.', '{"timeTrial":1,"flat":1,"prologue":2}'::jsonb),
      ('brava-sprintworks', 'partner-brava-fulgor-shoes', 'shoes',
        '+1 SPR, +2 ACC et +1 PLA.', '{"sprint":1,"acceleration":2,"flat":1}'::jsonb),
      ('kernwerk-cycling', 'partner-kernwerk-granit-gloves', 'gloves',
        '+1 PAV, +2 RES et +1 END.', '{"cobbles":1,"resistance":2,"endurance":1}'::jsonb),
      ('sylva-dynamics', 'partner-sylva-apex-glasses', 'glasses',
        '+1 VAL, +1 ACC, +1 BAR et +1 DES.', '{"hills":1,"acceleration":1,"breakaway":1,"downhill":1}'::jsonb),
      ('meridian-endurance', 'partner-meridian-distance-bib', 'bib_shorts',
        '+2 END, +1 REC et +1 RES.', '{"endurance":2,"recovery":1,"resistance":1}'::jsonb),
      ('axiom-allroad', 'partner-axiom-union-shoes', 'shoes',
        '+1 PLA, +1 VAL, +1 MON et +1 ACC.', '{"flat":1,"hills":1,"mountain":1,"acceleration":1}'::jsonb)
    ) as rebalance(supplier_key, catalog_key, slot_type, effect_summary, bonuses)
  loop
    select item.id into strict item_id
    from public.equipment_catalog_items as item
    join public.equipment_partner_products as product
      on product.equipment_item_id = item.id
      and product.supplier_key = accessory.supplier_key
      and product.offer_type = 'rare'
    where item.catalog_key = accessory.catalog_key
      and item.supplier_key = accessory.supplier_key
      and item.acquisition_channel = 'equipment_partner'
      and item.slot_type = accessory.slot_type;

    update public.equipment_catalog_items as item
    set effect_summary = accessory.effect_summary,
        effect_payload = jsonb_set(item.effect_payload, '{ratingBonuses}', accessory.bonuses),
        updated_at = now()
    where item.id = item_id
      and (item.effect_summary is distinct from accessory.effect_summary
        or item.effect_payload->'ratingBonuses' is distinct from accessory.bonuses);

    update public.equipment_partner_item_effects as effect
    set effect_payload = jsonb_set(effect.effect_payload, '{ratingBonuses}', accessory.bonuses),
        revision = effect.revision + 1,
        updated_at = now()
    from public.equipment_partner_contracts as contract
    where effect.equipment_item_id = item_id
      and contract.id = effect.contract_id
      and contract.supplier_key = accessory.supplier_key
      and contract.status = 'active'
      and contract.reputation_extra_item_id = effect.equipment_item_id
      and effect.effect_payload->'ratingBonuses' is distinct from accessory.bonuses;
  end loop;
end;
$migration$;

commit;
