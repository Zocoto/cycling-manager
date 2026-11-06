begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';
set local application_name='cyclostratege-post-olympic-nations-cup-integrity';

-- Since the global Olympic rules (20261012160000), Nations Cup divisions
-- inherit the latest preceding non-Olympic season. The season rollover itself
-- still closes the immediately preceding season. Align only the stale Nations
-- Cup checks with the existing seeder; do not seed, reprice or rewrite any data.
do $patch$
declare v_definition text; v_patch record;
begin
  select replace(pg_get_functiondef('public.seed_nations_cup_assignments_for_season(uuid)'::regprocedure),chr(13),'') into v_definition;
  if position($source$where season.game_year < v_target.game_year
    and season.game_year%4<>0
  order by season.game_year desc limit 1;$source$ in v_definition)=0 then
    raise exception 'Expected non-Olympic Nations Cup source rule is missing; do not weaken rollover integrity.';
  end if;
  for v_patch in select * from (values
    ('public.get_season_rollover_integrity(uuid,uuid)',
      $old$n.source_season_id is distinct from p_source_season_id$old$,
      $new$n.source_season_id is distinct from (select source.id from public.seasons source
        where source.game_year<t.game_year and source.game_year%4<>0
        order by source.game_year desc limit 1)$new$),
    ('public.get_season_rollover_health()',
      $old$n.source_season_id is distinct from s.id$old$,
      $new$n.source_season_id is distinct from (select source.id from public.seasons source
            where source.game_year<t.game_year and source.game_year%4<>0
            order by source.game_year desc limit 1)$new$),
    ('public.repair_nations_cup_opening_budgets(uuid)',
      $old$select id into v_source_id from public.seasons where game_year=v_target.game_year-1;$old$,
      $new$select id into v_source_id from public.seasons
  where game_year<v_target.game_year and game_year%4<>0
  order by game_year desc limit 1;$new$)
  ) patches(signature,previous,replacement)
  loop
    select pg_get_functiondef(v_patch.signature::regprocedure) into v_definition;
    if (length(v_definition)-length(replace(v_definition,v_patch.previous,'')))/length(v_patch.previous)=1
      and position(v_patch.replacement in v_definition)=0 then
      execute replace(v_definition,v_patch.previous,v_patch.replacement);
    elsif position(v_patch.previous in v_definition)=0
      and (length(v_definition)-length(replace(v_definition,v_patch.replacement,'')))/length(v_patch.replacement)=1 then
      null; -- A reviewed retry is harmless; no data or receipt is written here.
    else
      raise exception 'Post-Olympic Nations Cup anchor changed in %; review before resuming rollover.',v_patch.signature;
    end if;
  end loop;
end;
$patch$;

commit;
