begin;
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

-- Keep the old weights available for legacy contracts, from the same history
-- that supplies the current score. Existing snapshots refresh on demand.
alter table public.national_federation_renown
  add column legacy_score integer check (legacy_score between 0 and 1000),
  drop constraint national_federation_renown_breakdown_range,
  add constraint national_federation_renown_breakdown_range check (
    uci_history_points between 0 and case when source_through_game_year >= 6 then 500 else 600 end
    and team_legacy_points between 0 and case when source_through_game_year >= 6 then 150 else 180 end
    and rider_legacy_points between 0 and case when source_through_game_year >= 6 then 150 else 170 end
    and hosting_legacy_points between 0 and case when source_through_game_year >= 6 then 200 else 100 end
  ) not valid;

comment on column public.national_federation_renown.legacy_score is
  'Renommée calculée avec le barème des saisons 1 à 5 à partir du même historique. Utilisée par les contrats d’accueil antérieurs.';

do $renown$
declare
  v_definition text := replace(pg_get_functiondef('public.refresh_national_federation_renown(uuid)'::regprocedure), chr(13), '');
  v_organization_anchor constant text := '  with organization_events as (';
  v_insert_anchor constant text := '  insert into public.national_federation_renown (';
  v_organization_tail constant text := E'  select least(100, coalesce(sum(event.points), 0))::integer\n  into v_hosting_points\n  from organization_events as event;';
  v_organization_start integer := strpos(v_definition, v_organization_anchor);
  v_organization_end integer := strpos(v_definition, v_insert_anchor);
  v_organization_sql text;
  v_patch record;
begin
  if v_organization_start = 0 or v_organization_end <= v_organization_start then
    raise exception 'Unexpected federation organization history definition.';
  end if;
  v_organization_sql := substring(v_definition from v_organization_start for v_organization_end - v_organization_start);
  if length(v_organization_sql) - length(replace(v_organization_sql, v_organization_tail, '')) <> length(v_organization_tail) then
    raise exception 'Unexpected federation organization aggregate.';
  end if;
  v_organization_sql := replace(v_organization_sql, v_organization_tail,
    E'  select least(case when v_game_year >= 6 then 200 else 100 end, coalesce(sum(event.points), 0))::integer\n  from organization_events as event;');

  -- S6+ internationals only grant prestige to a paid host. The race template
  -- or a neutral physical venue can still name a country without an award.
  for v_patch in select * from (values
    ('    where race.country_id = p_country_id and not edition.is_neutral_host'),
    ('    where edition.competition_type = ''nations_cup_junior'''),
    ('    where not edition.is_neutral_host and edition.competition_type in (')
  ) as legacy_venues(previous) loop
    if length(v_organization_sql) - length(replace(v_organization_sql, v_patch.previous, '')) <> length(v_patch.previous) then
      raise exception 'Unexpected legacy federation venue history.';
    end if;
    v_organization_sql := replace(v_organization_sql, v_patch.previous,
      replace(v_patch.previous, '    where ', '    where season.game_year < 6 and '));
  end loop;

  execute format($helper$
    create function private.get_national_federation_organization_prestige(p_country_id uuid, p_game_year integer)
    returns integer language sql stable set search_path = '' as %L
  $helper$, replace(v_organization_sql, 'v_game_year', 'p_game_year'));

  -- Compute and clamp both scores from one pass over the source data. Round
  -- only after applying either UCI multiplier, preserving the old formula.
  v_definition := overlay(v_definition placing $clamp$  v_hosting_points := private.get_national_federation_organization_prestige(p_country_id, v_game_year);
  v_legacy_score := least(1000, least(600, round(v_uci_points))::integer + least(180, v_team_points)::integer
    + least(170, v_rider_points)::integer + least(100, v_hosting_points));

  if v_game_year >= 6 then
    v_uci_points := least(500, round(v_uci_points * 500 / 600));
    v_team_points := least(150, v_team_points);
    v_rider_points := least(150, v_rider_points);
  else
    v_uci_points := least(600, round(v_uci_points));
    v_team_points := least(180, v_team_points);
    v_rider_points := least(170, v_rider_points);
  end if;

$clamp$ from v_organization_start for v_organization_end - v_organization_start);

  for v_patch in select * from (values
    ($old$  v_uci_points integer := 0;
  v_team_points integer := 0;
  v_rider_points integer := 0;$old$,
     $new$  v_uci_points numeric := 0;
  v_team_points bigint := 0;
  v_rider_points bigint := 0;
  v_legacy_score integer;$new$),
    ($old$  select least(600, round(
    coalesce(sum(weighted.score * weighted.weight), 0)
    / greatest(1, coalesce(sum(weighted.weight), 0))
  ))::integer into v_uci_points$old$,
     $new$  select coalesce(sum(weighted.score * weighted.weight), 0)
    / greatest(1, coalesce(sum(weighted.weight), 0)) into v_uci_points$new$),
    ('select least(180, coalesce(sum(', 'select coalesce(sum('),
    ('), 0))::integer into v_team_points', '), 0) into v_team_points'),
    ('select least(170, coalesce(sum(', 'select coalesce(sum('),
    ('), 0))::integer into v_rider_points', '), 0) into v_rider_points'),
    ('source_through_game_year, calculated_at', 'source_through_game_year, legacy_score, calculated_at'),
    ('v_game_year, now()', 'v_game_year, v_legacy_score, now()'),
    ('source_through_game_year = excluded.source_through_game_year,',
     E'source_through_game_year = excluded.source_through_game_year,\n    legacy_score = excluded.legacy_score,')
  ) as patches(previous, replacement) loop
    v_patch.previous := replace(v_patch.previous, chr(13), '');
    v_patch.replacement := replace(v_patch.replacement, chr(13), '');
    if length(v_definition) - length(replace(v_definition, v_patch.previous, '')) <> length(v_patch.previous) then
      raise exception 'Unexpected federation renown calculation.';
    end if;
    v_definition := replace(v_definition, v_patch.previous, v_patch.replacement);
  end loop;
  execute v_definition;
