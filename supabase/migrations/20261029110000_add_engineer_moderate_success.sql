begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';

-- A base skill, not an academy talent. Only newly captured launch profiles
-- carry this field; existing projects keep their original outcome rules.
create function private.equipment_rnd_moderate_success_chance(p_level integer)
returns integer language sql immutable set search_path = '' as $$
  select least(5, greatest(1, coalesce(p_level, 1))) * 5;
$$;

-- Pure outcome selection. The exceptional +3 keeps its absolute per-project
-- probability; the disjoint moderate interval is 5..25% of successful trials.
-- Random values are explicit parameters so the exact boundaries can be tested
-- on an isolated database without modifying the production random generator.
create function private.resolve_equipment_rnd_success(
  p_focus text, p_success_rate integer, p_bonus_total integer,
  p_exceptional_chance numeric, p_moderate_chance numeric,
  p_quality_roll double precision, p_split_roll double precision,
  p_primary_roll double precision, p_secondary_roll double precision
)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_primary text[];
  v_secondary text[];
  v_pool text[];
  v_key text;
  v_second_key text;
  v_exceptional_threshold numeric := 0;
  v_delta integer := 1;
  v_moderate boolean := false;
begin
  if p_success_rate is null or p_success_rate not between 1 and 100
    or p_bonus_total is null or p_bonus_total < 0
    or p_exceptional_chance is null or p_exceptional_chance not between 0 and 100
    or p_moderate_chance is null or p_moderate_chance not between 0 and 25
    or p_quality_roll is null or not (p_quality_roll >= 0 and p_quality_roll < 1)
    or p_split_roll is null or not (p_split_roll >= 0 and p_split_roll < 1)
    or p_primary_roll is null or not (p_primary_roll >= 0 and p_primary_roll < 1)
    or p_secondary_roll is null or not (p_secondary_roll >= 0 and p_secondary_roll < 1)
  then raise exception 'Paramètres de succès R&D invalides.'; end if;

  if p_bonus_total <= 7 then
    v_exceptional_threshold := least(1, p_exceptional_chance / p_success_rate);
  end if;
  if p_quality_roll < v_exceptional_threshold then
    v_delta := 3;
  elsif p_quality_roll < least(1, v_exceptional_threshold + p_moderate_chance / 100) then
    v_delta := 2;
    v_moderate := true;
  end if;
  v_delta := least(v_delta, greatest(0, 10 - p_bonus_total));

  if v_moderate then
    case p_focus
      when 'mountain' then
        v_primary := array['mountain'];
        v_secondary := array['endurance','resistance','recovery','downhill'];
      when 'hills' then
        v_primary := array['hills','acceleration'];
        v_secondary := array['resistance','endurance','breakaway'];
      when 'cobbles' then
        v_primary := array['cobbles','resistance'];
        v_secondary := array['flat','endurance','acceleration'];
      when 'plain' then
        v_primary := array['flat','sprint','timeTrial'];
        v_secondary := array['acceleration','endurance','prologue'];
      else
        if p_focus is not null then raise exception 'Orientation R&D invalide.'; end if;
        v_primary := array['mountain','hills','flat','timeTrial','cobbles','sprint',
          'acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
        v_secondary := array[]::text[];
    end case;
    v_key := v_primary[1 + floor(p_primary_roll * cardinality(v_primary))::integer];
    if v_delta = 2 and p_split_roll >= 0.5 then
      v_pool := array_remove(v_primary || v_secondary, v_key);
      v_second_key := v_pool[1 + floor(p_secondary_roll * cardinality(v_pool))::integer];
    end if;
  end if;
  return jsonb_build_object('delta', v_delta, 'ratingKey', v_key,
    'secondRatingKey', v_second_key, 'moderate', v_moderate and v_delta = 2);
end;
$$;

do $patch$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select replace(pg_get_functiondef('public.equipment_rnd_engineer_profile(uuid)'::regprocedure), chr(13), '')
  into v_definition;
  v_old := '''level'',m.level,';
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'Profil ingénieur R&D inattendu.';
  end if;
  execute replace(v_definition, v_old, v_old || chr(10) ||
    '    ''moderateSuccessChancePercentage'',private.equipment_rnd_moderate_success_chance(m.level),');

  select replace(pg_get_functiondef('public.settle_due_equipment_rnd_projects()'::regprocedure), chr(13), '')
  into v_definition;
  v_old := '  v_key text;';
  if position(v_old in v_definition) = 0 then raise exception 'Déclaration R&D introuvable.'; end if;
  v_definition := replace(v_definition, v_old, v_old || chr(10) ||
    '  v_second_key text;' || chr(10) || '  v_success_result jsonb;');

  v_old := $old$    if v_successful then
      v_delta := case
        when v_bonus_total <= 7
          and random() * v_project.success_rate
            < coalesce((v_project.engineer_snapshot->>'exceptionalChancePercentage')::numeric,public.get_equipment_rnd_exceptional_chance(v_project.engineer_contract_id))
          then 3
        when v_project.lab_level >= 6 and random() < 0.12 then 2
        else 1
      end;
      v_delta := least(v_delta, greatest(0, 10 - v_bonus_total));$old$;
  v_new := $new$    v_second_key := null;
    if v_successful then
      if v_project.engineer_snapshot ? 'moderateSuccessChancePercentage' then
        -- engineer_moderate_success_v1: use the profile frozen at launch.
        v_success_result := private.resolve_equipment_rnd_success(
          v_project.research_focus, v_project.success_rate, v_bonus_total,
          (v_project.engineer_snapshot->>'exceptionalChancePercentage')::numeric,
          (v_project.engineer_snapshot->>'moderateSuccessChancePercentage')::numeric,
          random(), random(), random(), random()
        );
        v_delta := (v_success_result->>'delta')::integer;
        v_key := coalesce(v_success_result->>'ratingKey', v_key);
        v_second_key := v_success_result->>'secondRatingKey';
      else
        -- Older launches retain the laboratory's original +2 draw.
        v_delta := case
          when v_bonus_total <= 7
            and random() * v_project.success_rate
              < coalesce((v_project.engineer_snapshot->>'exceptionalChancePercentage')::numeric,public.get_equipment_rnd_exceptional_chance(v_project.engineer_contract_id))
            then 3
          when v_project.lab_level >= 6 and random() < 0.12 then 2
          else 1
        end;
        v_delta := least(v_delta, greatest(0, 10 - v_bonus_total));
      end if;$new$;
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'Tirage R&D attendu introuvable.';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '    if v_delta=0 and v_project.engineer_snapshot is not null then v_payload:=v_item.effect_payload; end if;';
  if position(v_old in v_definition) = 0 then raise exception 'Protection du résultat neutre introuvable.'; end if;
  v_definition := replace(v_definition, v_old, $new$    if v_second_key is not null then
      -- The total gain stays +2, shared across two distinct in-sector stats.
      v_payload := jsonb_set(v_payload, array['ratingBonuses',v_key], to_jsonb(v_current + 1));
      v_payload := jsonb_set(v_payload, array['ratingBonuses',v_second_key],
        to_jsonb(coalesce((v_item.effect_payload->'ratingBonuses'->>v_second_key)::numeric, 0) + 1));
    end if;
$new$ || v_old);

  v_old := $old$      v_item.effect_summary || ' · R&D '
        || case when v_delta > 0 then '+' else '' end
        || v_delta::text || ' ' || v_key,$old$;
  if position(v_old in v_definition) = 0 then raise exception 'Résumé R&D introuvable.'; end if;
  v_definition := replace(v_definition, v_old, $new$      v_item.effect_summary || ' · R&D ' || case
        when v_second_key is not null then '+1 ' || v_key || ' / +1 ' || v_second_key
        else (case when v_delta > 0 then '+' else '' end) || v_delta::text || ' ' || v_key
      end,$new$);
  execute v_definition;
end;
$patch$;

revoke all on function private.equipment_rnd_moderate_success_chance(integer),
  private.resolve_equipment_rnd_success(text,integer,integer,numeric,numeric,double precision,double precision,double precision,double precision)
  from public, anon, authenticated;
grant execute on function private.equipment_rnd_moderate_success_chance(integer),
  private.resolve_equipment_rnd_success(text,integer,integer,numeric,numeric,double precision,double precision,double precision,double precision)
  to service_role;

comment on function private.resolve_equipment_rnd_success(text,integer,integer,numeric,numeric,double precision,double precision,double precision,double precision)
  is 'Succès modéré R&D : 5 % par niveau sur les recherches réussies ; +2 ou +1/+1 dans le secteur, plafond total +10. Le +3 reste prioritaire et conserve sa probabilité.';
notify pgrst, 'reload schema';
commit;
