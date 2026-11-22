begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

-- Production repairs run in separately reviewed per-season transactions. This
-- bounded fallback also makes migration replay complete on another database:
-- refresh only projections that still contain a split academy identity.
do $$
declare
  v_season_id uuid;
begin
  for v_season_id in
    select distinct split.season_id
    from (
      select season_id, academy_rider_id
      from public.development_ranking_entries
      where entity_type = 'individual' and academy_rider_id is not null
      group by season_id, academy_rider_id
      having count(*) > 1
    ) as split
    join public.seasons as season on season.id = split.season_id
    where season.game_year >= 3
    order by split.season_id
  loop
    perform public.refresh_development_rankings(v_season_id);
  end loop;
end;
$$;

create unique index development_ranking_entries_academy_identity_unique_idx
  on public.development_ranking_entries (season_id, academy_rider_id)
  where entity_type = 'individual' and academy_rider_id is not null;

commit;
