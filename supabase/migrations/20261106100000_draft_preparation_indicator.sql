begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';
set local application_name='cyclostratege-draft-preparation-indicator';

-- Public readiness is only a saved, nonempty preference list. Its contents,
-- ordering and automatic-pick setting remain private to the participant.
-- Reuse the existing lightweight edition-version polling when this flag changes.
do $patch$
declare v_definition text; v_patch record; v_old_count integer; v_new_count integer;
begin
  for v_patch in select * from (values
    ('public.get_season_draft_view(boolean)',
      $old$'reason',p.resolution_reason) order by p.position)$old$,
      $new$'hasPreferences',cardinality(p.preferences)>0,'reason',p.resolution_reason) order by p.position)$new$),
    ('public.save_current_season_draft_preferences(uuid,uuid[],boolean)',
      $old$  perform public.advance_season_draft(p_edition);$old$,
      $new$  if (cardinality(v_player.preferences)>0) is distinct from (cardinality(p_riders)>0) then
    update public.season_draft_editions set version=version+1 where id=p_edition;
  end if;
  perform public.advance_season_draft(p_edition);$new$)
  ) patches(signature,previous,replacement)
  loop
    select pg_get_functiondef(v_patch.signature::regprocedure) into v_definition;
    v_old_count := (length(v_definition)-length(replace(v_definition,v_patch.previous,'')))/length(v_patch.previous);
    v_new_count := (length(v_definition)-length(replace(v_definition,v_patch.replacement,'')))/length(v_patch.replacement);
    if v_new_count=1 and v_old_count=1 then
      null; -- The replacement includes its original anchor: reviewed retry.
    elsif v_old_count=1 and v_new_count=0 then
      execute replace(v_definition,v_patch.previous,v_patch.replacement);
    else
      raise exception 'Draft preparation anchor changed in %; review before applying.',v_patch.signature;
    end if;
  end loop;
end;
$patch$;

commit;