end;
$renown$;

revoke all on function private.get_national_federation_organization_prestige(uuid, integer)
  from public, anon, authenticated, service_role;

comment on function public.refresh_national_federation_renown(uuid) is
  'Recalcule la renommée de la fédération. Le prestige d’organisation des cinq dernières saisons est plafonné à 200 points à partir de la saison 6.';

-- Keep the per-federation cache and lock. The first read after a season change
-- refreshes that federation even if the snapshot was written recently.
create or replace function public.get_national_federation_course_renown(p_country_id uuid)
returns public.national_federation_renown
language plpgsql volatile security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  v_snapshot public.national_federation_renown%rowtype;
  v_game_year integer;
begin
  select * into v_snapshot from public.national_federation_renown where country_id = p_country_id;
  select coalesce(max(game_year), 1) into v_game_year
  from public.seasons where status in ('active', 'completed');
  if v_snapshot.calculated_at >= now() - interval '30 minutes' and v_snapshot.source_through_game_year = v_game_year then
    return v_snapshot;
  end if;
  if pg_try_advisory_xact_lock(hashtextextended('federation-course-renown:' || p_country_id::text, 0)) then
    return public.refresh_national_federation_renown(p_country_id);
  end if;
  return v_snapshot;
end;
$$;

revoke all on function public.get_national_federation_course_renown(uuid) from public, anon, authenticated;
grant execute on function public.get_national_federation_course_renown(uuid) to service_role;

-- New applications still capture the current public score at filing. Existing
-- applications and the original legacy-revenue calculation remain as agreed.
do $legacy_returns$
declare
  v_definition text := replace(pg_get_functiondef('public.settle_due_national_federation_hosting_returns()'::regprocedure), chr(13), '');
  v_anchor constant text := 'select least(1000, greatest(0, renown.score))::numeric / 2000';
  v_replacement constant text := 'select least(1000, greatest(0, coalesce(renown.legacy_score, renown.score)))::numeric / 2000';
begin
  if length(v_definition) - length(replace(v_definition, v_anchor, '')) <> length(v_anchor) then
    raise exception 'Unexpected federation hosting legacy-revenue definition.';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end;
$legacy_returns$;

notify pgrst, 'reload schema';
commit;
