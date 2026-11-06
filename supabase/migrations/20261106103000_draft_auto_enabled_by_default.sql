begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';
set local application_name='cyclostratege-draft-auto-default';

-- Lock editions before participants, like the existing preferences RPC. Keep
-- every saved nonempty list and every running/resolved draft untouched.
do $default_and_unprepared$
declare v_edition record; v_editions uuid[] := '{}'; v_edition_id uuid; v_updated integer;
begin
  for v_edition in
    select edition.id from public.season_draft_editions edition
    where edition.status='preparing' and edition.starts_at>now()
    order by edition.id
    for update
  loop
    v_editions := array_append(v_editions,v_edition.id);
  end loop;

  alter table public.season_draft_participants alter column auto_enabled set default true;

  foreach v_edition_id in array v_editions
  loop
    update public.season_draft_participants set auto_enabled=true
    where edition_id=v_edition_id and status='pending'
      and cardinality(preferences)=0 and auto_enabled=false;
    get diagnostics v_updated = row_count;
    if v_updated>0 then
      update public.season_draft_editions set version=version+1 where id=v_edition_id;
    end if;
  end loop;
end;
$default_and_unprepared$;

commit;
