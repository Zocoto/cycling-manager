begin;
set local lock_timeout = '500ms';
set local statement_timeout = '8s';
set local application_name = 'cyclostratege-callup-refusal-morale-20261106';

-- Extend the existing persistent ledgers, retaining every previously allowed
-- source (notably race_load). Do not scan or rewrite historical morale events.
do $sources$
declare v_patch record; v_definition text; v_expression text; v_anchor text := '''manual_adjustment''';
begin
  for v_patch in select * from (values
    ('public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)',
      'rider_morale_events', 'rider_morale_events_source_allowed'),
    ('public.apply_youth_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)',
      'youth_rider_morale_events', 'youth_rider_morale_events_source_allowed')
  ) patches(signature, table_name, constraint_name)
  loop
    v_definition := replace(pg_get_functiondef(v_patch.signature::regprocedure), chr(13), '');
    select pg_get_expr(conbin, conrelid) into v_expression from pg_constraint
      where conrelid = ('public.' || v_patch.table_name)::regclass and conname = v_patch.constraint_name;
    if v_expression is null or position('manual_adjustment' in v_expression) = 0
      or (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
      or position('international_callup_refusal' in v_definition) > 0 then
      raise exception 'Unexpected morale source definition: %.', v_patch.signature;
    end if;
    execute replace(v_definition, v_anchor, v_anchor || ', ''international_callup_refusal''');
    execute format('alter table public.%I drop constraint %I', v_patch.table_name, v_patch.constraint_name);
    -- Previously validated rows already satisfy v_expression. NOT VALID avoids
    -- a table scan under the schema lock, while enforcing the superset on writes.
    execute format('alter table public.%I add constraint %I check ((%s) or source_type = ''international_callup_refusal'') not valid',
      v_patch.table_name, v_patch.constraint_name, v_expression);
  end loop;
end;
$sources$;

create function private.apply_international_callup_refusal_morale(
  p_rider_id uuid, p_academy_rider_id uuid, p_race_edition_id uuid,
  p_description text, p_metadata jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_day_id uuid; v_reference text;
begin
  if (p_rider_id is null) = (p_academy_rider_id is null) or p_race_edition_id is null then
    raise exception 'Le coureur et la convocation sont requis pour modifier le moral.';
  end if;
  select day.id into v_day_id
  from public.seasons season join public.season_days day
    on day.season_id = season.id and day.day_number = season.current_day_number
  where season.status = 'active';
  if v_day_id is null then
    raise exception 'La journée de saison du moral est introuvable.';
  end if;
  -- The same championship can be represented by both selection pipelines.
  -- Share its event ID rather than a replaceable membership/candidate ID.
  -- For juniors the ID belongs to development_race_editions, not race_editions.
  v_reference := 'international-callup:' || p_race_edition_id::text;
  if p_rider_id is not null then
    perform public.apply_rider_morale_event(p_rider_id, v_day_id,
      'international_callup_refusal', v_reference, -10, p_description, p_metadata);
  else
    perform public.apply_youth_rider_morale_event(p_academy_rider_id, v_day_id,
      'international_callup_refusal', v_reference, -10, p_description, p_metadata);
  end if;
end;
$$;
revoke all on function private.apply_international_callup_refusal_morale(uuid,uuid,uuid,text,jsonb)
  from public, anon, authenticated, service_role;

-- Charge only the explicit, authorized refusal branches. Automatic expiry,
-- replacement, injury/eligibility invalidations and administrative corrections
-- also set declined/unavailable; a table trigger would wrongly penalize them.
do $responses$
declare v_definition text; v_old text; v_new text;
begin
  v_definition := replace(pg_get_functiondef('public.respond_to_national_federation_preselection(uuid,boolean)'::regprocedure), chr(13), '');
  v_old := '  v_callup_departure timestamptz;';
  v_new := v_old || E'\n  v_morale_race_edition_id uuid;';
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'Unexpected federation response declarations.';
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  v_old := '  select schedule.departure_at into v_callup_departure';
  v_new := '  select schedule.departure_at, schedule.race_edition_id into v_callup_departure, v_morale_race_edition_id';
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'Unexpected federation callup schedule lookup.';
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  v_old := '  where id = v_member.id;';
  v_new := v_old || $refusal$

  if not p_accept then
    perform private.apply_international_callup_refusal_morale(
      v_member.professional_rider_id, v_member.junior_rider_id, v_morale_race_edition_id,
      'Convocation internationale refusée par le manager — '
        || public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year),
      jsonb_build_object('selectionMemberId', v_member.id, 'selectionListId', v_list.id,
        'raceEditionId', v_morale_race_edition_id, 'slotKey', v_list.slot_key,
        'countryId', v_list.country_id, 'ownerTeamId', v_member.owner_team_id,
        'ownerDirectorId', v_member.owner_director_id, 'pipeline', 'federation'));
  end if;$refusal$;
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1
    or position('for update of selection_list' in v_definition) = 0
    or position('callup_eligibility_v1' in v_definition) = 0
    or position('s5_championship_quotas' in v_definition) = 0
    or position('apply_international_callup_refusal_morale' in v_definition) > 0 then
    raise exception 'Unexpected federation response guards.';
  end if;
  execute replace(v_definition, v_old, v_new);

  v_definition := replace(pg_get_functiondef('public.respond_to_international_championship_selection(uuid,boolean)'::regprocedure), chr(13), '');
  v_old := $old$    set response_status = 'declined', is_selected = false, responded_at = now()
    where id = v_candidate.id;$old$;
  v_new := v_old || $refusal$

    perform private.apply_international_callup_refusal_morale(
      v_candidate.rider_id, null, v_race_edition_id,
      'Convocation internationale refusée par le manager',
      jsonb_build_object('candidateId', v_candidate.id, 'nationSelectionId', v_candidate.nation_selection_id,
        'raceEditionId', v_race_edition_id, 'ownerTeamId', v_candidate.team_id,
        'ownerDirectorId', v_director_id, 'pipeline', 'championship'));
$refusal$;
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1
    or position('Vous ne pouvez pas répondre pour ce coureur.' in v_definition) = 0
    or position('apply_international_callup_refusal_morale' in v_definition) > 0 then
    raise exception 'Unexpected international championship refusal branch.';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$responses$;

notify pgrst, 'reload schema';
commit;
