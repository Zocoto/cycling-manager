begin;

-- A FOR integer loop owns its iterator. Remove the redundant declaration from
-- the function installed immediately before this migration.
do $$
declare
  v_definition text;
  v_clean_definition text;
begin
  select pg_get_functiondef(
    'public.sync_sponsor_installments(uuid)'::regprocedure
  ) into v_definition;

  v_clean_definition := regexp_replace(
    v_definition,
    E'  v_installment integer;\\r?\\n',
    ''
  );

  if v_clean_definition = v_definition then
    raise exception 'Declaration v_installment introuvable dans sync_sponsor_installments.';
  end if;

  execute v_clean_definition;
end;
$$;

notify pgrst, 'reload schema';

commit;
