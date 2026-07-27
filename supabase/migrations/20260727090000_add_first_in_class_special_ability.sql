-- ============================================================
-- Capacité Premier de la classe : +50 % de progression à l'entraînement
-- ============================================================

begin;

alter table public.special_ability_catalog
  drop constraint if exists special_ability_catalog_code_allowed;

alter table public.special_ability_catalog
  add constraint special_ability_catalog_code_allowed check (
    code in (
      'flahute',
      'panache',
      'bottle_carrier',
      'locomotive',
      'giclette',
      'chase_potato',
      'sandwich_man',
      'iron_health',
      'first_in_class'
    )
  );

insert into public.special_ability_catalog (
  code,
  name,
  effect_description,
  icon_key,
  medallion_tone
)
values (
  'first_in_class',
  'Premier de la classe',
  'Accorde +50 % de progression des caractéristiques lors des entraînements.',
  'ruler',
  'teal'
)
on conflict (code) do update set
  name = excluded.name,
  effect_description = excluded.effect_description,
  icon_key = excluded.icon_key,
  medallion_tone = excluded.medallion_tone,
  is_active = true;

insert into public.inventory_catalog_items (
  item_key,
  name,
  category,
  rarity,
  description,
  effect_summary,
  effect_payload,
  icon_key,
  is_consumable
)
values (
  'medallion-first-in-class',
  'Médaillon Premier de la classe',
  'special_ability',
  'epic',
  'Un médaillon bleu pétrole orné d’une règle d’écolier.',
  'Accorde +50 % de progression des caractéristiques à l’entraînement.',
  '{"abilityCode":"first_in_class"}'::jsonb,
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

create or replace function public.get_rider_training_progress_multiplier(
  p_rider_id uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.rider_special_abilities as ability
      where ability.rider_id = p_rider_id
        and ability.ability_code = 'first_in_class'
    ) then 1.5
    else 1.0
  end::numeric;
$$;

do $migration$
declare
  v_definition text;
  v_updated_definition text;
  v_marker constant text := '* v_trainer_factor';
  v_marker_count integer;
begin
  select pg_get_functiondef(
    'public.settle_due_training_sessions()'::regprocedure
  )
  into v_definition;

  v_marker_count :=
    (
      length(v_definition)
      - length(replace(v_definition, v_marker, ''))
    ) / length(v_marker);

  if v_marker_count <> 1 then
    raise exception
      'Impossible d''ajouter Premier de la classe : formule d''entraînement inattendue (% marqueurs).',
      v_marker_count;
  end if;

  v_updated_definition := replace(
    v_definition,
    v_marker,
    v_marker || E'\n            * public.get_rider_training_progress_multiplier(v_rider.id)'
  );

  execute v_updated_definition;
end;
$migration$;

revoke all on function public.get_rider_training_progress_multiplier(uuid)
  from public;
grant execute on function public.settle_due_training_sessions()
  to authenticated, service_role;

comment on function public.get_rider_training_progress_multiplier(uuid) is
  'Retourne 1,5 pour Premier de la classe, sinon 1 ; ne modifie ni la forme ni le déclin.';
comment on function public.settle_due_training_sessions() is
  'Règle les séances quotidiennes, dont le bonus de progression Premier de la classe.';

notify pgrst, 'reload schema';

commit;
