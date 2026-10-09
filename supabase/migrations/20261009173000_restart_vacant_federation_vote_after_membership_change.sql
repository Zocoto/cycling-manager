begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- A genuine new affiliation may reopen a previously unsuccessful ballot.
-- Periodic catch-up must not generate the same election endlessly.
do $extend_initializer$
declare
  v_definition text;
  v_signature constant text := 'private.ensure_federation_presidency(p_country_id uuid, p_season_id uuid)';
  v_marker constant text := E'    if exists (\n      select 1 from public.national_federation_elections\n      where country_id = p_country_id and election_type = ''exceptional''';
begin
  -- Keep the installed three-argument implementation when replaying this migration.
  if pg_catalog.to_regprocedure('private.ensure_federation_presidency(uuid,uuid,boolean)') is not null then return; end if;
  select pg_catalog.pg_get_functiondef('private.ensure_federation_presidency(uuid,uuid)'::regprocedure)
  into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');
  if position(v_signature in v_definition) = 0 or position(v_marker in v_definition) = 0 then
    raise exception 'Federation presidency initializer differs from the reviewed version.';
  end if;
  v_definition := replace(v_definition, v_signature,
    'private.ensure_federation_presidency(p_country_id uuid, p_season_id uuid, p_membership_changed boolean)');
  v_definition := replace(v_definition, v_marker,
    replace(v_marker, 'if exists (', 'if not p_membership_changed and exists ('));
  execute v_definition;
end;
$extend_initializer$;

create or replace function private.ensure_federation_presidency(p_country_id uuid, p_season_id uuid)
returns text language sql security definer set search_path = '' set statement_timeout = '15s'
as $$ select private.ensure_federation_presidency(p_country_id, p_season_id, false); $$;
revoke all on function private.ensure_federation_presidency(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function private.ensure_federation_presidency(uuid,uuid) from public, anon, authenticated;
grant execute on function private.ensure_federation_presidency(uuid,uuid,boolean) to service_role;
grant execute on function private.ensure_federation_presidency(uuid,uuid) to service_role;

create or replace function private.initialize_federation_presidency_on_affiliation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_affiliation record;
begin
  if tg_table_name = 'team_seasons' then
    perform private.ensure_federation_presidency(new.registration_country_id, new.season_id, true);
  else
    for v_affiliation in
      select registration_country_id, season_id from public.team_seasons
      where team_id = new.team_id and status in ('planned', 'active')
    loop
      perform private.ensure_federation_presidency(v_affiliation.registration_country_id, v_affiliation.season_id, true);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.initialize_federation_presidency_on_affiliation() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
