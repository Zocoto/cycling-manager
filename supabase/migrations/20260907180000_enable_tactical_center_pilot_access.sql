begin;

-- La construction reste réservée à la S3. En revanche, une équipe à laquelle
-- un Centre tactique a été attribué manuellement peut tester ses briefings en
-- S2. Le contrôle de présence et de niveau du bâtiment reste réalisé juste
-- après ce bloc par le RPC existant.
do $migration$
declare
  v_definition text;
  v_season_guard text := E'  if v_context.game_year < 3 then\n'
    || E'    raise exception ''Le Centre tactique ouvre avec la saison 3.'';\n'
    || E'  end if;\n';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.save_current_team_tactical_briefing(uuid,uuid,text,uuid[],text,uuid[])'::regprocedure
  ), chr(13), '') into v_definition;

  if position(v_season_guard in v_definition) = 0 then
    raise exception 'Garde saisonnière du briefing tactique inattendue.';
  end if;

  v_definition := replace(
    v_definition,
    v_season_guard,
    E'  -- Accès pilote S2 : la présence du bâtiment reste obligatoire.\n'
  );
  execute v_definition;
end;
$migration$;

comment on function public.save_current_team_tactical_briefing(
  uuid, uuid, text, uuid[], text, uuid[]
) is
  'Valide le bâtiment, le profil, les niveaux et chaque coureur. En S2, seuls les centres attribués manuellement ouvrent cet accès pilote.';

notify pgrst, 'reload schema';

commit;
