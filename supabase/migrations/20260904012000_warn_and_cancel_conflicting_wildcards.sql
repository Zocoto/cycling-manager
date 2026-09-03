begin;

-- Une demande de WildCard reste modifiable tant que l'organisateur ne l'a
-- pas arbitrée. Elle doit donc être annoncée comme un conflit potentiel, mais
-- ne peut être touchée qu'après l'accord explicite du Directeur Sportif.
create or replace function public.get_rider_selection_conflicting_wildcards(
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
      distinct other_edition.display_name
      order by other_edition.display_name
    ),
    array[]::text[]
  )
  from public.race_editions as target_edition
  join public.race_rosters as roster
    on roster.rider_id = p_rider_id
   and roster.status in ('selected', 'confirmed')
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
   and registration.status = 'pending'
   and registration.entry_method = 'requested'
  join public.race_editions as other_edition
    on other_edition.id = registration.race_edition_id
   and other_edition.id <> target_edition.id
   and other_edition.season_id = target_edition.season_id
  where target_edition.id = p_target_race_edition_id
    and exists (
      select 1
      from public.stages as target_stage
      join public.stages as other_stage
        on other_stage.season_day_id = target_stage.season_day_id
       and other_stage.day_slot = target_stage.day_slot
       and other_stage.race_edition_id = other_edition.id
      where target_stage.race_edition_id = target_edition.id
    );
$$;

revoke all
on function public.get_rider_selection_conflicting_wildcards(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.get_rider_selection_conflicting_wildcards(uuid, uuid)
to service_role;

-- Le chargement principal conserve sa signature historique ; ce RPC groupé
-- ajoute les WildCards sans requête par coureur.
create or replace function public.get_international_selection_wildcards_for_auth_user(
  p_auth_user_id uuid
)
returns table (
  candidate_id uuid,
  conflicting_wildcard_race_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate.id,
    public.get_rider_selection_conflicting_wildcards(
      candidate.rider_id,
      selection.race_edition_id
    )
  from public.sporting_directors as director
  join public.international_championship_rider_selections as candidate
    on candidate.sporting_director_id = director.id
  join public.international_championship_nation_selections as selection
    on selection.id = candidate.nation_selection_id
  join public.race_editions as edition
    on edition.id = selection.race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  where director.auth_user_id = p_auth_user_id
    and director.status = 'active'
    and (
      candidate.is_selected
      or candidate.selected_at is not null
      or candidate.response_status in ('confirmed', 'automatic', 'declined')
    );
$$;

revoke all
on function public.get_international_selection_wildcards_for_auth_user(uuid)
from public, anon, authenticated;

grant execute
on function public.get_international_selection_wildcards_for_auth_user(uuid)
to service_role;

-- Une WildCard en attente empêche toute confirmation automatique. Sans
-- réponse du DS, le coureur conserve donc sa demande de participation.
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
      public.get_rider_selection_conflicting_wildcards(
        p_rider_id,
        p_target_race_edition_id
      )
    ) > 0
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

alter function public.prioritize_international_championship_rider(uuid, uuid)
rename to prioritize_international_championship_rider_before_wildcards;

revoke all
on function public.prioritize_international_championship_rider_before_wildcards(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.prioritize_international_championship_rider_before_wildcards(uuid, uuid)
to service_role;

-- La composition WildCard n'est modifiée que lorsque la candidature porte
-- déjà le statut confirmed, donc après le clic explicite du DS. Si d'autres
-- coureurs restent proposés, la demande de l'équipe demeure en attente.
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
  v_candidate_response_status text;
begin
  select selection.*
  into v_selection
  from public.international_championship_nation_selections as selection
  where selection.id = p_nation_selection_id;

  if not found then
    return;
  end if;

  if public.is_rider_protected_by_stage_race_for_international_selection(
    p_rider_id,
    v_selection.race_edition_id,
    now()
  ) then
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

  if v_candidate_response_status = 'confirmed' then
    update public.race_rosters as roster
    set status = 'withdrawn'
    from public.race_registrations as registration,
         public.race_editions as other_edition
    where registration.id = roster.race_registration_id
      and other_edition.id = registration.race_edition_id
      and roster.rider_id = p_rider_id
      and roster.status in ('selected', 'confirmed')
      and registration.status = 'pending'
      and registration.entry_method = 'requested'
      and other_edition.id <> v_selection.race_edition_id
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
    where registration.status = 'pending'
      and registration.entry_method = 'requested'
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
  end if;

  perform public.prioritize_international_championship_rider_before_wildcards(
    p_nation_selection_id,
    p_rider_id
  );
end;
$$;

revoke all
on function public.prioritize_international_championship_rider(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.prioritize_international_championship_rider(uuid, uuid)
to service_role;

-- L'accusé de lecture transactionnel distingue une inscription ferme d'une
-- demande de WildCard. Un changement intervenu dans un autre onglet oblige à
-- relire le nouvel avertissement avant confirmation.
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
        'wildcard:' || wildcard_conflict.race_name as conflict_reference
      from unnest(
        public.get_rider_selection_conflicting_wildcards(
          v_rider_id,
          v_target_race_edition_id
        )
      ) as wildcard_conflict(race_name)

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
      when cardinality(wildcard_conflicts.race_names) = 1
        then E'\n\nUne demande de WildCard est en cours pour la course '
          || wildcard_conflicts.race_names[1]
          || '. Si vous acceptez la convocation, ce coureur sera retiré de la composition proposée. Si aucun autre coureur n’y reste inscrit, la demande de participation sera annulée.'
      when cardinality(wildcard_conflicts.race_names) > 1
        then E'\n\nDes demandes de WildCard sont en cours pour les courses '
          || array_to_string(wildcard_conflicts.race_names, ', ')
          || '. Si vous acceptez la convocation, ce coureur sera retiré des compositions proposées. Si aucun autre coureur ne reste inscrit dans l’une d’elles, la demande de participation correspondante sera annulée.'
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
    select public.get_rider_selection_conflicting_wildcards(
      candidate.rider_id,
      edition.id
    ) as race_names
  ) as wildcard_conflicts on true
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

-- La boîte mail est rafraîchie si la composition d'une demande évolue ou si
-- l'organisateur arbitre la WildCard après l'envoi de la convocation.
drop trigger if exists refresh_selection_messages_after_race_roster_change
  on public.race_rosters;
create trigger refresh_selection_messages_after_race_roster_change
after insert or update or delete on public.race_rosters
for each row execute function
  public.refresh_pending_selection_messages_from_calendar_change();

create or replace function public.refresh_selection_messages_from_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_id uuid;
begin
  for v_rider_id in
    select distinct roster.rider_id
    from public.race_rosters as roster
    where roster.race_registration_id = new.id
      and roster.status in ('selected', 'confirmed')
  loop
    perform public.refresh_pending_international_selection_messages_for_rider(
      v_rider_id
    );
  end loop;

  return new;
end;
$$;

revoke all
on function public.refresh_selection_messages_from_registration()
from public, anon, authenticated;

grant execute
on function public.refresh_selection_messages_from_registration()
to service_role;

drop trigger if exists refresh_selection_messages_after_registration_change
  on public.race_registrations;
create trigger refresh_selection_messages_after_registration_change
after update of status, entry_method on public.race_registrations
for each row
when (
  old.status is distinct from new.status
  or old.entry_method is distinct from new.entry_method
)
execute function public.refresh_selection_messages_from_registration();

-- Met à niveau les convocations déjà envoyées sans changer leur date.
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
