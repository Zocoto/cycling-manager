begin;
set local application_name='query-performance-delivery-20261016';
set local lock_timeout = '3s';
set local statement_timeout = '10s';

-- The three projected values reuse the same firm-commitment count. Without
-- MATERIALIZED the single-use CTE is folded, causing its STABLE, non-inlineable
-- helper to run three times. Each invocation ranks the world's open auctions.
-- Keep all capacity rules, output columns, ownership and grants unchanged.
do $migration$
declare
  v_signature constant regprocedure :=
    'private.get_team_roster_projection(uuid,integer)'::regprocedure;
  v_definition text;
  v_body text;
  v_expected_body constant text := $expected$
  with projection as (
    select
      public.get_team_roster_commitment_count(p_team_id, p_game_year)::integer
        as firm_commitment_count,
      (
        select count(*)::integer
        from public.youth_academy_riders as academy
        where academy.team_id = p_team_id
          and academy.status = 'recruited'
          and academy.promotion_game_year <= p_game_year
      ) as scheduled_youth_count
  )
  select projection.firm_commitment_count,
    projection.scheduled_youth_count,
    projection.firm_commitment_count + projection.scheduled_youth_count,
    greatest(
      0,
      projection.firm_commitment_count + projection.scheduled_youth_count
        - public.get_team_roster_limit(p_team_id)
    )::integer
  from projection
$expected$;
begin
  select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), ''),
    btrim(replace(procedure.prosrc, chr(13), ''))
  into v_definition, v_body
  from pg_catalog.pg_proc as procedure
  where procedure.oid = v_signature;

  if v_body is distinct from btrim(v_expected_body) then
    raise exception 'Unexpected roster projection source; migration aborted.';
  end if;

  execute replace(v_definition,
    'with projection as (', 'with projection as materialized (');
end;
$migration$;

commit;
