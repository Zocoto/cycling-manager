-- ============================================================
-- LOCK DOWN PRIVILEGED FUNCTIONS
--
-- PostgreSQL grants EXECUTE to PUBLIC by default. SECURITY DEFINER
-- functions must instead stay private unless an application role
-- receives an explicit GRANT.
-- ============================================================

begin;

do $$
declare
  privileged_function record;
begin
  for privileged_function in
    select
      namespace.nspname as schema_name,
      procedure.proname as function_name,
      pg_get_function_identity_arguments(procedure.oid) as function_arguments
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prokind = 'f'
      and procedure.prosecdef
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon',
      privileged_function.schema_name,
      privileged_function.function_name,
      privileged_function.function_arguments
    );
  end loop;
end;
$$;

-- Future functions are private by default as well. Every RPC exposed to
-- the application must receive an explicit GRANT in its own migration.
alter default privileges in schema public
revoke execute on functions from public;

alter default privileges in schema public
revoke execute on functions from anon;

alter default privileges in schema public
revoke execute on functions from authenticated;

commit;
