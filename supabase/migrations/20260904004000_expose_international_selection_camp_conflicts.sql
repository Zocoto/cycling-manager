begin;

-- Un tour déjà verrouillé ou commencé protège le coureur sur toute la journée :
-- il reste impossible d'enchaîner une étape et un championnat le même jour.
-- La distinction des créneaux ne s'applique qu'aux courses d'un jour encore
-- modifiables, dans les contrôles et retraits plus bas.
create or replace function public.is_rider_protected_by_stage_race_for_international_selection(
  p_rider_id uuid,
  p_target_race_edition_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.race_editions as target_edition
    join public.race_rosters as roster
      on roster.rider_id = p_rider_id
     and roster.status in ('selected', 'confirmed')
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = registration.race_edition_id
     and other_edition.id <> target_edition.id
     and other_edition.season_id = target_edition.season_id
    join public.races as other_race
      on other_race.id = other_edition.race_id
     and other_race.race_format = 'stage_race'
    where target_edition.id = p_target_race_edition_id
      and exists (
        select 1
        from public.stages as unfinished_stage
        where unfinished_stage.race_edition_id = other_edition.id
          and unfinished_stage.status <> 'completed'
      )
      and (
        other_edition.withdrawal_closes_at is null
        or other_edition.withdrawal_closes_at <= p_at
        or exists (
          select 1
          from public.stages as started_stage
          where started_stage.race_edition_id = other_edition.id
            and started_stage.departure_at is not null
            and started_stage.departure_at <= p_at
        )
      )
      and exists (
        select 1
        from public.stages as target_stage
        join public.stages as other_stage
          on other_stage.season_day_id = target_stage.season_day_id
         and other_stage.race_edition_id = other_edition.id
        where target_stage.race_edition_id = target_edition.id
      )
  );
$$;

-- Les convocations doivent annoncer toutes les activités qui seront annulées
-- après validation du DS, comme elles annoncent déjà les courses sacrifiées.
create or replace function public.get_rider_international_selection_conflicting_camp_names(
  p_rider_id uuid,
  p_target_race_edition_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(
      conflict.label
      order by conflict.start_day_number, conflict.end_day_number, conflict.label
    ),
    array[]::text[]
  )
  from (
    select
      camp.start_day_number,
      camp.end_day_number,
      case camp.camp_type
        when 'reconnaissance' then
          'Stage de reconnaissance'
            || case
              when reconnaissance.race_name is not null
                then ' · ' || reconnaissance.race_name
              else ''
            end
            || format(
              ' · J%s–J%s',
              camp.start_day_number,
              camp.end_day_number
            )
        when 'classic' then format(
          'Stage de forme classique · J%s–J%s',
          camp.start_day_number,
          camp.end_day_number
        )
        when 'premium' then format(
          'Stage de forme premium · J%s–J%s',
          camp.start_day_number,
          camp.end_day_number
        )
        when 'indoor_preparation' then format(
          'Préparation · Piste indoor · J%s–J%s',
          camp.start_day_number,
          camp.end_day_number
        )
        when 'wind_tunnel_preparation' then format(
          'Préparation · Soufflerie · J%s–J%s',
          camp.start_day_number,
          camp.end_day_number
        )
        else format(
          'Stage · J%s–J%s',
          camp.start_day_number,
          camp.end_day_number
        )
      end as label
    from public.race_editions as target_edition
    join lateral (
      select
        min(day.day_number)::integer as start_day_number,
        max(day.day_number)::integer as end_day_number
      from public.stages as stage
      join public.season_days as day
        on day.id = stage.season_day_id
      where stage.race_edition_id = target_edition.id
    ) as target_range
      on target_range.start_day_number is not null
     and target_range.end_day_number is not null
    join public.rider_form_camps as camp
      on camp.rider_id = p_rider_id
     and camp.season_id = target_edition.season_id
     and camp.status in ('planned', 'active')
     and camp.start_day_number <= target_range.end_day_number
     and camp.end_day_number >= target_range.start_day_number
    left join lateral (
      select target_race_edition.display_name as race_name
      from public.stage_reconnaissance_riders as participant
      join public.stage_reconnaissances as stage_reconnaissance
        on stage_reconnaissance.id = participant.reconnaissance_id
      join public.stages as target_stage
        on target_stage.id = stage_reconnaissance.target_stage_id
      join public.race_editions as target_race_edition
        on target_race_edition.id = target_stage.race_edition_id
      where participant.form_camp_id = camp.id
      limit 1
    ) as reconnaissance on true
    where target_edition.id = p_target_race_edition_id
  ) as conflict;
