begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';

do $migration$
declare
  v_definition text;
  v_previous_lock constant text :=
    $lock$pg_catalog.hashtextextended(v_identity.country_id::text || ':' || p_infrastructure_code, 0)$lock$;
  v_country_lock constant text :=
    $lock$pg_catalog.hashtextextended(v_identity.country_id::text || ':federation-infrastructure', 0)$lock$;
  v_previous_check constant text := $check$
    where country_id = v_identity.country_id
      and infrastructure_code = p_infrastructure_code and status = 'active'
  ) then raise exception 'Un chantier est déjà actif pour cette infrastructure.'; end if;
$check$;
  v_country_check constant text := $check$
    where country_id = v_identity.country_id
      and status = 'active'
  ) then raise exception 'Un chantier est déjà en cours dans cette fédération.'; end if;
$check$;
begin
  v_definition := replace(pg_get_functiondef(
    'public.start_national_federation_infrastructure_project(text,text,text)'::regprocedure
  ), chr(13), '');

  if length(v_definition) - length(replace(v_definition, v_previous_lock, '')) <> length(v_previous_lock)
    or length(v_definition) - length(replace(v_definition, v_previous_check, '')) <> length(v_previous_check) then
    raise exception 'Unexpected federal construction launch definition';
  end if;

  -- Serialize every launch for a country, including launches for different
  -- buildings. Existing projects still follow the regular completion path.
  execute replace(
    replace(v_definition, v_previous_lock, v_country_lock),
    v_previous_check, v_country_check
  );
end;
$migration$;

commit;
