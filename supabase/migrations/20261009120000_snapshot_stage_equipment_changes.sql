begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Save the small receipt with the homologated result too: national races use
-- the results-only engine and do not keep a replay scenario. Existing results
-- remain NULL rather than guessing historic equipment from today's inventory.
alter table public.stage_results add column equipment_snapshot jsonb;
comment on column public.stage_results.equipment_snapshot is
  'Montage spécifique et bonus de notes du scénario homologué, jamais recalculés depuis le matériel courant.';

-- Extend only the JSON projection; keep the existing serialization, security
-- and sporting-result behavior byte-for-byte. Refuse an unexpected definition.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.replace_official_stage_results(uuid,jsonb)'::regprocedure)
    into v_definition;
  if position('    injury_id,' in v_definition) = 0
    or position('    payload.injury_id,' in v_definition) = 0
    or position('    injury_id uuid,' in v_definition) = 0 then
    raise exception 'Unexpected official result writer; review before adding equipment receipts.';
  end if;
  v_definition := replace(v_definition, '    injury_id,', '    injury_id, equipment_snapshot,');
  v_definition := replace(v_definition, '    payload.injury_id,', '    payload.injury_id, payload.equipment_snapshot,');
  v_definition := replace(v_definition, '    injury_id uuid,', '    injury_id uuid, equipment_snapshot jsonb,');
  execute v_definition;
end;
$migration$;

-- Add display-only provenance to the existing effect payloads. The signature,
-- grants, sporting bonuses, partner resolution and pagination remain unchanged.
-- An explicit empty slot is a zero-effect sentinel, not inherited equipment.
create or replace function public.get_active_calendar_stage_equipment_effects(
  p_race_edition_ids uuid[] default null
)
returns table (
  race_edition_id uuid,
  stage_id uuid,
  rider_id uuid,
  team_id uuid,
  equipment_effects jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select edition.id, stage.id, roster.rider_id, team_season.team_id,
    coalesce(equipment.effects, '[]'::jsonb)
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id and season.status = 'active'
  join public.stages as stage
    on stage.race_edition_id = edition.id and stage.status <> 'cancelled'
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
    and roster.status in ('selected', 'confirmed')
  join public.team_seasons as team_season on team_season.id = registration.team_season_id
  left join lateral (
    select jsonb_agg(resolved.effect_payload order by resolved.slot_type) as effects
    from (
      select slot.slot_type,
        coalesce(case
          when item.acquisition_channel in ('commercial', 'event_reward') then item.effect_payload
          else partner_effect.effect_payload
        end, '{}'::jsonb)
        || jsonb_build_object('_slotType', slot.slot_type)
        || case when planned.id is not null
          and planned.equipment_item_id is distinct from permanent.equipment_item_id
          then jsonb_build_object(
            '_stageSpecific', true,
            '_equipmentItemId', item.id,
            '_equipmentName', item.name,
            '_permanentEffect', coalesce(case
              when permanent_item.acquisition_channel in ('commercial', 'event_reward') then permanent_item.effect_payload
              else permanent_partner_effect.effect_payload
            end, '{}'::jsonb)
          ) else '{}'::jsonb end as effect_payload
      from (values
        ('helmet'), ('gloves'), ('bib_shorts'), ('glasses'), ('shoes'),
        ('front_wheel'), ('rear_wheel'), ('frame')
      ) as slot(slot_type)
      left join public.race_stage_equipment_assignments as planned
        on planned.stage_id = stage.id
        and planned.team_season_id = registration.team_season_id
        and planned.rider_id = roster.rider_id
        and planned.slot_type = slot.slot_type
      left join public.rider_equipment_assignments as permanent
        on permanent.rider_id = roster.rider_id and permanent.slot_type = slot.slot_type
      left join public.equipment_catalog_items as item
        on item.id = case when planned.id is not null then planned.equipment_item_id
          else permanent.equipment_item_id end
        and item.status = 'active'
      left join public.equipment_catalog_items as permanent_item
        on planned.id is not null
        and planned.equipment_item_id is distinct from permanent.equipment_item_id
        and permanent_item.id = permanent.equipment_item_id
        and permanent_item.status = 'active'
      left join lateral (
        select effect.effect_payload
        from public.equipment_partner_item_effects as effect
        join public.equipment_partner_contracts as contract
          on contract.id = effect.contract_id
          and contract.team_id = team_season.team_id
          and contract.supplier_key = item.supplier_key
          and contract.status = 'active'
        join public.seasons as contract_start on contract_start.id = contract.start_season_id
        join public.seasons as contract_end on contract_end.id = contract.end_season_id
        where effect.equipment_item_id = item.id
          and season.game_year between contract_start.game_year and contract_end.game_year
        limit 1
      ) as partner_effect on true
      left join lateral (
        select effect.effect_payload
        from public.equipment_partner_item_effects as effect
        join public.equipment_partner_contracts as contract
          on contract.id = effect.contract_id
          and contract.team_id = team_season.team_id
          and contract.supplier_key = permanent_item.supplier_key
          and contract.status = 'active'
        join public.seasons as contract_start on contract_start.id = contract.start_season_id
        join public.seasons as contract_end on contract_end.id = contract.end_season_id
        where effect.equipment_item_id = permanent_item.id
          and season.game_year between contract_start.game_year and contract_end.game_year
        limit 1
      ) as permanent_partner_effect on true
      where item.acquisition_channel in ('commercial', 'event_reward')
        or partner_effect.effect_payload is not null
        or (planned.id is not null and planned.equipment_item_id is null)
    ) as resolved
  ) as equipment on true
  where edition.status <> 'cancelled'
    and (p_race_edition_ids is null or edition.id = any(p_race_edition_ids))
  order by edition.id, stage.stage_number, team_season.id, roster.rider_id;
$$;

comment on function public.get_active_calendar_stage_equipment_effects(uuid[]) is
  'Effets effectifs par étape, avec provenance du montage spécifique pour figer ses bonus dans le scénario officiel. Aucun changement des bonus sportifs.';
notify pgrst, 'reload schema';
commit;
