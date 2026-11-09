begin;
set local statement_timeout = '25s';
set local lock_timeout = '2s';

alter table public.national_federation_race_projects
  add column reserved_reputation_cost numeric not null default 0,
  add column decision_error text;

-- Only votes opened under the former rule have actually paid reputation.
update public.national_federation_race_projects
set reserved_reputation_cost = reputation_cost
where status = 'voting' and resources_reserved;

create function private.get_national_federation_race_vote_deadline(p_season_id uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((season.ends_on - 1) + time '12:00') at time zone 'Europe/Paris'
  from public.seasons as season where season.id = p_season_id
$$;

revoke all on function private.get_national_federation_race_vote_deadline(uuid)
  from public, anon, authenticated;

create function public.get_national_federation_race_workshop_context(
  p_country_id uuid, p_season_id uuid
)
returns table(available_balance numeric, vote_deadline timestamptz, vote_window_open boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, coalesce(account.balance, 0) -
    private.get_national_federation_reserved_hosting_amount(p_country_id, p_season_id)),
    deadline.value,
    coalesce(season.status = 'active' and now() < deadline.value, false)
  from public.seasons as season
  cross join lateral (
    select private.get_national_federation_race_vote_deadline(season.id) as value
  ) as deadline
  left join public.national_federation_accounts as account
    on account.country_id = p_country_id and account.season_id = season.id
  where season.id = p_season_id
$$;

revoke all on function public.get_national_federation_race_workshop_context(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_national_federation_race_workshop_context(uuid, uuid)
  to service_role;

create function public.get_national_federation_race_workshop_slots(p_target_season_id uuid)
returns table(
  day_number integer, calendar_date date, protected_label text, day_slot text,
  existing_race_count integer, labels text[], unavailable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select id, game_year from public.seasons
    where id = p_target_season_id and status = 'planned'
  ), days as (
    select day.id, day.day_number, day.calendar_date from target
    join public.season_days as day on day.season_id = target.id
  ), stages as (
    select days.day_number, stage.day_slot, race.competition_type, edition.display_name
    from days
    join public.stages as stage on stage.season_day_id = days.id
    join public.race_editions as edition on edition.id = stage.race_edition_id
      and edition.season_id = p_target_season_id and edition.status <> 'cancelled'
    join public.races as race on race.id = edition.race_id and race.status = 'active'
  ), championship_days as (
    select stages.day_number, stages.competition_type from stages
    where stages.competition_type <> 'standard'
    union all
    select days.day_number, edition.competition_type
    from public.development_race_editions as edition
    join days on days.day_number between edition.start_day_number and edition.end_day_number
    where edition.season_id = p_target_season_id and edition.status <> 'cancelled'
  ), protections as (
    select day_number, string_agg(distinct label, ' · ' order by label) as label
    from (
      select championship_days.day_number, case
        when competition_type in ('national_road', 'national_time_trial') then 'CN'
        when competition_type in ('continental_championship', 'continental_road', 'continental_time_trial') then 'CC'
        when competition_type in ('world_championship', 'world_road', 'world_time_trial') then 'CM'
        when competition_type in ('nations_cup', 'nations_cup_junior') then
          case when target.game_year % 4 = 0 then 'JQ' else 'NC' end
      end as label
      from championship_days cross join target
    ) as labelled
    where label is not null
    group by day_number
  ), occupied as (
    select stages.day_number, stages.day_slot, count(*)::integer as race_count,
      array_agg(display_name order by display_name) as names
    from stages where competition_type = 'standard'
    group by stages.day_number, stages.day_slot
  ), reserved as (
    select (project.start_day_number - 1) * 2
      + case project.start_day_slot when 'late' then 1 else 0 end + stage_index.value as slot_index,
      project.name, project.status
    from target
    join public.national_federation_race_projects as project
      on project.activation_game_year = target.game_year
      and project.status in ('voting', 'scheduled', 'active')
    cross join lateral generate_series(0, jsonb_array_length(project.stage_blueprint) - 1) as stage_index(value)
  ), reservations as (
    select slot_index, array_agg(name order by name) filter (where status = 'voting') as names
    from reserved group by slot_index
  )
  select days.day_number, days.calendar_date, protections.label, slot.code,
    coalesce(occupied.race_count, 0),
    coalesce(occupied.names, array[]::text[]) || coalesce(reservations.names, array[]::text[]),
    days.day_number = 1 or protections.label is not null
      or coalesce(occupied.race_count, 0) >= 2 or reservations.slot_index is not null
  from days
  cross join (values ('early', 0), ('late', 1)) as slot(code, position)
  left join protections on protections.day_number = days.day_number
  left join occupied on occupied.day_number = days.day_number and occupied.day_slot = slot.code
  left join reservations on reservations.slot_index = (days.day_number - 1) * 2 + slot.position
  order by days.day_number, slot.position
$$;

revoke all on function public.get_national_federation_race_workshop_slots(uuid)
  from public, anon, authenticated;
grant execute on function public.get_national_federation_race_workshop_slots(uuid)
  to service_role;

-- Preserve the existing profile, schedule and affiliation validation, and change
-- only the few gates and reservations that differ for the new workshop.
do $patch$
declare
  v_definition text;
  v_before text;
  v_after text;
  v_patch record;
begin
  v_definition := pg_get_functiondef(
    'private.validate_national_federation_race_blueprint(uuid,uuid,text,text,integer,text,jsonb)'::regprocedure
  );
  v_before := '  if p_start_day_number not between 1 and 28 or p_start_day_slot not in (''early'', ''late'') then';
  v_after := '  if p_start_day_number = 1 then raise exception ''La J1 est réservée à la préparation de la saison.''; end if;'
    || chr(10) || replace(v_before, 'between 1 and 28', 'between 2 and 28');
  if strpos(v_definition, v_before) = 0 then raise exception 'Garde J1 introuvable'; end if;
  execute replace(v_definition, v_before, v_after);

  v_definition := pg_get_functiondef('public.submit_national_federation_race_vote(text,uuid)'::regprocedure);
  for v_patch in select * from (values
    ($old$  v_reputation numeric;$old$,
     $new$  v_reputation numeric;
  v_vote_opened_at timestamptz;$new$),
    ($old$  if v_account.id is null or v_account.balance < v_project.creation_cost then$old$,
     $new$  if v_account.id is null or v_account.balance -
      private.get_national_federation_reserved_hosting_amount(v_identity.country_id, v_season.id)
      < v_project.creation_cost then$new$),
    ($old$  update public.sporting_directors
  set reputation_points = reputation_points - v_project.reputation_cost
  where id = v_identity.sporting_director_id;
$old$, ''),
    ($old$'reputationCost', v_project.reputation_cost$old$,
     $new$'reputationRequired', v_project.reputation_cost$new$),
    ($old$  v_round := v_project.vote_round + 1;$old$,
     $new$  v_vote_opened_at := clock_timestamp();
  if v_vote_opened_at >= private.get_national_federation_race_vote_deadline(v_season.id) then
    raise exception 'L’ouverture des votes est close depuis J27 à 12 h (heure de Paris).';
  end if;
  v_round := v_project.vote_round + 1;$new$),
    ($old$set status = 'voting', vote_round = v_round, vote_opened_at = now(),
      vote_closes_at = now() + interval '24 hours', rejected_at = null,$old$,
     $new$set status = 'voting', vote_round = v_round, vote_opened_at = v_vote_opened_at,
      vote_closes_at = v_vote_opened_at + interval '24 hours', rejected_at = null,$new$),
    ($old$reservation_account_id = v_account.id, resources_reserved = true,$old$,
     $new$reservation_account_id = v_account.id, resources_reserved = true,
      reserved_reputation_cost = 0, decision_error = null,$new$)
  ) as changes(before_text, after_text)
  loop
    if strpos(v_definition, v_patch.before_text) = 0 then
      raise exception 'Point de modification du vote fédéral introuvable : %', v_patch.before_text;
    end if;
    v_definition := replace(v_definition, v_patch.before_text, v_patch.after_text);
  end loop;
  execute v_definition;

  v_definition := pg_get_functiondef('public.vote_national_federation_race(text,uuid,text)'::regprocedure);
  v_before := 'or v_project.vote_closes_at <= now() then';
  if strpos(v_definition, v_before) = 0 then raise exception 'Date limite de vote introuvable'; end if;
  execute replace(v_definition, v_before, 'or v_project.vote_closes_at <= clock_timestamp() then');

  v_definition := pg_get_functiondef('public.settle_due_national_federation_race_maintenance()'::regprocedure);
  for v_patch in select * from (values
    ($old$  perform public.initialize_due_national_federation_accounts();$old$,
     $new$  if not exists (
    select 1 from public.national_federation_race_projects as project
    where project.status = 'active' and project.activation_game_year < v_season.game_year
      and not exists (
        select 1 from public.national_federation_race_maintenance_charges as charge
        where charge.project_id = project.id and charge.season_id = v_season.id
      )
  ) then return jsonb_build_object('paid', 0, 'cancelled', 0); end if;
  perform public.initialize_due_national_federation_accounts();$new$),
    ($old$    for update skip locked$old$, $new$    limit 8 for update skip locked$new$),
    ($old$    if v_account.id is not null and v_account.balance >= v_project.annual_maintenance_cost then$old$,
     $new$    if v_account.id is not null and v_account.balance -
        private.get_national_federation_reserved_hosting_amount(v_project.country_id, v_season.id)
        >= v_project.annual_maintenance_cost then$new$)
  ) as changes(before_text, after_text)
  loop
    if strpos(v_definition, v_patch.before_text) = 0 then
      raise exception 'Point de modification de l’entretien fédéral introuvable : %', v_patch.before_text;
    end if;
    v_definition := replace(v_definition, v_patch.before_text, v_patch.after_text);
  end loop;
  execute v_definition;
end;
$patch$;

create index if not exists national_federation_race_projects_due_votes_idx
  on public.national_federation_race_projects (vote_closes_at, id) where status = 'voting';

create or replace function public.settle_due_national_federation_race_votes()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_project public.national_federation_race_projects%rowtype;
  v_season public.seasons%rowtype;
  v_target_season_id uuid;
  v_approve integer;
  v_reject integer;
  v_approved integer := 0;
  v_rejected integer := 0;
  v_failed integer := 0;
  v_failed_schedule boolean;
  v_refund_account_id uuid;
  v_country_code text;
  v_member record;
  v_title text;
  v_preview text;
  v_body text;
  v_outcome text;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('settle-federation-race-votes', 0)) then
    return jsonb_build_object('approved', 0, 'rejected', 0, 'failed', 0);
  end if;
  select * into v_season from public.seasons where status = 'active' limit 1 for share;
  if v_season.id is null then return jsonb_build_object('approved', 0, 'rejected', 0, 'failed', 0); end if;

  for v_project in
    select project.* from public.national_federation_race_projects as project
    where project.status = 'voting' and project.vote_closes_at <= now()
    order by project.vote_closes_at, project.id
    limit 8 for update skip locked
  loop
    select count(*) filter (where vote.choice = 'approve')::integer,
      count(*) filter (where vote.choice = 'reject')::integer
    into v_approve, v_reject
    from public.national_federation_race_votes as vote where vote.project_id = v_project.id;
    select upper(country.iso_alpha2) into v_country_code
    from public.countries as country where country.id = v_project.country_id;

    v_failed_schedule := false;
    if v_approve > v_reject then
      begin
        select season.id into v_target_season_id from public.seasons as season
        where season.game_year = v_project.activation_game_year and season.status = 'planned'
        for share;
        if v_target_season_id is null then raise exception 'La saison cible ne peut plus recevoir cette course.'; end if;
        perform pg_advisory_xact_lock(hashtextextended('federation-race-calendar:' || v_target_season_id::text, 0));
        perform private.materialize_national_federation_race(v_project.id);
      exception when raise_exception or unique_violation or check_violation or foreign_key_violation then
        -- A failed materialization is rolled back before the reservation is refunded.
        raise warning 'Course fédérale % non matérialisée : %', v_project.id, sqlerrm;
        v_failed_schedule := true;
      end;
    end if;

    if v_approve > v_reject and not v_failed_schedule then
      update public.national_federation_race_projects set reserved_reputation_cost = 0
      where id = v_project.id;
      v_approved := v_approved + 1;
      v_title := 'Course approuvée par la fédération';
      v_preview := v_project.name || ' rejoint le calendrier à partir de la Saison '
        || v_project.activation_game_year::text || '.';
      v_body := 'Le vote est favorable. La course devient permanente et sa maintenance annuelle sera intégrée aux finances fédérales.';
      v_outcome := 'approved';
    else
      if v_project.resources_reserved then
        v_refund_account_id := v_project.reservation_account_id;
        if v_project.submitted_season_id <> v_season.id then
          select account.id into v_refund_account_id
          from public.national_federation_accounts as account
          where account.country_id = v_project.country_id and account.season_id = v_season.id;
          -- Wait for the current account rather than credit a balance already carried forward.
          if v_refund_account_id is null then continue; end if;
        end if;

        insert into public.national_federation_transactions (
          account_id, day_number, amount, category, description, source_reference, metadata
        ) values (
          v_refund_account_id, coalesce(v_season.current_day_number, 1), v_project.creation_cost, 'refund',
          'Remboursement du projet de course : ' || v_project.name || '.',
          'federation-race:' || v_project.id::text || ':vote:' || v_project.vote_round::text || ':refund',
          jsonb_build_object('projectId', v_project.id, 'voteRound', v_project.vote_round,
            'reputationRefund', v_project.reserved_reputation_cost,
            'reservationAccountId', v_project.reservation_account_id)
        ) on conflict (source_reference) do nothing;
        if found then
          update public.national_federation_accounts
          set balance = balance + v_project.creation_cost, updated_at = now()
          where id = v_refund_account_id;
          if v_project.reserved_reputation_cost > 0 then
            update public.sporting_directors
            set reputation_points = reputation_points + v_project.reserved_reputation_cost
            where id = v_project.submitted_by_director_id;
          end if;
        end if;
      end if;

      update public.national_federation_race_projects
      set status = 'rejected', rejected_at = now(), resources_reserved = false,
        reserved_reputation_cost = 0,
        decision_error = case when v_failed_schedule then 'schedule_unavailable' else null end,
        updated_at = now()
      where id = v_project.id;

      if v_failed_schedule then
        v_failed := v_failed + 1;
        v_title := 'Course impossible à programmer';
        v_preview := v_project.name || ' n’a pas pu être ajoutée au calendrier.';
        v_body := 'Le projet a reçu un vote favorable, mais son créneau ou sa saison cible n’est plus disponible. La réservation a été remboursée.';
        v_outcome := 'schedule-unavailable';
      else
        v_rejected := v_rejected + 1;
        v_title := 'Projet de course refusé';
        v_preview := v_project.name || ' n’a pas obtenu la majorité.';
        v_body := 'La réservation a été remboursée. Le président peut retravailler le brouillon tant que le dépôt reste ouvert.';
        v_outcome := 'rejected';
      end if;
      insert into public.national_federation_journal_entries (
        country_id, season_id, day_number, category, title, detail, source_reference
      ) values (
        v_project.country_id, v_season.id, coalesce(v_season.current_day_number, 1),
        'governance', v_title, v_preview || ' La réservation est rendue.',
        'federation-race:' || v_project.id::text || ':vote:' || v_project.vote_round::text || ':' || v_outcome
      ) on conflict (source_reference) do nothing;
    end if;

    for v_member in
      select electorate.team_id from public.national_federation_race_electorate as electorate
      where electorate.project_id = v_project.id
    loop
      perform private.create_team_operational_message(
        v_member.team_id, 'system', 'Assistant de la fédération', v_title, v_preview, v_body,
        '/jeu/federations/' || lower(v_country_code) || '?onglet=races', 'Voir le résultat',
        'federation-race:' || v_project.id::text || ':vote:' || v_project.vote_round::text
          || ':' || v_outcome || ':' || v_member.team_id::text, true, now()
      );
    end loop;
  end loop;
  return jsonb_build_object('approved', v_approved, 'rejected', v_rejected, 'failed', v_failed);
end;
$$;

commit;
