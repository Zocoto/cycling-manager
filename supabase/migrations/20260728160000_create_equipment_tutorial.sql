-- Didacticiel Matériel : cadeau de bienvenue unique et idempotent.

begin;

insert into public.equipment_catalog_items (
  catalog_key,
  name,
  slot_type,
  status,
  supplier_key,
  supplier_name,
  description,
  price,
  rarity,
  image_path,
  effect_summary,
  effect_payload,
  acquisition_channel
)
values (
  'tutorial-welcome-glasses',
  'Lunettes didactiques',
  'glasses',
  'active',
  'cyclostrategie-academy',
  'Académie Cyclostratège',
  'Une paire de lunettes offerte pendant le didacticiel pour découvrir l’équipement individuel des coureurs.',
  0,
  'common',
  '/images/equipment/products/aerion-prism-clearline.webp',
  '+1 END.',
  '{"ratingBonuses":{"endurance":1}}'::jsonb,
  'commercial'
)
on conflict (catalog_key) do update set
  name = excluded.name,
  slot_type = excluded.slot_type,
  status = excluded.status,
  supplier_key = excluded.supplier_key,
  supplier_name = excluded.supplier_name,
  description = excluded.description,
  price = excluded.price,
  rarity = excluded.rarity,
  image_path = excluded.image_path,
  effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload,
  acquisition_channel = excluded.acquisition_channel,
  updated_at = now();

create or replace function public.grant_equipment_tutorial_welcome_gift()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_director_id uuid;
  v_progress_id uuid;
  v_progress_metadata jsonb;
  v_team_season_id uuid;
  v_equipment_item_id uuid;
begin
  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
  limit 1;

  if v_director_id is null then
    raise exception 'Aucun Directeur Sportif authentifié.';
  end if;

  select progress.id, progress.metadata
  into v_progress_id, v_progress_metadata
  from public.tutorial_progress as progress
  where progress.sporting_director_id = v_director_id
    and progress.tutorial_key = 'equipment'
  for update;

  if v_progress_id is null then
    raise exception 'Le didacticiel Matériel doit être démarré avant de recevoir le cadeau.';
  end if;

  if coalesce(v_progress_metadata ->> 'welcomeGiftGranted', 'false') = 'true' then
    return false;
  end if;

  select team_season.id
  into v_team_season_id
  from public.team_manager_assignments as assignment
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where assignment.sporting_director_id = v_director_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  limit 1
  for update of team_season;

  if v_team_season_id is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select item.id
  into v_equipment_item_id
  from public.equipment_catalog_items as item
  where item.catalog_key = 'tutorial-welcome-glasses'
    and item.status = 'active'
  for share;

  if v_equipment_item_id is null then
    raise exception 'Les Lunettes didactiques sont introuvables.';
  end if;

  insert into public.team_equipment_inventory (
    team_season_id,
    equipment_item_id,
    quantity,
    last_purchase_price
  )
  values (
    v_team_season_id,
    v_equipment_item_id,
    1,
    0
  )
  on conflict (team_season_id, equipment_item_id) do update set
    quantity = public.team_equipment_inventory.quantity + 1,
    last_purchase_price = 0,
    updated_at = now();

  update public.tutorial_progress
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'welcomeGiftGranted', true,
    'welcomeGiftCatalogKey', 'tutorial-welcome-glasses',
    'welcomeGiftGrantedAt', now()
  )
  where id = v_progress_id;

  return true;
end;
$$;

comment on function public.grant_equipment_tutorial_welcome_gift() is
  'Accorde une seule fois les Lunettes didactiques au premier lancement du didacticiel Matériel.';

revoke all on function public.grant_equipment_tutorial_welcome_gift() from public;
grant execute on function public.grant_equipment_tutorial_welcome_gift() to authenticated;

notify pgrst, 'reload schema';

commit;
