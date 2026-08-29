begin;

-- The season rollover checks this guard once per free agent. Keep that batch
-- lookup on a small, targeted index instead of scanning the full reward log.
create index if not exists reward_events_free_agent_rider_uci_idx
on public.reward_events (rider_id)
where team_season_id is null
  and uci_points > 0
  and source_type in ('race_result', 'stage_result');

-- A rider who has scored UCI points while unattached now owns a durable piece
-- of sporting history. Such a rider must stay available instead of being
-- retired by the rule that clears free agents after a full season.
do $migration$
declare
  v_definition text;
  v_previous_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.archive_inactive_riders_for_season(uuid)'::regprocedure
  ) into v_definition;

  if position('if v_has_team then' in v_definition) = 0 then
    raise exception
      'La garde de conservation des agents libres est introuvable.';
  end if;

  v_previous_definition := v_definition;
  v_definition := replace(
    v_definition,
    'if v_has_team then',
    'if v_has_team or exists (
      select 1
      from public.reward_events as free_agent_reward
      where free_agent_reward.rider_id = v_rider.id
        and free_agent_reward.team_season_id is null
        and free_agent_reward.uci_points > 0
        and free_agent_reward.source_type in (''race_result'', ''stage_result'')
    ) then'
  );

  if v_definition = v_previous_definition then
    raise exception
      'Impossible de protéger les agents libres ayant marqué des points UCI.';
  end if;

  execute v_definition;
end;
$migration$;

comment on function public.archive_inactive_riders_for_season(uuid) is
  'Archive uniquement les agents libres sans contrat ni point UCI acquis comme agent libre.';

notify pgrst, 'reload schema';

commit;
