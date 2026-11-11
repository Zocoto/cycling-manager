begin;
set local application_name = 'cyclostratege-morale-consumables-20261111';
set local statement_timeout = '8s';
set local lock_timeout = '500ms';

-- Extend the existing rules without replacing previously allowed effects or
-- scanning the morale ledger under the schema lock.
do $allow_effect$
declare
  v_catalog_check text;
  v_morale_check text;
  v_morale_function text;
  v_source_anchor constant text := '''manual_adjustment''';
begin
  select pg_get_expr(conbin, conrelid) into v_catalog_check
  from pg_constraint
  where conrelid = 'public.daily_reward_catalog'::regclass
    and conname = 'daily_reward_catalog_effect_allowed' and contype = 'c';

  select pg_get_expr(conbin, conrelid) into v_morale_check
  from pg_constraint
  where conrelid = 'public.rider_morale_events'::regclass
    and conname = 'rider_morale_events_source_allowed' and contype = 'c';

  v_morale_function := pg_get_functiondef(
    'public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)'::regprocedure
  );
  if v_catalog_check is null or strpos(v_catalog_check, 'form_boost') = 0
    or v_morale_check is null or strpos(v_morale_check, 'manual_adjustment') = 0
    or strpos(v_catalog_check, '''morale_boost''') > 0
    or strpos(v_morale_check, '''consumable''') > 0
    or strpos(v_morale_function, '''consumable''') > 0
    or length(v_morale_function) - length(replace(v_morale_function, v_source_anchor, '')) <> length(v_source_anchor) then
    raise exception 'Unexpected morale consumable source or effect constraints.';
  end if;

  alter table public.daily_reward_catalog drop constraint daily_reward_catalog_effect_allowed;
  execute format(
    'alter table public.daily_reward_catalog add constraint daily_reward_catalog_effect_allowed check ((%s) or effect_kind = ''morale_boost'')',
    v_catalog_check
  );

  alter table public.rider_morale_events drop constraint rider_morale_events_source_allowed;
  execute format(
    'alter table public.rider_morale_events add constraint rider_morale_events_source_allowed check ((%s) or source_type = ''consumable'') not valid',
    v_morale_check
  );
  execute replace(v_morale_function, v_source_anchor, v_source_anchor || ', ''consumable''');
end;
$allow_effect$;

-- Apply the boost inside the existing redemption transaction, after ownership,
-- expiry and rider checks, before the same row is marked as used.
do $redeem_effect$
declare
  v_definition text;
  v_declaration constant text := '  v_message text;';
  v_branch constant text := '  elsif v_reward.effect_kind = ''rider_experience'' then';
  v_response constant text := '  return jsonb_build_object(''inventoryId'', p_inventory_id, ''message'', v_message);';
begin
  v_definition := replace(pg_get_functiondef(
    'public.redeem_current_daily_reward_without_high_performance_cap(uuid,uuid,text,text,uuid)'::regprocedure
  ), chr(13), '');
  if strpos(v_definition, '''morale_boost''') > 0
    or strpos(v_definition, 'for update of inventory;') = 0
    or length(v_definition) - length(replace(v_definition, v_declaration, '')) <> length(v_declaration)
    or length(v_definition) - length(replace(v_definition, v_branch, '')) <> length(v_branch)
    or length(v_definition) - length(replace(v_definition, v_response, '')) <> length(v_response) then
    raise exception 'Unexpected single daily reward redemption definition.';
  end if;

  v_definition := replace(v_definition, v_declaration, v_declaration || E'\n  v_morale_result jsonb;');
  v_definition := replace(v_definition, v_branch, $branch$  elsif v_reward.effect_kind = 'morale_boost' then
    perform 1
    from public.riders as rider
    join public.rider_contracts as contract
      on contract.rider_id = rider.id
      and contract.team_id = v_context.team_id
      and contract.status = 'active'
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
      and start_season.game_year <= v_context.game_year
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
      and end_season.game_year >= v_context.game_year
    where rider.id = p_rider_id and rider.status = 'active'
    for share of contract;
    if not found then
      raise exception 'Sélectionnez un coureur professionnel de votre équipe.';
    end if;

    v_amount := (v_reward.effect_payload ->> 'amount')::integer;
    if v_amount is null or v_amount not between 1 and 100 then
      raise exception 'Les données de ce cadeau sont invalides.';
    end if;
    v_morale_result := public.apply_rider_morale_event(
      p_rider_id, v_context.season_day_id, 'consumable',
      'daily-reward:' || p_inventory_id::text, v_amount, v_reward.name,
      jsonb_build_object('rewardKey', v_reward.reward_key, 'inventoryId', p_inventory_id, 'teamId', v_context.team_id)
    );
    v_message := format('Moral +%s · %s/100.',
      trim_scale((v_morale_result ->> 'appliedDelta')::numeric),
      trim_scale((v_morale_result ->> 'moraleAfter')::numeric)
    );
$branch$ || v_branch);
  v_definition := replace(v_definition, v_response, $response$  if v_morale_result is not null then
    return jsonb_build_object(
      'inventoryId', p_inventory_id, 'message', v_message,
      'moraleAppliedDelta', (v_morale_result ->> 'appliedDelta')::numeric,
      'moraleAfter', (v_morale_result ->> 'moraleAfter')::numeric
    );
  end if;

$response$ || v_response);
  execute v_definition;
