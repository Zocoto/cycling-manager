begin;
set local application_name = 'record-training-personality-bonus-20261127';
set local lock_timeout = '500ms';
set local statement_timeout = '10s';

-- NULL means the historical session did not record its applied bonus. Adding
-- nullable columns without defaults does not rewrite or update old sessions.
alter table public.rider_training_sessions
  add column if not exists personality_bonus_percentage smallint;
alter table public.youth_academy_training_sessions
  add column if not exists personality_bonus_percentage smallint;

do $training_personality_schema$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.rider_training_sessions'::regclass
    and conname = 'rider_training_sessions_personality_bonus_allowed') then
    alter table public.rider_training_sessions
      add constraint rider_training_sessions_personality_bonus_allowed
      check (personality_bonus_percentage in (0, 5)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.youth_academy_training_sessions'::regclass
    and conname = 'youth_training_sessions_personality_bonus_allowed') then
    alter table public.youth_academy_training_sessions
      add constraint youth_training_sessions_personality_bonus_allowed
      check (personality_bonus_percentage in (0, 5)) not valid;
  end if;
end;
$training_personality_schema$;

comment on column public.rider_training_sessions.personality_bonus_percentage is
  'Applied training personality bonus: 5 for completed Assidu sessions, 0 otherwise; NULL for unrecorded history. Gains are unchanged.';
comment on column public.youth_academy_training_sessions.personality_bonus_percentage is
  'Applied training personality bonus: 5 for Assidu sessions, 0 otherwise; NULL for unrecorded history. Gains are unchanged.';

-- The existing engines already load the personality used by their gain formula.
-- Persist that same context, rather than reading a possibly changed trait later.
do $training_personality_snapshot$
declare
  v_signature regprocedure;
  v_definition text;
  v_column_anchor text;
  v_column_replacement text;
  v_value_anchor text;
  v_value_replacement text;
  v_gain_guard text;
  v_snapshot_guard text;
  v_marker constant text := 'record_training_personality_bonus_v1';
begin
  foreach v_signature in array array[
    'public.settle_due_training_sessions()'::regprocedure,
    'public.complete_current_youth_training_attempt(uuid,integer)'::regprocedure
  ] loop
    v_definition := replace(pg_get_functiondef(v_signature), E'\r\n', E'\n');
    if v_signature = 'public.settle_due_training_sessions()'::regprocedure then
      v_column_anchor := E'        form_after\n      ) values (';
      v_column_replacement := E'        form_after,\n        personality_bonus_percentage\n      ) values (';
      v_value_anchor := E'        v_next_form\n      )\n      on conflict (rider_id, season_day_id) do nothing';
      v_snapshot_guard := 'case when v_status = ''completed'' and v_rider.personality_key = ''assidu'' then 5 else 0 end';
      v_value_replacement := E'        v_next_form,\n        ' || v_snapshot_guard || ' -- ' || v_marker
        || E'\n      )\n      on conflict (rider_id, season_day_id) do nothing';
      v_gain_guard := '* case when v_rider.personality_key = ''assidu'' then 1.05 else 1 end';
    else
      v_column_anchor := E'    ratings_after\n  ) values (';
      v_column_replacement := E'    ratings_after,\n    personality_bonus_percentage\n  ) values (';
      v_value_anchor := E'    v_ratings_after\n  );\n\n  update public.youth_academy_training_attempts';
      v_snapshot_guard := 'case when v_context.personality_key = ''assidu'' then 5 else 0 end';
      v_value_replacement := E'    v_ratings_after,\n    ' || v_snapshot_guard || ' -- ' || v_marker
        || E'\n  );\n\n  update public.youth_academy_training_attempts';
      v_gain_guard := 'v_projected_gain := v_projected_gain * case when v_context.personality_key = ''assidu'' then 1.05 else 1 end;';
    end if;

    if (length(v_definition) - length(replace(v_definition, v_gain_guard, ''))) <> length(v_gain_guard) then
      raise exception 'Missing or duplicated existing Assidu formula for %, cannot record its applied bonus safely.', v_signature;
    end if;
    if position(v_marker in v_definition) > 0 then
      if position(v_column_replacement in v_definition) = 0 or position(v_value_replacement in v_definition) = 0 then
        raise exception 'Inconsistent personality snapshot for %, cannot continue safely.', v_signature;
      end if;
      continue;
    end if;
    if (length(v_definition) - length(replace(v_definition, v_column_anchor, ''))) <> length(v_column_anchor)
      or (length(v_definition) - length(replace(v_definition, v_value_anchor, ''))) <> length(v_value_anchor) then
      raise exception 'Unexpected training ledger definition for %, cannot record its personality bonus safely.', v_signature;
    end if;
    v_definition := replace(v_definition, v_column_anchor, v_column_replacement);
    v_definition := replace(v_definition, v_value_anchor, v_value_replacement);
    execute v_definition;
  end loop;
end;
$training_personality_snapshot$;

commit;
