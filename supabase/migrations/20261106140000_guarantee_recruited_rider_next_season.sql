begin;
set local lock_timeout = '500ms';
set local statement_timeout = '8s';
set local application_name = 'cyclostratege-recruitment-contract-minimum-20261106';

-- Apply at acquisition, never at renewal/activation/expiry. Existing contracts
-- and accepted future transfers are deliberately not rewritten.
create function private.ensure_recruited_rider_next_season_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.seasons%rowtype;
  v_start_year integer;
  v_end_year integer;
  v_next_id uuid;
begin
  if new.status <> 'active' or new.acquisition_type not in (
    'daily_auction', 'director_auction', 'free_agent', 'academy',
    'direct_offer', 'season_draft'
  ) then return new; end if;
  -- Deferred academy promotions are inserted after the target season becomes
  -- active inside rollover. Honour their already-promised full future season.
  if new.acquisition_type = 'academy'
    and new.start_season_id::text = pg_catalog.current_setting('cycling_manager.rollover_target_season', true)
  then return new; end if;

  -- Hold the season through acquisition, or fail promptly if rollover owns it.
  -- A caller must not sign an expiring old-season contract from a stale quote.
  begin
    select * into v_current from public.seasons where status = 'active' for share nowait;
  exception when lock_not_available then
    raise exception 'La saison change. Actualisez la page avant de recruter ce coureur.';
  end;
  select game_year into v_start_year from public.seasons where id = new.start_season_id;
  select game_year into v_end_year from public.seasons where id = new.end_season_id;
  if v_start_year < v_current.game_year then
    raise exception 'La saison a changé. Actualisez la page avant de recruter ce coureur.';
  end if;
  -- A promotion already taking effect in a future season covers that full
  -- season. Do not turn a future arrival into an additional two-year promise.
  if v_current.id is null or v_start_year is distinct from v_current.game_year
    or v_end_year is null or v_end_year >= v_current.game_year + 1
  then return new; end if;

  perform 1 from public.riders where id = new.rider_id for update;
  if exists (
    select 1 from public.rider_contracts c
    join public.seasons s on s.id = c.start_season_id
    join public.seasons e on e.id = c.end_season_id
    where c.rider_id = new.rider_id and c.status in ('active', 'planned')
      and v_current.game_year + 1 between s.game_year and e.game_year
  ) then
    raise exception 'Ce coureur a déjà un engagement pour la saison suivante.'
      using errcode = '23514';
  end if;

  select id into v_next_id from public.seasons where game_year = v_current.game_year + 1;
  if v_next_id is null then
    -- Only the calendar identity is needed for contract/capacity accounting.
    -- Do not provision race calendars, teams or gameplay while signing a rider.
    insert into public.seasons(game_year, name, starts_on, ends_on, status, current_day_number)
    values(v_current.game_year + 1, 'Saison ' || (v_current.game_year + 1),
      v_current.ends_on + 1, v_current.ends_on + 28, 'planned', 1)
    on conflict(game_year) do nothing returning id into v_next_id;
    if v_next_id is null then
      select id into v_next_id from public.seasons where game_year = v_current.game_year + 1;
    end if;
  end if;
  new.end_season_id := v_next_id;
  return new;
end;
$$;

-- Draft reservation validates the original single-season award first (aa_).
-- All AFTER INSERT capacity/payroll hooks then see the actual extended term.
create trigger ab_recruited_rider_contract_duration
before insert on public.rider_contracts for each row
execute function private.ensure_recruited_rider_next_season_contract();
revoke all on function private.ensure_recruited_rider_next_season_contract()
  from public, anon, authenticated, service_role;

-- Keep previews, early capacity checks and player messages consistent with
-- the authoritative INSERT rule. Patch current bodies rather than restoring
-- historical versions, preserving deferred-transfer dispatch and draft rules.
do $patch$
declare v_patch record; v_definition text; v_count integer;
begin
  for v_patch in select * from (values
    ('private.assert_trade_roster_capacity(uuid,integer,uuid,uuid)',
      $old$-- New direct contracts last through this season, never a fictitious slot
    -- in S+1. Existing future commitments are nevertheless checked net of the
    -- outgoing rider, including the academy-only reserve.
    v_incoming_slots := case when v_year = p_game_year then 1 else 0 end;$old$,
      $new$-- Both incoming contracts cover the current and following seasons.
    -- Check each season net of the outgoing rider, including academy reserves.
    v_incoming_slots := 1;$new$),
    ('public.try_season_draft_pick(uuid,uuid,uuid)',
      $old$if not public.can_team_reserve_roster_rider(p_team,v_year,p_rider) then return 'roster_full'; end if;$old$,
      $new$if not public.can_team_reserve_roster_rider(p_team,v_year,p_rider)
    or not public.can_team_reserve_roster_rider(p_team,v_year+1,p_rider) then return 'roster_full'; end if;$new$),
    ('public.try_season_draft_pick(uuid,uuid,uuid)',
      $old$rejoint votre équipe jusqu’à la fin de la saison. Aucune indemnité ni prime de signature. Salaire : $old$,
      $new$rejoint votre équipe pour la saison en cours et la suivante. Aucune indemnité ni prime de signature. Salaire : $new$),
    ('public.try_season_draft_pick(uuid,uuid,uuid)',
      $old$ € pour la saison. Revente interdite pendant cette saison.$old$,
      $new$ € par saison. Revente interdite pendant cette saison.$new$),
    ('public.submit_direct_transfer_trade_offer(uuid,numeric,uuid,text)',
      $old$Les deux contrats sont signés jusqu’à la fin de la saison.$old$,
      $new$Les deux contrats couvrent la saison en cours et la suivante.$new$),
    ('public.respond_to_direct_transfer_offer(uuid,boolean)',
      $old$Les nouveaux contrats courent jusqu’à la fin de la saison.$old$,
      $new$Les nouveaux contrats couvrent la saison en cours et la suivante.$new$),
    ('private.respond_to_direct_transfer_offer_cash_20261022(uuid,boolean)',
      $old$signe jusqu’à la fin de la saison en cours.$old$,
      $new$signe pour la saison en cours et la suivante.$new$)
  ) patches(signature, old_text, new_text)
  loop
    v_definition := replace(pg_get_functiondef(v_patch.signature::regprocedure), chr(13), '');
    v_count := (length(v_definition) - length(replace(v_definition, v_patch.old_text, ''))) / length(v_patch.old_text);
    if v_count <> 1 or position(v_patch.new_text in v_definition) > 0 then
      raise exception 'Unexpected recruitment function body: %.', v_patch.signature;
    end if;
    execute replace(v_definition, v_patch.old_text, v_patch.new_text);
  end loop;
end;
$patch$;

notify pgrst, 'reload schema';
commit;