end;
$redeem_effect$;

do $stack_effect$
declare
  v_definition text;
  v_declaration constant text := '  v_result jsonb;';
  v_stackable constant text := E'    ''form_boost'',\n    ''rider_experience'',';
  v_loop_end constant text := E'      p_race_edition_id\n    );\n  end loop;';
  v_response constant text := E'  return jsonb_build_object(\n    ''inventoryId'', p_inventory_id,\n    ''quantityApplied'', p_quantity,';
begin
  v_definition := replace(pg_get_functiondef(
    'public.redeem_current_daily_rewards(uuid,integer,uuid,text,text,uuid)'::regprocedure
  ), chr(13), '');
  if strpos(v_definition, '''morale_boost''') > 0
    or length(v_definition) - length(replace(v_definition, v_declaration, '')) <> length(v_declaration)
    or length(v_definition) - length(replace(v_definition, v_stackable, '')) <> length(v_stackable)
    or length(v_definition) - length(replace(v_definition, v_loop_end, '')) <> length(v_loop_end)
    or length(v_definition) - length(replace(v_definition, v_response, '')) <> length(v_response) then
    raise exception 'Unexpected bulk daily reward redemption definition.';
  end if;

  v_definition := replace(v_definition, v_declaration, v_declaration || E'\n  v_morale_total numeric := 0;');
  v_definition := replace(v_definition, v_stackable, E'    ''morale_boost'',\n' || v_stackable);
  v_definition := replace(v_definition, v_loop_end, $loop$      p_race_edition_id
    );
    if v_reward.effect_kind = 'morale_boost' then
      v_morale_total := v_morale_total + (v_result ->> 'moraleAppliedDelta')::numeric;
    end if;
  end loop;$loop$);
  v_definition := replace(v_definition, v_response, $response$  if v_reward.effect_kind = 'morale_boost' then
    return jsonb_build_object(
      'inventoryId', p_inventory_id, 'quantityApplied', p_quantity,
      'moraleAppliedDelta', v_morale_total,
      'moraleAfter', (v_result ->> 'moraleAfter')::numeric,
      'message', format('Moral +%s · %s/100.',
        trim_scale(v_morale_total), trim_scale((v_result ->> 'moraleAfter')::numeric))
    );
  end if;

$response$ || v_response);
  execute v_definition;
end;
$stack_effect$;

do $target_values$
declare
  v_definition text;
  v_read constant text := '    select condition.form';
  v_value constant text := '        ''form'', coalesce(current_condition.form, 75),';
begin
  v_definition := replace(pg_get_functiondef(
    'public.get_current_team_item_target_values()'::regprocedure
  ), chr(13), '');
  if strpos(v_definition, '''morale''') > 0
    or length(v_definition) - length(replace(v_definition, v_read, '')) <> length(v_read)
    or length(v_definition) - length(replace(v_definition, v_value, '')) <> length(v_value) then
    raise exception 'Unexpected rider targets definition for morale consumables.';
  end if;

  v_definition := replace(v_definition, v_read, v_read || ', condition.morale');
  execute replace(v_definition, v_value, v_value || E'\n        ''morale'', coalesce(current_condition.morale, 60),');
end;
$target_values$;

insert into public.daily_reward_catalog (
  reward_key, name, description, effect_summary, importance, effect_kind,
  effect_payload, icon_key, is_active
)
values
  ('morale_boost_5', 'Mot d’encouragement',
    'Un mot du DS pour remonter le moral du coureur de votre choix.',
    '+5 points de moral pour un coureur', 3, 'morale_boost', '{"amount":5,"level":3}'::jsonb, 'morale', true),
  ('morale_boost_10', 'Discours de motivation',
    'Un discours du DS pour redonner confiance au coureur de votre choix.',
    '+10 points de moral pour un coureur', 5, 'morale_boost', '{"amount":10,"level":5}'::jsonb, 'morale', true);

notify pgrst, 'reload schema';
commit;