$$;

revoke all
on function public.get_rider_international_selection_conflicting_camp_names(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.get_rider_international_selection_conflicting_camp_names(uuid, uuid)
to service_role;

-- Un conflit de stage est un conflit de calendrier au même titre qu'une
-- course : sans réponse explicite du DS, la convocation ne l'annulera pas au
-- moment du départ.
create or replace function public.has_rider_calendar_conflict_for_international_selection(
  p_rider_id uuid,
  p_target_race_edition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.race_editions as target_edition
      join public.races as target_race
        on target_race.id = target_edition.race_id
      join public.race_rosters as roster
        on roster.rider_id = p_rider_id
       and roster.status in ('selected', 'confirmed')
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
       and registration.status = 'accepted'
      join public.race_editions as other_edition
        on other_edition.id = registration.race_edition_id
       and other_edition.id <> target_edition.id
       and other_edition.season_id = target_edition.season_id
      join public.races as other_race
        on other_race.id = other_edition.race_id
      where target_edition.id = p_target_race_edition_id
        and not (
          (
            target_race.competition_type = 'world_championship'
            and other_race.competition_type = 'world_championship'
          )
          or (
            target_race.competition_type = 'continental_championship'
            and other_race.competition_type = 'continental_championship'
            and other_race.championship_continent_code =
              target_race.championship_continent_code
          )
        )
        and exists (
          select 1
          from public.stages as target_stage
          join public.stages as other_stage
            on other_stage.season_day_id = target_stage.season_day_id
           and other_stage.day_slot = target_stage.day_slot
           and other_stage.race_edition_id = other_edition.id
          where target_stage.race_edition_id = target_edition.id
        )
    )
    or cardinality(
      public.get_rider_international_selection_conflicting_camp_names(
        p_rider_id,
        p_target_race_edition_id
      )
    ) > 0;
$$;

revoke all
on function public.has_rider_calendar_conflict_for_international_selection(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.has_rider_calendar_conflict_for_international_selection(uuid, uuid)
to service_role;

-- La priorité internationale n'est appliquée qu'après validation explicite
-- ou pour une convocation automatique sans aucun conflit. Les stages futurs
-- annulés sont remboursés une seule fois ; les stages déjà commencés ne le
-- sont pas. Une reconnaissance collective est remboursée au prorata de la
-- participation retirée afin de ne jamais rembourser plus que son coût total.
create or replace function public.prioritize_international_championship_rider(
  p_nation_selection_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection public.international_championship_nation_selections%rowtype;
  v_target_start_day integer;
  v_target_end_day integer;
  v_target_competition_type text;
  v_target_season_id uuid;
  v_current_day_number integer;
  v_current_season_day_id uuid;
  v_candidate_response_status text;
  v_camp record;
  v_refund_transaction_id uuid;
begin
  select selection.*
  into v_selection
  from public.international_championship_nation_selections as selection
  where selection.id = p_nation_selection_id;

  if not found then
    return;
  end if;

  select candidate.response_status
  into v_candidate_response_status
  from public.international_championship_rider_selections as candidate
  where candidate.nation_selection_id = p_nation_selection_id
    and candidate.rider_id = p_rider_id
    and candidate.is_selected = true
  order by candidate.rider_rank
  limit 1;

  select race.competition_type, edition.season_id
  into v_target_competition_type, v_target_season_id
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  where edition.id = v_selection.race_edition_id;

  select min(day.day_number), max(day.day_number)
  into v_target_start_day, v_target_end_day
  from public.stages as stage
  join public.season_days as day on day.id = stage.season_day_id
  where stage.race_edition_id = v_selection.race_edition_id;

  if public.is_rider_protected_by_stage_race_for_international_selection(
    p_rider_id,
    v_selection.race_edition_id,
    now()
  ) then
    return;
  end if;

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.race_editions as other_edition,
       public.races as other_race
  where registration.id = roster.race_registration_id
    and other_edition.id = registration.race_edition_id
    and other_race.id = other_edition.race_id
    and roster.rider_id = p_rider_id
    and roster.status in ('selected', 'confirmed')
    and registration.status = 'accepted'
    and other_edition.id <> v_selection.race_edition_id
    and not (
      v_target_competition_type = 'world_championship'
      and other_race.competition_type = 'world_championship'
    )
    and exists (
      select 1
      from public.stages as target_stage
      join public.stages as other_stage
        on other_stage.season_day_id = target_stage.season_day_id
       and other_stage.day_slot = target_stage.day_slot
       and other_stage.race_edition_id = other_edition.id
      where target_stage.race_edition_id = v_selection.race_edition_id
    );

  update public.race_registrations as registration
  set status = 'withdrawn', decided_at = now()
  where registration.race_edition_id <> v_selection.race_edition_id
    and registration.status = 'accepted'
    and exists (
      select 1
      from public.race_rosters as affected_roster
      where affected_roster.race_registration_id = registration.id
        and affected_roster.rider_id = p_rider_id
        and affected_roster.status = 'withdrawn'
    )
    and not exists (
      select 1
      from public.race_rosters as remaining_roster
      where remaining_roster.race_registration_id = registration.id
        and remaining_roster.status in ('selected', 'confirmed')
    );

  select
    coalesce(season.current_day_number, 1)::integer,
    season_day.id
  into v_current_day_number, v_current_season_day_id
  from public.seasons as season
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
  where season.id = v_target_season_id;

  for v_camp in
    select
      camp.*,
      reconnaissance.reconnaissance_id,
      reconnaissance.race_name as reconnaissance_race_name,
      coalesce(reconnaissance.refund_amount, camp.total_price)
        as refund_amount
    from public.rider_form_camps as camp
    left join lateral (
      select
        shares.reconnaissance_id,
        shares.race_name,
        case
          when shares.participant_index < shares.participant_count
            then round(shares.total_price / shares.participant_count, 2)
          else shares.total_price
            - round(shares.total_price / shares.participant_count, 2)
              * (shares.participant_count - 1)
        end as refund_amount
      from (
        select
          stage_reconnaissance.id as reconnaissance_id,
          target_edition.display_name as race_name,
          stage_reconnaissance.total_price,
          count(all_participants.id)::numeric as participant_count,
          array_position(
            array_agg(
              all_participants.form_camp_id
              order by all_participants.form_camp_id
            ),
            camp.id
          )::numeric as participant_index
        from public.stage_reconnaissance_riders as participant
        join public.stage_reconnaissances as stage_reconnaissance
          on stage_reconnaissance.id = participant.reconnaissance_id
        join public.stage_reconnaissance_riders as all_participants
          on all_participants.reconnaissance_id = stage_reconnaissance.id
        join public.stages as target_stage
          on target_stage.id = stage_reconnaissance.target_stage_id
        join public.race_editions as target_edition
          on target_edition.id = target_stage.race_edition_id
        where participant.form_camp_id = camp.id
        group by
          stage_reconnaissance.id,
          stage_reconnaissance.total_price,
          target_edition.display_name,
          camp.id
      ) as shares
    ) as reconnaissance on true
    where camp.rider_id = p_rider_id
      and camp.status in ('planned', 'active')
      and camp.start_day_number <= v_target_end_day
      and camp.end_day_number >= v_target_start_day
      and camp.season_id = v_target_season_id
    order by camp.start_day_number, camp.id
    for update of camp
  loop
    if v_camp.status = 'planned'
      and v_current_day_number < v_camp.start_day_number
      and v_candidate_response_status = 'confirmed'
    then
      if v_camp.camp_type = 'reconnaissance'
        and v_camp.reconnaissance_id is null
      then
        raise exception
          'La reconnaissance à rembourser est introuvable pour le coureur %.',
          p_rider_id;
      end if;

      if v_camp.refund_amount > 0 then
        v_refund_transaction_id := null;

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
          v_camp.team_season_id,
          v_current_season_day_id,
          v_current_day_number,
          v_camp.refund_amount,
          'training',
          'posted',
          case v_camp.camp_type
            when 'reconnaissance' then
              'Remboursement convocation · stage de reconnaissance'
                || case
                  when v_camp.reconnaissance_race_name is not null
                    then ' · ' || v_camp.reconnaissance_race_name
                  else ''
                end
            when 'premium' then
              'Remboursement convocation · stage de forme premium'
            when 'classic' then
              'Remboursement convocation · stage de forme classique'
            when 'indoor_preparation' then
              'Remboursement convocation · préparation piste indoor'
            when 'wind_tunnel_preparation' then
              'Remboursement convocation · préparation en soufflerie'
            else 'Remboursement convocation · stage'
          end
            || ' · J' || v_camp.start_day_number::text
            || case
              when v_camp.end_day_number > v_camp.start_day_number
                then '–J' || v_camp.end_day_number::text
              else ''
            end,
          'international-selection-camp-refund:' || v_camp.id::text,
          now()
        )
        on conflict (team_season_id, source_reference) do nothing
        returning id into v_refund_transaction_id;

        if v_refund_transaction_id is not null then
          update public.team_seasons as team_season
          set cash_balance = team_season.cash_balance + v_camp.refund_amount
          where team_season.id = v_camp.team_season_id;
        end if;
      end if;
    end if;

    update public.rider_form_camps as camp
    set status = 'cancelled', completed_at = now()
    where camp.id = v_camp.id;

    if v_camp.reconnaissance_id is not null
      and not exists (
        select 1
        from public.stage_reconnaissance_riders as participant
        join public.rider_form_camps as participant_camp
          on participant_camp.id = participant.form_camp_id
        where participant.reconnaissance_id = v_camp.reconnaissance_id
          and participant_camp.status in ('planned', 'active')
      )
    then
      update public.stage_reconnaissances as stage_reconnaissance
      set status = 'cancelled', completed_at = now()
      where stage_reconnaissance.id = v_camp.reconnaissance_id
        and stage_reconnaissance.status in ('planned', 'active');
    end if;
  end loop;
end;
$$;

revoke all
on function public.prioritize_international_championship_rider(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.prioritize_international_championship_rider(uuid, uuid)
to service_role;

drop function if exists public.get_international_championship_selections_for_auth_user(uuid);

create function public.get_international_championship_selections_for_auth_user(
  p_auth_user_id uuid
)
returns table (
  candidate_id uuid,
  rider_id uuid,
  rider_name text,
  rider_rank integer,
  uci_points integer,
  overall_rating numeric,
  response_status text,
  is_selected boolean,
  was_selected boolean,
  responded_at timestamptz,
  country_name text,
  country_code text,
  nation_rank integer,
  continent_code text,
  championship_name text,
  championship_slug text,
  competition_type text,
  race_edition_id uuid,
  day_number integer,
  departure_at timestamptz,
  conflicting_race_names text[],
  conflicting_camp_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate.id as candidate_id,
    candidate.rider_id,
    concat_ws(' ', rider.first_name, rider.last_name) as rider_name,
    candidate.rider_rank,
    candidate.uci_points,
    candidate.overall_rating,
    candidate.response_status,
    candidate.is_selected,
    candidate.selected_at is not null as was_selected,
    candidate.responded_at,
    country.name as country_name,
    country.iso_alpha2 as country_code,
    selection.nation_rank::integer,
    selection.continent_code,
    edition.display_name as championship_name,
    race.slug as championship_slug,
    race.competition_type,
    edition.id as race_edition_id,
    first_stage.day_number,
    first_stage.departure_at,
    coalesce(conflicts.race_names, array[]::text[])
      as conflicting_race_names,
    public.get_rider_international_selection_conflicting_camp_names(
      candidate.rider_id,
      edition.id
    ) as conflicting_camp_names
  from public.sporting_directors as director
  join public.international_championship_rider_selections as candidate
    on candidate.sporting_director_id = director.id
  join public.international_championship_nation_selections as selection
    on selection.id = candidate.nation_selection_id
  join public.riders as rider
    on rider.id = candidate.rider_id
  join public.countries as country
    on country.id = selection.country_id
  join public.race_editions as edition
    on edition.id = selection.race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in (
     'continental_championship',
     'world_championship'
   )
  join lateral (
    select
      day.day_number::integer as day_number,
      stage.departure_at
    from public.stages as stage
    join public.season_days as day
      on day.id = stage.season_day_id
    where stage.race_edition_id = edition.id
      and stage.departure_at is not null
    order by stage.departure_at, stage.stage_number
    limit 1
  ) as first_stage on true
  left join lateral (
    select array_agg(
      distinct other_edition.display_name
      order by other_edition.display_name
    ) as race_names
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = registration.race_edition_id
     and other_edition.id <> edition.id
     and other_edition.season_id = edition.season_id
    join public.races as other_race
      on other_race.id = other_edition.race_id
    where roster.rider_id = candidate.rider_id
      and roster.status in ('selected', 'confirmed')
      and not (
        (
          race.competition_type = 'world_championship'
          and other_race.competition_type = 'world_championship'
        )
        or (
          race.competition_type = 'continental_championship'
          and other_race.competition_type = 'continental_championship'
          and other_race.championship_continent_code =
            race.championship_continent_code
        )
      )
      and exists (
        select 1
        from public.stages as target_stage
        join public.stages as other_stage
          on other_stage.season_day_id = target_stage.season_day_id
         and other_stage.day_slot = target_stage.day_slot
         and other_stage.race_edition_id = other_edition.id
        where target_stage.race_edition_id = edition.id
      )
  ) as conflicts on true
  where director.auth_user_id = p_auth_user_id
    and director.status = 'active'
    and (
      candidate.is_selected
      or candidate.selected_at is not null
      or candidate.response_status in (
        'confirmed',
        'automatic',
        'declined'
      )
    )
  order by
    first_stage.departure_at,
    candidate.rider_rank,
    rider.last_name,
    rider.first_name;
$$;

revoke all
on function public.get_international_championship_selections_for_auth_user(uuid)
from public, anon, authenticated;

grant execute
on function public.get_international_championship_selections_for_auth_user(uuid)
to service_role;

create or replace function public.sync_director_international_selection_message(
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type,
    sender_name, subject, preview, body, action_href, action_label,
    source_reference, is_important, sent_at
  )
  select
    candidate.sporting_director_id,
    edition.season_id,
    team_season.id,
    'international_selection',
    'Sélection nationale',
    concat_ws(' ', rider.first_name, rider.last_name) || ' appelé en sélection',
    edition.display_name || ' · ' || country.name,
    format(
      '%s est retenu avec %s pour %s. Vous pouvez confirmer sa priorité ou le retirer avant la clôture de la sélection.',
      concat_ws(' ', rider.first_name, rider.last_name),
      country.name,
      edition.display_name
    ) || case
      when cardinality(coalesce(conflicts.race_names, array[]::text[])) = 1
        then E'\n\nSi vous acceptez la convocation, votre coureur sera désinscrit de la course '
          || conflicts.race_names[1] || '.'
      when cardinality(coalesce(conflicts.race_names, array[]::text[])) > 1
        then E'\n\nSi vous acceptez la convocation, votre coureur sera désinscrit des courses '
          || array_to_string(conflicts.race_names, ', ') || '.'
      else ''
    end || case
      when cardinality(camp_conflicts.camp_names) = 1
        then E'\n\nSi vous acceptez la convocation, l’activité programmée suivante sera annulée pour votre coureur : '
          || camp_conflicts.camp_names[1] || '.'
      when cardinality(camp_conflicts.camp_names) > 1
        then E'\n\nSi vous acceptez la convocation, les activités programmées suivantes seront annulées pour votre coureur : '
          || array_to_string(camp_conflicts.camp_names, ', ') || '.'
      else ''
    end || case
      when cardinality(camp_conflicts.camp_names) > 0
        then E'\nLe coût d’un stage qui n’a pas encore commencé sera remboursé ; un stage déjà commencé ne le sera pas.'
      else ''
    end,
    '/jeu/selections-internationales#selection-' || candidate.id,
    'Répondre à la sélection',
    'international-selection:' || candidate.id,
    candidate.response_status = 'pending',
    coalesce(candidate.selected_at, candidate.created_at)
  from public.international_championship_rider_selections as candidate
  join public.international_championship_nation_selections as nation_selection
    on nation_selection.id = candidate.nation_selection_id
  join public.race_editions as edition
    on edition.id = nation_selection.race_edition_id
  join public.races as race on race.id = edition.race_id
  join public.countries as country on country.id = nation_selection.country_id
  join public.riders as rider on rider.id = candidate.rider_id
  left join public.team_seasons as team_season
    on team_season.team_id = candidate.team_id
   and team_season.season_id = edition.season_id
  left join lateral (
    select array_agg(
      distinct other_edition.display_name
      order by other_edition.display_name
    ) as race_names
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = registration.race_edition_id
     and other_edition.id <> edition.id
     and other_edition.season_id = edition.season_id
    join public.races as other_race
      on other_race.id = other_edition.race_id
    where roster.rider_id = candidate.rider_id
      and roster.status in ('selected', 'confirmed')
      and not (
        (
          race.competition_type = 'world_championship'
          and other_race.competition_type = 'world_championship'
        )
        or (
          race.competition_type = 'continental_championship'
          and other_race.competition_type = 'continental_championship'
          and other_race.championship_continent_code =
            race.championship_continent_code
        )
      )
      and exists (
        select 1
        from public.stages as target_stage
        join public.stages as other_stage
          on other_stage.season_day_id = target_stage.season_day_id
         and other_stage.day_slot = target_stage.day_slot
         and other_stage.race_edition_id = other_edition.id
        where target_stage.race_edition_id = edition.id
      )
  ) as conflicts on true
  left join lateral (
    select public.get_rider_international_selection_conflicting_camp_names(
      candidate.rider_id,
      edition.id
    ) as camp_names
  ) as camp_conflicts on true
  where candidate.id = p_candidate_id
    and candidate.sporting_director_id is not null
    and candidate.is_selected = true
    and candidate.response_status in ('pending', 'confirmed', 'automatic')
  on conflict (sporting_director_id, source_reference)
  do update set
    subject = excluded.subject,
    preview = excluded.preview,
    body = excluded.body,
    is_important = excluded.is_important;
end;
$$;

revoke all
on function public.sync_director_international_selection_message(uuid)
from public, anon, authenticated;

grant execute
on function public.sync_director_international_selection_message(uuid)
to service_role;

-- Rafraîchit les convocations déjà présentes sans recréer de message ni
-- modifier la date d'envoi.
do $refresh_existing_messages$
declare
  v_candidate_id uuid;
begin
  for v_candidate_id in
    select candidate.id
    from public.international_championship_rider_selections as candidate
    where candidate.sporting_director_id is not null
      and candidate.is_selected = true
      and candidate.response_status in ('pending', 'confirmed', 'automatic')
  loop
    perform public.sync_director_international_selection_message(
      v_candidate_id
    );
  end loop;
end;
$refresh_existing_messages$;

notify pgrst, 'reload schema';

commit;
