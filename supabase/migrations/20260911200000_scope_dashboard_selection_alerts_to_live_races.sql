begin;

-- The dashboard count used to include every pending international candidate
-- owned by the DS, including stale rows from a completed season or a race that
-- has already departed. The destination page deliberately hides those rows,
-- so the assistant could advertise a decision while the page was empty.
-- Keep the alert in lockstep with the page: only selected pending candidates
-- for the active season and a future departure are actionable.
do $migration$
declare
  v_signature constant regprocedure :=
    'public.get_current_dashboard_assistant_summary()'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_anchor constant text :=
    'selection.is_selected = true';
  v_guard constant text :=
    'selection.is_selected = true' || chr(10) ||
    '       and exists (' || chr(10) ||
    '         select 1' || chr(10) ||
    '         from public.international_championship_nation_selections as nation_selection' || chr(10) ||
    '         join public.race_editions as edition' || chr(10) ||
    '           on edition.id = nation_selection.race_edition_id' || chr(10) ||
    '          and edition.season_id = context.season_id' || chr(10) ||
    '         where nation_selection.id = selection.nation_selection_id' || chr(10) ||
    '           and exists (' || chr(10) ||
    '             select 1' || chr(10) ||
    '             from public.stages as stage' || chr(10) ||
    '             where stage.race_edition_id = edition.id' || chr(10) ||
    '               and stage.departure_at > now()' || chr(10) ||
    '           )' || chr(10) ||
    '       )';
begin
  select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '')
  into v_definition;

  if position(v_anchor in v_definition) = 0 then
    raise exception
      'Le garde-fou des convocations du tableau de bord est introuvable.';
  end if;

  v_patched_definition := replace(v_definition, v_anchor, v_guard);

  if v_patched_definition = v_definition then
    raise exception
      'Le comptage des convocations du tableau de bord n’a pas été modifié.';
  end if;

  execute v_patched_definition;
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau : les convocations comptées sont limitées aux sélections actives et encore à venir.';

notify pgrst, 'reload schema';
commit;
