begin;
set local lock_timeout='4s';
set local statement_timeout='15s';

-- Preserve the original scouting snapshot. Age is derived from its season,
-- so unread and archived reports age identically without a rollover batch.
-- Patch the current signing function, retaining authorization, locking,
-- finances, native abilities, training bonuses and physiology triggers.
do $patch$
declare v_definition text; v_patch record;
begin
  v_definition:=replace(pg_get_functiondef('public.sign_current_team_youth_candidate(uuid)'::regprocedure),chr(13),'');
  for v_patch in select * from (values
    ('select candidate.*, mission.team_id',
      'select candidate.*, mission.team_id, report_season.game_year as report_game_year'),
    ('join public.youth_scouting_missions as mission on mission.id = candidate.mission_id',
      E'join public.youth_scouting_missions as mission on mission.id = candidate.mission_id\n  join public.seasons as report_season on report_season.id = mission.season_id'),
    ('  if v_context.cash_balance < v_candidate.signing_fee then',
      $guard$  -- scouting_candidate_age_v1: always recheck against the active season.
  if v_context.game_year < v_candidate.report_game_year then
    raise exception 'La saison de ce rapport de scouting est invalide.';
  end if;
  if v_candidate.age + v_context.game_year - v_candidate.report_game_year > 18 then
    raise exception 'Ce coureur a désormais plus de 18 ans et ne peut plus être recruté depuis ce rapport.';
  end if;
  if v_context.cash_balance < v_candidate.signing_fee then$guard$),
    ('v_context.game_year - v_candidate.age', 'v_candidate.report_game_year - v_candidate.age')
  ) patches(before_text,after_text)
  loop
    if (length(v_definition)-length(replace(v_definition,v_patch.before_text,'')))/length(v_patch.before_text)<>1 then
      raise exception 'Scouting candidate age signing anchor changed; review before applying.';
    end if;
    v_definition:=replace(v_definition,v_patch.before_text,v_patch.after_text);
  end loop;
  execute v_definition;
end;
$patch$;

-- No existing candidate, academy rider, contract, report or balance is changed.
notify pgrst,'reload schema';
commit;
