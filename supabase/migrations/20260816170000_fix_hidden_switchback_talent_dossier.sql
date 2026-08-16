-- ============================================================
-- Le Dossier de talent classifié promet +1 étoile, mais son payload initial
-- indiquait 2 étoiles. Corrige le catalogue et retire l'étoile excédentaire
-- aux coureurs ayant déjà reçu cet objet avant le correctif.
-- ============================================================

begin;

do $migration$
declare
  v_inventory_item_id uuid;
begin
  select item.id
  into v_inventory_item_id
  from public.inventory_catalog_items as item
  where item.item_key = 'classified-talent-dossier'
  for update;

  if v_inventory_item_id is null then
    raise exception 'Le Dossier de talent classifié est introuvable.';
  end if;

  with affected_riders as (
    select
      application.rider_id,
      count(*)::integer as application_count
    from public.rider_consumable_item_applications as application
    where application.inventory_item_id = v_inventory_item_id
      and application.category = 'potential_boost'
      and application.potential_bonus = 4
    group by application.rider_id
  )
  update public.riders as rider
  set potential_steps = greatest(
    1,
    rider.potential_steps - affected.application_count * 2
  )::smallint
  from affected_riders as affected
  where rider.id = affected.rider_id;

  update public.rider_consumable_item_applications as application
  set potential_bonus = 2
  where application.inventory_item_id = v_inventory_item_id
    and application.category = 'potential_boost'
    and application.potential_bonus = 4;

  update public.inventory_catalog_items
  set
    effect_summary = '+1 étoile de talent au coureur sélectionné.',
    effect_payload = jsonb_set(
      coalesce(effect_payload, '{}'::jsonb),
      '{potentialBonus}',
      '1'::jsonb,
      true
    ),
    updated_at = now()
  where id = v_inventory_item_id;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
