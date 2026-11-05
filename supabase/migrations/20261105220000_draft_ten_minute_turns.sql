begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';
set local application_name='cyclostratege-draft-ten-minutes-20261105';

-- Only the turn duration changes. Existing deadlines, editions, reservations,
-- participant order, preferences and acquisitions are deliberately untouched.
do $settings$
declare v_check text;
begin
  select pg_get_expr(conbin,conrelid) into v_check from pg_constraint
  where conrelid='public.season_draft_settings'::regclass
    and conname='season_draft_settings_pick_seconds_check' and contype='c';
  if v_check is null or regexp_replace(v_check,'[[:space:]()]','','g') not in ('pick_seconds=300','pick_seconds=600') then
    raise exception 'Unexpected draft duration constraint; stop before changing the rules.';
  end if;
  if (select count(*) from public.season_draft_settings)<>1
    or not exists(select 1 from public.season_draft_settings where singleton and pick_seconds in (300,600)) then
    raise exception 'Unexpected draft settings; stop before changing the duration.';
  end if;
  alter table public.season_draft_settings drop constraint season_draft_settings_pick_seconds_check;
  alter table public.season_draft_settings alter column pick_seconds set default 600;
  update public.season_draft_settings set pick_seconds=600 where singleton and pick_seconds=300;
  alter table public.season_draft_settings add constraint season_draft_settings_pick_seconds_check check(pick_seconds=600);
end;
$settings$;

-- Patch the currently installed midnight-aware initializer instead of
-- replacing it with an older implementation. Keep function OIDs, ACLs and GUCs.
do $functions$
declare v_definition text; v_old text; v_new text; v_patch record;
begin
  for v_patch in select * from (values
    ('public.initialize_season_draft(uuid)', 'vous aurez 5 minutes', 'vous aurez 10 minutes', 1),
    ('public.advance_season_draft(uuid)', 'interval ''5 minutes''', 'interval ''10 minutes''', 1),
    ('public.advance_season_draft(uuid)', 'Vous avez 5 minutes', 'Vous avez 10 minutes', 1),
    ('public.advance_season_draft(uuid)', 'Le délai de 5 minutes', 'Le délai de 10 minutes', 1)
  ) patches(signature,old_text,new_text,expected_count)
  loop
    select pg_get_functiondef(v_patch.signature::regprocedure) into v_definition;
    if v_patch.signature='public.initialize_season_draft(uuid)'
      and (position('public.reserve_season_draft_pool' in v_definition)=0
        or position('pool_reserved_at' in pg_get_functiondef('public.reserve_season_draft_pool(uuid,integer)'::regprocedure))=0) then
      raise exception 'Midnight draft reservation must be installed before the duration change.';
    end if;
    v_old:=v_patch.old_text; v_new:=v_patch.new_text;
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old)=v_patch.expected_count
      and position(v_new in v_definition)=0 then
      execute replace(v_definition,v_old,v_new);
    elsif position(v_old in v_definition)=0
      and (length(v_definition)-length(replace(v_definition,v_new,'')))/length(v_new)=v_patch.expected_count then
      null; -- A reviewed retry is harmless and does not rewrite any edition.
    else
      raise exception 'Draft duration anchor changed in %; review the current implementation.',v_patch.signature;
    end if;
  end loop;
end;
$functions$;

commit;
