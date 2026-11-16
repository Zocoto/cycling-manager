begin;
set local lock_timeout = '2s';
set local statement_timeout = '10s';

do $migration$
declare
  v_validator record;
  v_definition text;
  v_core_predicate constant text := 'product.offer_type = ''core''';
begin
  -- Keep the current validators and their other equipment rules. The paid
  -- item belongs to this contract alone, just like its standard dotation.
  for v_validator in
    select * from (values
      ('public.equip_current_team_rider(uuid,text,uuid)', 'partner_contract'),
      ('public.save_current_team_equipment_assignments(jsonb)', 'partner_contract'),
      ('public.save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)', 'contract')
    ) as validators(signature, contract_alias)
  loop
    v_definition := pg_get_functiondef(v_validator.signature::regprocedure);
    if length(v_definition) - length(replace(v_definition, v_core_predicate, ''))
       <> length(v_core_predicate) then
      raise exception 'Unexpected equipment eligibility definition for %', v_validator.signature;
    end if;

    execute replace(v_definition, v_core_predicate, format(
      '(%s or %I.reputation_extra_item_id = product.equipment_item_id)',
      v_core_predicate, v_validator.contract_alias
    ));
  end loop;
end;
$migration$;

-- The fourth dotations originally reused bicycle or wheel images.
update public.equipment_catalog_items as item
set image_path = '/images/equipment/products/' || accessory.image_file,
    updated_at = now()
from (values
  ('partner-altura-aeropeak-helmet', 'helmet', 'aerion-stratos-s1.webp'),
  ('partner-vektor-phase-helmet', 'helmet', 'aerion-vortex-tt.webp'),
  ('partner-brava-fulgor-shoes', 'shoes', 'velocita-scatto.webp'),
  ('partner-kernwerk-granit-gloves', 'gloves', 'korv-vinter-grip.webp'),
  ('partner-sylva-apex-glasses', 'glasses', 'aerion-prism-horizon.webp'),
  ('partner-meridian-distance-bib', 'bib_shorts', 'montclair-endurance-core.webp'),
  ('partner-axiom-union-shoes', 'shoes', 'montclair-alpine-lace.webp')
) as accessory(catalog_key, slot_type, image_file)
where item.catalog_key = accessory.catalog_key
  and item.acquisition_channel = 'equipment_partner'
  and item.slot_type = accessory.slot_type
  and item.image_path is distinct from '/images/equipment/products/' || accessory.image_file;

commit;
