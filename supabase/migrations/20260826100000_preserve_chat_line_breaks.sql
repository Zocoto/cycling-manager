begin;

create or replace function public.normalize_chat_message_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        replace(replace(coalesce(p_value, ''), E'\r\n', E'\n'), E'\r', E'\n'),
        '[[:blank:]]+',
        ' ',
        'g'
      ),
      E' *\n *',
      E'\n',
      'g'
    ),
    E' \t\n\r\f\v'
  );
$$;

revoke all on function public.normalize_chat_message_text(text) from public;
revoke all on function public.normalize_chat_message_text(text) from anon;
revoke all on function public.normalize_chat_message_text(text) from authenticated;

do $migration$
declare
  v_target record;
  v_definition text;
  v_lower_definition text;
  v_assignment_start integer;
  v_assignment_end_relative integer;
  v_assignment_length integer;
  v_assignment text;
  v_replacement text;
begin
  for v_target in
    select *
    from (
      values
        (
          'public.post_global_chat_message(text,text,uuid)'::regprocedure,
          'v_message'::text,
          'p_message'::text
        ),
        (
          'public.edit_current_global_chat_message(uuid,text,text,text)'::regprocedure,
          'v_message'::text,
          'p_message'::text
        ),
        (
          'public.post_current_direct_message(uuid,text)'::regprocedure,
          'v_body'::text,
          'p_body'::text
        ),
        (
          'public.edit_current_direct_message(uuid,text)'::regprocedure,
          'v_body'::text,
          'p_body'::text
        )
    ) as targets(procedure_id, variable_name, parameter_name)
  loop
    select pg_get_functiondef(v_target.procedure_id)
    into v_definition;

    if position(
      'public.normalize_chat_message_text(' || v_target.parameter_name || ')'
      in v_definition
    ) > 0 then
      continue;
    end if;

    v_lower_definition := lower(v_definition);
    v_assignment_start := position(
      lower(v_target.variable_name || ' := regexp_replace')
      in v_lower_definition
    );

    if v_assignment_start = 0 then
      raise exception 'La normalisation attendue est introuvable dans %.', v_target.procedure_id;
    end if;

    v_assignment_end_relative := position(
      ');'
      in substring(v_definition from v_assignment_start)
    );

    if v_assignment_end_relative = 0 then
      raise exception 'La fin de la normalisation est introuvable dans %.', v_target.procedure_id;
    end if;

    v_assignment_length := v_assignment_end_relative + 1;
    v_assignment := substring(
      v_definition
      from v_assignment_start
      for v_assignment_length
    );

    if position(lower(v_target.parameter_name) in lower(v_assignment)) = 0
      or position('regexp_replace' in lower(v_assignment)) = 0
    then
      raise exception 'La normalisation de % ne correspond pas à la forme attendue.', v_target.procedure_id;
    end if;

    v_replacement := v_target.variable_name
      || ' := public.normalize_chat_message_text('
      || v_target.parameter_name
      || ');';

    v_definition := overlay(
      v_definition placing v_replacement
      from v_assignment_start
      for v_assignment_length
    );

    execute v_definition;
  end loop;
end;
$migration$;

comment on function public.normalize_chat_message_text(text) is
  'Normalise les espaces des messages de chat sans supprimer les retours à la ligne.';

notify pgrst, 'reload schema';

commit;
