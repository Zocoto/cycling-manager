-- ============================================================
-- Pistard, Trois poumons, Cyclocrossman et Métronome
-- Migration postérieure aux livraisons de production du 24 août.
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
      'first_in_class',
      'homegrown',
      'pistard',
      'three_lungs',
      'cyclocrossman',
      'metronome'
    )
  );

insert into public.special_ability_catalog (
  code,
  name,
  effect_description,
  icon_key,
  medallion_tone
)
values
  (
    'pistard',
    'Pistard',
    'Améliore le placement dans les sprints massifs, empêche de perdre la bonne roue et accorde un bonus décroissant sur les prologues et CLM jusqu’à 25 km.',
    'velodrome',
    'cobalt'
  ),
  (
    'three_lungs',
    'Trois poumons',
    'Réduit de 25 % la perte de forme provoquée par les courses et les entraînements, dans la limite de 4 points économisés par événement.',
    'lungs',
    'lime'
  ),
  (
    'cyclocrossman',
    'Cyclocrossman',
    'Accorde +3 de performance de terrain sur les pavés et les bosses courtes ou roulantes, et réduit de 20 % le risque de chute sur les pavés.',
    'cyclocross',
    'earth_sky'
  ),
  (
    'metronome',
    'Métronome',
    'Divise par deux les malus des mauvais jours de course sans réduire les bonus des bons jours.',
    'metronome',
    'iridescent'
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
values
  (
    'medallion-pistard',
    'Médaillon Pistard',
    'special_ability',
    'epic',
    'Un médaillon bleu électrique gravé comme les lignes inclinées d’un vélodrome.',
    'Placement renforcé au sprint et bonus sur les CLM courts.',
    '{"abilityCode":"pistard"}'::jsonb,
    'medallion',
    true
  ),
  (
    'medallion-three-lungs',
    'Médaillon Trois poumons',
    'special_ability',
    'epic',
    'Un médaillon vert acide dont les trois lobes semblent respirer au rythme du coureur.',
    'Réduit de 25 % les pertes de forme, avec un maximum de 4 points économisés.',
    '{"abilityCode":"three_lungs"}'::jsonb,
    'medallion',
    true
  ),
  (
    'medallion-cyclocrossman',
    'Médaillon Cyclocrossman',
    'special_ability',
    'epic',
    'Un médaillon mêlant le bleu du ciel et la terre des labours autour d’un pneu cranté.',
    'Bonus sur pavés et bosses courtes, avec moins de risques de chute sur les pavés.',
    '{"abilityCode":"cyclocrossman"}'::jsonb,
    'medallion',
    true
  ),
  (
    'medallion-metronome',
    'Médaillon Métronome',
    'special_ability',
    'epic',
    'Un médaillon irisé marqué par un balancier qui ne manque jamais une pulsation.',
    'Divise par deux les malus des mauvais jours de course.',
    '{"abilityCode":"metronome"}'::jsonb,
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

create or replace function public.apply_three_lungs_form_delta(
  p_rider_id uuid,
  p_form_delta numeric
)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when p_form_delta is null or p_form_delta >= 0 then p_form_delta
    when not exists (
      select 1
      from public.rider_special_abilities as ability
      where ability.rider_id = p_rider_id
        and ability.ability_code = 'three_lungs'
    ) then p_form_delta
    else -round(
      greatest(
        1,
        abs(p_form_delta) - least(abs(p_form_delta) * 0.25, 4)
      ),
      1
    )
  end;
$$;

-- L’économie intervient sur le coût brut de l’entraînement, avant la
-- protection forfaitaire du kiné.
do $migration$
declare
  v_definition text;
  v_marker constant text := 'if v_form_delta < 0 and v_physio_level > 0 then';
  v_marker_count integer;
begin
  select pg_get_functiondef(
    'public.settle_due_training_sessions()'::regprocedure
  ) into v_definition;

  if position('apply_three_lungs_form_delta(v_rider.id' in v_definition) = 0 then
    v_marker_count := (
      length(v_definition) - length(replace(v_definition, v_marker, ''))
    ) / length(v_marker);

    if v_marker_count <> 1 then
      raise exception
        'Point d’intégration de Trois poumons à l’entraînement inattendu (% marqueurs).',
        v_marker_count;
    end if;

    v_definition := replace(
      v_definition,
      v_marker,
      'v_form_delta := public.apply_three_lungs_form_delta(v_rider.id, v_form_delta);'
        || chr(10) || chr(10) || '        ' || v_marker
    );
    execute v_definition;
  end if;
end;
$migration$;

-- La course applique ensuite le kiné puis la cryothérapie. La variable
-- d’origine est recalée après le médaillon pour ne pas attribuer son économie
-- au kiné dans les rapports.
do $migration$
declare
  v_definition text;
  v_marker constant text :=
    'v_physio_level:=public.get_active_rider_physiotherapist_level(v_team_id,new.rider_id);';
  v_marker_count integer;
begin
  select pg_get_functiondef(
    'public.apply_assigned_physio_to_race_condition()'::regprocedure
  ) into v_definition;

  if position('apply_three_lungs_form_delta(new.rider_id' in v_definition) = 0 then
    v_marker_count := (
      length(v_definition) - length(replace(v_definition, v_marker, ''))
    ) / length(v_marker);

    if v_marker_count <> 1 then
      raise exception
        'Point d’intégration de Trois poumons après course inattendu (% marqueurs).',
        v_marker_count;
    end if;

    v_definition := replace(
      v_definition,
      v_marker,
      'new.form_delta:=public.apply_three_lungs_form_delta(new.rider_id,new.form_delta);'
        || chr(10) || '  v_original:=new.form_delta;'
        || chr(10) || '  ' || v_marker
    );
    execute v_definition;
  end if;
end;
$migration$;

revoke all on function public.apply_three_lungs_form_delta(uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.apply_three_lungs_form_delta(uuid, numeric)
  to service_role;

comment on function public.apply_three_lungs_form_delta(uuid, numeric) is
  'Réduit de 25 % une perte brute de forme pour Trois poumons, avec un plancher de 1 et au maximum 4 points économisés.';

comment on function public.settle_due_training_sessions() is
  'Règle les séances quotidiennes et applique les capacités de progression ou de préservation de forme.';

notify pgrst, 'reload schema';

commit;
