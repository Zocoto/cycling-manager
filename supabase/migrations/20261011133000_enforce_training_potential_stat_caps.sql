begin;
set local lock_timeout = '5s';
set local statement_timeout = '8s';

-- Training-only ceilings. Do not add a constraint/trigger on ratings: items
-- deliberately bypass talent, and existing ratings must never be rewritten.
create or replace function public.get_rider_potential_stat_cap(p_potential_steps integer)
returns integer language sql immutable set search_path = public as $$
  select least(100, 65 + least(8, greatest(1, coalesce(p_potential_steps, 1))) * 5);
$$;

create or replace function public.get_youth_training_next_raw_rating(
  p_current_raw numeric, p_projected_gain numeric, p_potential_steps integer
)
returns numeric language sql immutable set search_path = public as $$
  select greatest(p_current_raw, least(
    (public.get_rider_potential_stat_cap(p_potential_steps) - 34) / 8.0,
    round(p_current_raw + greatest(0, p_projected_gain) / 8.0, 3)
  ));
$$;

-- Preserve the live engines and their bonuses, contract guards, locks,
-- decline rules and idempotent session ledgers. Abort on an unfamiliar shape.
do $patch$
declare
  v_signature regprocedure;
  v_definition text;
  v_cap_pattern text;
  v_total text;
  v_cap text;
  v_initial text;
  v_gain text;
  v_decline_anchor text;
  v_pair text[];
  v_count integer;
begin
  foreach v_signature in array array[
    'public.settle_due_training_sessions()'::regprocedure,
    'public.settle_due_free_agent_training(integer)'::regprocedure
  ] loop
    v_definition := replace(pg_get_functiondef(v_signature), E'\r\n', E'\n');
    if position('potential_stat_cap_v1' in v_definition) > 0 then continue; end if;
    if v_signature = 'public.settle_due_training_sessions()'::regprocedure then
      v_total := 'v_rating_total';
      v_cap := 'v_potential_total_cap';
      v_initial := 'v_potential_total_cap := public.get_rider_potential_stat_cap(v_rider.potential_steps);';
      v_gain := 'v_training_milli';
      v_decline_anchor := '        v_decline_milli := round(';
    else
      v_total := 'v_total';
      v_cap := 'v_cap';
      v_initial := 'v_cap := public.get_rider_potential_stat_cap(v_rider.potential_steps);';
      v_gain := 'v_gain';
      v_decline_anchor := '        v_balance := v_progress.balance_milli + v_gain - v_decline;';
    end if;
    v_cap_pattern := v_cap || '[[:space:]]*:=[[:space:]]*public\.get_rider_potential_overall_cap\([[:space:]]*v_rider\.potential_steps[[:space:]]*\)[[:space:]]*\*[[:space:]]*13;';
    if (select count(*) from regexp_matches(v_definition, v_cap_pattern, 'g')) <> 1 then
      raise exception 'Unexpected potential assignment in %; no patch applied.', v_signature;
    end if;
    foreach v_pair slice 1 in array array[
      array[v_total || ' < ' || v_cap, 'v_stat.current_rating < ' || v_cap, '2'],
      array[v_total || ' >= ' || v_cap, 'v_stat.current_rating >= ' || v_cap, '1'],
      array[v_cap || ' - ' || v_total, v_cap || ' - v_stat.current_rating', '2'],
      array['elsif v_stat.current_rating >= v_progress.initial_rating then',
        'elsif v_stat.current_rating >= v_progress.initial_rating or v_stat.current_rating >= ' || v_cap || ' then', '1']
    ] loop
      v_count := (length(v_definition) - length(replace(v_definition, v_pair[1], ''))) / length(v_pair[1]);
      if v_count <> v_pair[3]::integer then
        raise exception 'Unexpected potential guard (%) in %; no patch applied.', v_pair[1], v_signature;
      end if;
      v_definition := replace(v_definition, v_pair[1], v_pair[2]);
    end loop;
    v_count := (length(v_definition) - length(replace(v_definition, v_decline_anchor, ''))) / length(v_decline_anchor);
    if v_count <> 1 then raise exception 'Unexpected training balance in %.', v_signature; end if;
    v_definition := regexp_replace(v_definition, v_cap_pattern,
      '-- potential_stat_cap_v1: cap each NEW training gain, not the average.' || chr(10) || '      ' || v_initial);
    v_definition := replace(v_definition, v_decline_anchor,
      '        if v_rider.age < 32 and v_stat.current_rating >= ' || v_cap || ' then' || chr(10) ||
      '          ' || v_gain || ' := 0;' || chr(10) || '        end if;' || chr(10) || v_decline_anchor);
    execute v_definition;
  end loop;

  v_signature := 'public.complete_current_youth_training_attempt(uuid,integer)'::regprocedure;
  v_definition := replace(pg_get_functiondef(v_signature), E'\r\n', E'\n');
  if position('potential_stat_cap_v1' in v_definition) = 0 then
    v_cap_pattern := 'v_next_raw[[:space:]]*:=[[:space:]]*least\([[:space:]]*8\.25,[[:space:]]*round\(\(v_current_raw \+ v_projected_gain / 8\.0\)::numeric, 3\)[[:space:]]*\);';
    if (select count(*) from regexp_matches(v_definition, v_cap_pattern, 'g')) <> 1 then
      raise exception 'Unexpected manual youth training ceiling; no patch applied.';
    end if;
    v_definition := regexp_replace(v_definition, v_cap_pattern,
      '-- potential_stat_cap_v1: preserve existing over-cap notes.' || chr(10) ||
      '    v_next_raw := public.get_youth_training_next_raw_rating(v_current_raw, v_projected_gain, v_context.potential_steps);');
    execute v_definition;
  end if;
end;
$patch$;

comment on column public.riders.potential_steps is
  'Permanent potential in eight half-stars. Future training caps each stat at min(100,65+5*potential_steps). Existing stats and item gains are preserved.';
comment on function public.get_rider_potential_stat_cap(integer) is
  'Individual training ceiling: 70,75,80,85,90,95,100,100. Items bypass this ceiling, not the absolute maximum of 100.';
comment on function public.get_youth_training_next_raw_rating(numeric,numeric,integer) is
  'Final youth training clamp after all bonuses and rounding; never reduces an existing rating.';

notify pgrst, 'reload schema';
commit;
