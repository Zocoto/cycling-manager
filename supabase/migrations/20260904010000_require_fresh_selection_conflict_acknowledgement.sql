begin;

-- Une convocation peut rester ouverte pendant que le DS modifie le calendrier
-- dans un autre onglet. La confirmation compare donc les conflits affichés au
-- dernier état transactionnel et demande une seconde validation s'ils ont
-- changé depuis le rendu de la page.
create or replace function public.respond_to_international_selection_with_conflict_ack(
  p_candidate_id uuid,
  p_accept boolean,
  p_acknowledged_conflicts text[] default array[]::text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_id uuid;
  v_target_race_edition_id uuid;
  v_target_season_id uuid;
  v_target_competition_type text;
  v_target_continent_code text;
  v_current_conflicts text[];
  v_acknowledged_conflicts text[];
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('international-championship-selections', 0)
  );

  select
    candidate.rider_id,
    edition.id,
    edition.season_id,
    race.competition_type,
    race.championship_continent_code
  into
    v_rider_id,
    v_target_race_edition_id,
    v_target_season_id,
    v_target_competition_type,
    v_target_continent_code
  from public.sporting_directors as director
  join public.international_championship_rider_selections as candidate
    on candidate.sporting_director_id = director.id
   and candidate.id = p_candidate_id
  join public.international_championship_nation_selections as selection
    on selection.id = candidate.nation_selection_id
  join public.race_editions as edition
    on edition.id = selection.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active';

  if v_rider_id is null then
    raise exception using
      errcode = '42501',
      message = 'Vous ne pouvez pas répondre pour ce coureur.';
  end if;

  if p_accept then
    select coalesce(
      array_agg(conflict.conflict_reference order by conflict.conflict_reference),
      array[]::text[]
    )
    into v_current_conflicts
    from (
      select distinct
        'course:' || other_edition.display_name as conflict_reference
      from public.race_rosters as roster
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
       and registration.status = 'accepted'
      join public.race_editions as other_edition
        on other_edition.id = registration.race_edition_id
       and other_edition.id <> v_target_race_edition_id
       and other_edition.season_id = v_target_season_id
      join public.races as other_race
        on other_race.id = other_edition.race_id
      where roster.rider_id = v_rider_id
        and roster.status in ('selected', 'confirmed')
        and not (
          (
            v_target_competition_type = 'world_championship'
            and other_race.competition_type = 'world_championship'
          )
          or (
            v_target_competition_type = 'continental_championship'
            and other_race.competition_type = 'continental_championship'
            and other_race.championship_continent_code =
              v_target_continent_code
          )
        )
        and exists (
          select 1
          from public.stages as target_stage
          join public.stages as other_stage
            on other_stage.season_day_id = target_stage.season_day_id
           and other_stage.day_slot = target_stage.day_slot
           and other_stage.race_edition_id = other_edition.id
          where target_stage.race_edition_id = v_target_race_edition_id
        )

      union

      select distinct
        'activité:' || camp_conflict.camp_name as conflict_reference
      from unnest(
        public.get_rider_international_selection_conflicting_camp_names(
          v_rider_id,
          v_target_race_edition_id
        )
      ) as camp_conflict(camp_name)
    ) as conflict;

    select coalesce(
      array_agg(
        distinct acknowledged.conflict_reference
        order by acknowledged.conflict_reference
      ),
      array[]::text[]
    )
    into v_acknowledged_conflicts
    from unnest(
      coalesce(p_acknowledged_conflicts, array[]::text[])
    ) as acknowledged(conflict_reference);

    if v_current_conflicts is distinct from v_acknowledged_conflicts then
      raise exception using
        errcode = 'P0001',
        message = 'Le calendrier de ce coureur a changé depuis l’affichage de la convocation. Les conflits à jour sont maintenant visibles : relisez-les puis confirmez de nouveau.';
    end if;
  end if;

  perform public.respond_to_international_championship_selection(
    p_candidate_id,
    p_accept
  );
end;
$$;

revoke all
on function public.respond_to_international_selection_with_conflict_ack(
  uuid,
  boolean,
  text[]
)
from public, anon;

grant execute
on function public.respond_to_international_selection_with_conflict_ack(
  uuid,
  boolean,
  text[]
)
to authenticated;

