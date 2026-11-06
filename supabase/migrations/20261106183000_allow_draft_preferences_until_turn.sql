begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';
set local application_name = 'cyclostratege-draft-preferences-until-turn-20261106';

-- A waiting participant may still save after selections start, including
-- during their own unexpired turn. A NULL current position between bounded
-- automatic worker bursts does not close waiting participants' lists. Close
-- only resolved or stale turns; do not advance before saving a new list.
do $patch$
declare v_definition text; v_old text; v_new text; v_old_count integer; v_new_count integer;
begin
  v_definition := replace(pg_get_functiondef('public.save_current_season_draft_preferences(uuid,uuid[],boolean)'::regprocedure), chr(13), '');
  v_old := $old$    or (v_edition.current_position=v_player.position and now()>=v_edition.pick_deadline) then raise exception 'Votre sélection ne peut plus être modifiée.'; end if;$old$;
  v_new := $new$    or (v_edition.status='running' and (
      v_player.position<v_edition.current_position
      or (v_edition.current_position=v_player.position
        and (v_edition.pick_deadline is null or now()>=v_edition.pick_deadline))
    )) then raise exception 'Votre sélection ne peut plus être modifiée.'; end if;$new$;
  v_old_count := (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old);
  v_new_count := (length(v_definition)-length(replace(v_definition,v_new,'')))/length(v_new);
  if v_old_count=1 and v_new_count=0 then
    execute replace(v_definition,v_old,v_new);
  elsif v_old_count=0 and v_new_count=1 then
    null;
  else
    raise exception 'Unexpected draft preference availability guard; review before applying.';
  end if;
end;
$patch$;

commit;
