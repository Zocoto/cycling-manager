begin;

-- CN are automatic top-200 entries managed in the S2 matrix, not invitations.
-- Keep registration, withdrawal and result publication entirely unchanged.
do $migration$
declare
  v_definition text;
  v_notification_start integer;
  v_return_start integer;
  v_notification_block text;
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.sync_national_championship_registrations(uuid,timestamptz)'::regprocedure
  ), chr(13), '') into v_definition;
  v_notification_start := position('  insert into public.national_championship_notifications (' in v_definition);
  v_return_start := position('  return v_synced;' in v_definition);
  if v_notification_start = 0 or v_return_start <= v_notification_start then
    raise exception 'Unexpected CN notification block; registration logic left unchanged.';
  end if;
  v_notification_block := substring(v_definition from v_notification_start for v_return_start - v_notification_start);
  if position('''selection''' in v_notification_block) = 0
    or position('on conflict (team_season_id, race_edition_id, notification_type)' in v_notification_block) = 0
    or right(btrim(v_notification_block, E' \t\n\r'), length('message = excluded.message;')) <> 'message = excluded.message;' then
    raise exception 'CN notification block has changed; migration aborted.';
  end if;
  execute overlay(v_definition placing
    E'  -- CN entries stay automatic and editable in the unified matrix; no invitation.\n\n'
    from v_notification_start for v_return_start - v_notification_start);

  -- Also block old source notifications from being mirrored/reimported later.
  -- Result notifications still follow the existing path, including read state.
  select replace(pg_catalog.pg_get_functiondef(
    'public.sync_director_national_championship_message(uuid)'::regprocedure
  ), chr(13), '') into v_definition;
  if position('  where notification.id = p_notification_id' in v_definition) = 0 then
    raise exception 'Unexpected CN mailbox synchronizer; migration aborted.';
  end if;
  execute replace(v_definition,
    '  where notification.id = p_notification_id',
    E'  where notification.id = p_notification_id\n    and notification.notification_type <> ''selection''');
end;
$migration$;

-- Professional automatic selections use the existing invitation windows:
-- Worlds H-96; Continentals and Nations Cup H-24. The actual departure is
-- authoritative, and a departed event can never issue new invitations.
create or replace function public.federation_professional_call_up_is_due(
  p_competition_code text,
  p_departure_at timestamptz,
  p_now timestamptz
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select p_departure_at > p_now
    and p_competition_code in ('world_championship', 'continental_championship', 'nations_cup')
    and p_now >= p_departure_at - case p_competition_code
      when 'world_championship' then interval '96 hours'
      else interval '24 hours'
    end;
$$;

revoke all on function public.federation_professional_call_up_is_due(text,timestamptz,timestamptz)
from public, anon, authenticated;
grant execute on function public.federation_professional_call_up_is_due(text,timestamptz,timestamptz)
to service_role;

do $migration$
declare
  v_definition text;
  v_anchor constant text := '      if v_edition_id is null then continue; end if;';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.prepare_due_automatic_federation_professional_lineups(timestamptz)'::regprocedure
  ), chr(13), '') into v_definition;
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) <> length(v_anchor)
    or position('and v_season.current_day_number + 3' in v_definition) = 0 then
    raise exception 'Unexpected professional automatic selection scheduler; migration aborted.';
  end if;
  -- Include Worlds in the coarse scan from J-4, then check the exact date.
  v_definition := replace(v_definition,
    'and v_season.current_day_number + 3', 'and v_season.current_day_number + 4');
  v_definition := replace(v_definition, v_anchor, v_anchor || E'\n'
    || E'      if public.federation_professional_call_up_is_due(\n'
    || E'        v_slot.competition_code, v_departure_at, p_now\n'
    || E'      ) is not true then continue; end if;');
  execute v_definition;

  -- Junior callers include the race simulator, not just the due scheduler.
  -- Put the J-3 boundary in the producer itself, before any list is published.
  select replace(pg_catalog.pg_get_functiondef(
    'public.ensure_automatic_federation_junior_lineups(uuid)'::regprocedure
  ), chr(13), '') into v_definition;
  if position('  if v_season.game_year < 3 then return 0; end if;' in v_definition) = 0 then
    raise exception 'Unexpected junior automatic selection producer; migration aborted.';
  end if;
  execute replace(v_definition,
    '  if v_season.game_year < 3 then return 0; end if;',
    E'  if v_season.game_year < 3\n'
    || E'    or v_season.status <> ''active''\n'
    || E'    or v_edition.status in (''completed'', ''cancelled'')\n'
    || E'    or v_season.current_day_number < v_edition.start_day_number - 3\n'
    || E'  then return 0; end if;');
end;
$migration$;

-- Do not send or erase any existing player message as part of this deployment.
notify pgrst, 'reload schema';

commit;