-- Le message en boîte mail est lui aussi rafraîchi lorsqu'un stage est ajouté
-- après l'envoi initial de la convocation.
create or replace function public.refresh_pending_international_selection_messages_for_rider(
  p_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_id uuid;
begin
  for v_candidate_id in
    select candidate.id
    from public.international_championship_rider_selections as candidate
    where candidate.rider_id = p_rider_id
      and candidate.is_selected = true
      and candidate.response_status = 'pending'
  loop
    perform public.sync_director_international_selection_message(
      v_candidate_id
    );
  end loop;
end;
$$;

revoke all
on function public.refresh_pending_international_selection_messages_for_rider(uuid)
from public, anon, authenticated;

grant execute
on function public.refresh_pending_international_selection_messages_for_rider(uuid)
to service_role;

create or replace function public.refresh_pending_selection_messages_from_calendar_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.rider_id is distinct from new.rider_id then
    perform public.refresh_pending_international_selection_messages_for_rider(
      old.rider_id
    );
  end if;

  perform public.refresh_pending_international_selection_messages_for_rider(
    case when tg_op = 'DELETE' then old.rider_id else new.rider_id end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_selection_messages_after_form_camp_change
  on public.rider_form_camps;
create trigger refresh_selection_messages_after_form_camp_change
after insert or update or delete on public.rider_form_camps
for each row execute function
  public.refresh_pending_selection_messages_from_calendar_change();

drop trigger if exists refresh_selection_messages_after_reconnaissance_rider_change
  on public.stage_reconnaissance_riders;
create trigger refresh_selection_messages_after_reconnaissance_rider_change
after insert or update or delete on public.stage_reconnaissance_riders
for each row execute function
  public.refresh_pending_selection_messages_from_calendar_change();

-- Réparation ciblée : Sócrates a confirmé sa sélection neuf minutes avant le
-- déploiement du remboursement. Son camp enfant a été annulé, mais la
-- reconnaissance parente est restée visible et les 20 000 € n'ont pas été
-- recrédités. Les garde-fous ci-dessous empêchent toute correction d'un cas
-- différent.
do $repair_socrates_reconnaissance$
declare
  v_candidate_id constant uuid :=
    '0dc7c2b6-d8e1-4d54-b1c8-70512a3ff85f';
  v_camp_id constant uuid :=
    '3a914a17-423e-498d-bffb-9bc2bc5617b0';
  v_reconnaissance_id constant uuid :=
    '11ef18da-6675-4bcc-8ea3-07279a9d0d4a';
  v_team_season_id constant uuid :=
    '2b9d32d5-8ce5-4810-82f3-c185b4e2ce18';
  v_responded_at timestamptz;
  v_current_day_number integer;
  v_current_season_day_id uuid;
  v_refund_transaction_id uuid;
begin
  select candidate.responded_at
  into v_responded_at
  from public.international_championship_rider_selections as candidate
  join public.international_championship_nation_selections as selection
    on selection.id = candidate.nation_selection_id
  join public.stages as championship_stage
    on championship_stage.race_edition_id = selection.race_edition_id
  join public.season_days as championship_day
    on championship_day.id = championship_stage.season_day_id
  join public.rider_form_camps as camp
    on camp.id = v_camp_id
   and camp.rider_id = candidate.rider_id
   and camp.team_season_id = v_team_season_id
   and camp.camp_type = 'reconnaissance'
   and camp.status = 'cancelled'
   and camp.completed_at = candidate.responded_at
   and championship_day.day_number between
     camp.start_day_number and camp.end_day_number
  join public.stage_reconnaissance_riders as participant
    on participant.form_camp_id = camp.id
   and participant.reconnaissance_id = v_reconnaissance_id
   and participant.rider_id = candidate.rider_id
  join public.stage_reconnaissances as reconnaissance
    on reconnaissance.id = participant.reconnaissance_id
   and reconnaissance.team_season_id = v_team_season_id
   and reconnaissance.total_price = 20000
  where candidate.id = v_candidate_id
    and candidate.response_status = 'confirmed'
    and candidate.is_selected = true;

  if v_responded_at is null then
    raise exception
      'La réparation Sócrates ne correspond plus à l’incident audité.';
  end if;

  if (
    select count(*)
    from public.stage_reconnaissance_riders as participant
    where participant.reconnaissance_id = v_reconnaissance_id
  ) <> 1 then
    raise exception
      'La reconnaissance Sócrates ne contient plus exactement un participant.';
  end if;

  if exists (
    select 1
    from public.stage_reconnaissance_riders as participant
    join public.rider_form_camps as camp
      on camp.id = participant.form_camp_id
    where participant.reconnaissance_id = v_reconnaissance_id
      and camp.status in ('planned', 'active')
  ) then
    raise exception
      'La reconnaissance Sócrates possède encore un participant actif.';
  end if;

  select season.current_day_number, season_day.id
  into v_current_day_number, v_current_season_day_id
  from public.team_seasons as team_season
  join public.seasons as season
    on season.id = team_season.season_id
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  where team_season.id = v_team_season_id;

  insert into public.team_finance_transactions (
    team_season_id,
    season_day_id,
    day_number,
    amount,
    category,
    status,
    description,
    source_reference,
    posted_at
  ) values (
    v_team_season_id,
    v_current_season_day_id,
    v_current_day_number,
    20000,
    'training',
    'posted',
    'Remboursement convocation · stage de reconnaissance · La Cime du Tyrol · J22–J23',
    'international-selection-camp-refund:' || v_camp_id::text,
    now()
  )
  on conflict (team_season_id, source_reference) do nothing
  returning id into v_refund_transaction_id;

  if v_refund_transaction_id is not null then
    update public.team_seasons as team_season
    set cash_balance = team_season.cash_balance + 20000
    where team_season.id = v_team_season_id;
  end if;

  update public.stage_reconnaissances as reconnaissance
  set status = 'cancelled', completed_at = v_responded_at
  where reconnaissance.id = v_reconnaissance_id
    and reconnaissance.status in ('planned', 'active');
end;
$repair_socrates_reconnaissance$;

notify pgrst, 'reload schema';

commit;
