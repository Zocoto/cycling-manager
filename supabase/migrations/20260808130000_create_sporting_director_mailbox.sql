begin;

-- ============================================================
-- BOITE MAIL DU DIRECTEUR SPORTIF
-- Les producteurs métier conservent leurs tables spécialisées ;
-- cette table constitue l'archive unifiée, privée et durable du DS.
-- ============================================================

create table public.sporting_director_messages (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  team_season_id uuid references public.team_seasons(id) on delete set null,
  message_type text not null,
  sender_name text not null,
  subject text not null,
  preview text not null,
  body text not null,
  action_href text,
  action_label text,
  source_reference text not null,
  is_important boolean not null default false,
  sent_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz,
  constraint sporting_director_messages_type_allowed check (
    message_type in (
      'race_result',
      'national_championship_selection',
      'national_championship_result',
      'international_selection',
      'roster_alert',
      'wildcard',
      'academy',
      'infrastructure',
      'system'
    )
  ),
  constraint sporting_director_messages_text_present check (
    btrim(sender_name) <> ''
    and btrim(subject) <> ''
    and btrim(preview) <> ''
    and btrim(body) <> ''
    and btrim(source_reference) <> ''
  ),
  constraint sporting_director_messages_action_complete check (
    (action_href is null and action_label is null)
    or (
      action_href like '/jeu/%'
      and nullif(btrim(action_label), '') is not null
    )
  ),
  constraint sporting_director_messages_source_unique
    unique (sporting_director_id, source_reference)
);

create index sporting_director_messages_inbox_idx
  on public.sporting_director_messages (
    sporting_director_id,
    archived_at,
    sent_at desc
  );

create index sporting_director_messages_unread_idx
  on public.sporting_director_messages (
    sporting_director_id,
    sent_at desc
  )
  where read_at is null and archived_at is null;

alter table public.sporting_director_messages enable row level security;

create policy sporting_director_messages_select_own
on public.sporting_director_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id = sporting_director_messages.sporting_director_id
      and director.auth_user_id = auth.uid()
  )
);

grant select on table public.sporting_director_messages to authenticated;
grant all privileges on table public.sporting_director_messages to service_role;

comment on table public.sporting_director_messages is
  'Archive unifiée des annonces et courriers privés reçus par chaque directeur sportif.';

-- ============================================================
-- COMMANDES DE BOITE MAIL
-- Aucun UPDATE direct n'est accordé au client : chaque RPC vérifie auth.uid().
-- ============================================================

create or replace function public.get_current_director_unread_message_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.sporting_director_messages as message
  join public.sporting_directors as director
    on director.id = message.sporting_director_id
  where director.auth_user_id = auth.uid()
    and message.read_at is null
    and message.archived_at is null;
$$;

create or replace function public.mark_current_director_message_read(
  p_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sporting_director_messages as message
  set read_at = coalesce(message.read_at, now())
  from public.sporting_directors as director
  where message.id = p_message_id
    and director.id = message.sporting_director_id
    and director.auth_user_id = auth.uid();

  return found;
end;
$$;

create or replace function public.mark_current_director_message_unread(
  p_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sporting_director_messages as message
  set read_at = null
  from public.sporting_directors as director
  where message.id = p_message_id
    and director.id = message.sporting_director_id
    and director.auth_user_id = auth.uid();

  return found;
end;
$$;

create or replace function public.mark_all_current_director_messages_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.sporting_director_messages as message
  set read_at = now()
  from public.sporting_directors as director
  where director.id = message.sporting_director_id
    and director.auth_user_id = auth.uid()
    and message.read_at is null
    and message.archived_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.set_current_director_message_archived(
  p_message_id uuid,
  p_archived boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sporting_director_messages as message
  set archived_at = case when p_archived then now() else null end
  from public.sporting_directors as director
  where message.id = p_message_id
    and director.id = message.sporting_director_id
    and director.auth_user_id = auth.uid();

  return found;
end;
$$;

revoke all on function public.get_current_director_unread_message_count()
  from public, anon;
revoke all on function public.mark_current_director_message_read(uuid)
  from public, anon;
revoke all on function public.mark_current_director_message_unread(uuid)
  from public, anon;
revoke all on function public.mark_all_current_director_messages_read()
  from public, anon;
revoke all on function public.set_current_director_message_archived(uuid, boolean)
  from public, anon;

grant execute on function public.get_current_director_unread_message_count()
  to authenticated, service_role;
grant execute on function public.mark_current_director_message_read(uuid)
  to authenticated, service_role;
grant execute on function public.mark_current_director_message_unread(uuid)
  to authenticated, service_role;
grant execute on function public.mark_all_current_director_messages_read()
  to authenticated, service_role;
grant execute on function public.set_current_director_message_archived(uuid, boolean)
  to authenticated, service_role;

-- ============================================================
-- RESULTATS DE COURSE
-- Elite/Mondial et championnats internationaux : toutes les équipes.
-- Continental/National standard : uniquement si l'équipe signe un podium.
-- ============================================================

create or replace function public.publish_director_race_result_messages(
  p_race_edition_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  with edition_context as (
    select
      edition.id,
      edition.season_id,
      edition.display_name,
      edition.status,
      category.code as category_code,
      race.slug,
      race.race_format,
      race.competition_type,
      coalesce(max(stage.stage_number), 1)::integer as final_stage_number
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.race_categories as category
      on category.id = edition.race_category_id
    left join public.stages as stage
      on stage.race_edition_id = edition.id
    where edition.id = p_race_edition_id
      and edition.status = 'completed'
      and race.competition_type not in (
        'national_road',
        'national_time_trial'
      )
      and race.slug is not null
    group by
      edition.id,
      category.code,
      race.slug,
      race.race_format,
      race.competition_type
  ),
  winner as (
    select
      result.race_edition_id,
      concat_ws(' ', rider.first_name, rider.last_name) as rider_name
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.riders as rider on rider.id = roster.rider_id
    where result.race_edition_id = p_race_edition_id
      and result.status = 'classified'
      and result.final_rank = 1
  ),
  team_results as (
    select
      registration.team_season_id,
      min(result.final_rank) filter (
        where result.status = 'classified'
      )::integer as best_rank,
      string_agg(
        case
          when result.status = 'classified' then
            format(
              '%s. %s %s',
              result.final_rank,
              rider.first_name,
              rider.last_name
            )
          else
            format(
              '%s %s — %s',
              rider.first_name,
              rider.last_name,
              replace(result.status, '_', ' ')
            )
        end,
        E'\n'
        order by result.final_rank nulls last, rider.last_name, rider.first_name
      ) as result_summary
    from public.race_results as result
    join public.race_rosters as roster
      on roster.id = result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.riders as rider on rider.id = roster.rider_id
    where result.race_edition_id = p_race_edition_id
      and registration.team_season_id is not null
    group by registration.team_season_id
  )
  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
    team_season_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    source_reference,
    is_important,
    sent_at
  )
  select
    director.id,
    context.season_id,
    team_result.team_season_id,
    'race_result',
    case
      when context.competition_type in (
        'world_championship',
        'continental_championship'
      ) then 'Fédération internationale'
      else 'Direction des courses'
    end,
    case
      when team_result.best_rank = 1 then
        'Victoire — ' || context.display_name
      when team_result.best_rank <= 3 then
        'Podium — ' || context.display_name
      else
        'Résultats majeurs — ' || context.display_name
    end,
    case
      when team_result.best_rank = 1 then
        'Votre équipe remporte ' || context.display_name || '.'
      when team_result.best_rank <= 3 then
        format(
          'Votre meilleur coureur termine %se de %s.',
          team_result.best_rank,
          context.display_name
        )
      else
        'Le classement final de ' || context.display_name || ' est homologué.'
    end,
    format(
      'Le classement final de %s est homologué.%s%sVainqueur : %s.%s%sRésultats de votre équipe :%s%s',
      context.display_name,
      E'\n',
      E'\n',
      coalesce(winner.rider_name, 'non communiqué'),
      E'\n',
      E'\n',
      E'\n',
      team_result.result_summary
    ),
    case
      when context.race_format = 'stage_race' then
        '/jeu/resultats/' || context.slug
      else
        format(
          '/jeu/resultats/%s/%s',
          context.slug,
          context.final_stage_number
        )
    end,
    'Consulter les résultats',
    format(
      'race-result:%s:%s',
      context.id,
      team_result.team_season_id
    ),
    context.category_code in ('elite', 'world')
      or context.competition_type in (
        'world_championship',
        'continental_championship'
      )
      or team_result.best_rank <= 3,
    now()
  from edition_context as context
  join team_results as team_result on true
  join public.team_seasons as team_season
    on team_season.id = team_result.team_season_id
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
    and director.status = 'active'
  left join winner on winner.race_edition_id = context.id
  where context.category_code in ('elite', 'world')
    or context.competition_type in (
      'world_championship',
      'continental_championship'
    )
    or team_result.best_rank <= 3
  on conflict (sporting_director_id, source_reference)
  do update set
    subject = excluded.subject,
    preview = excluded.preview,
    body = excluded.body,
    action_href = excluded.action_href,
    action_label = excluded.action_label,
    is_important = excluded.is_important;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.publish_director_race_result_messages_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.publish_director_race_result_messages(new.id);
  end if;
  return new;
end;
$$;

create trigger race_editions_publish_director_result_messages
after update of status on public.race_editions
for each row
execute function public.publish_director_race_result_messages_trigger();

revoke all on function public.publish_director_race_result_messages(uuid)
  from public, anon, authenticated;
revoke all on function public.publish_director_race_result_messages_trigger()
  from public, anon, authenticated;
grant execute on function public.publish_director_race_result_messages(uuid)
  to service_role;

-- ============================================================
-- MIROIR DES NOTIFICATIONS METIER EXISTANTES
-- Chaque synchroniseur est idempotent et conserve l'état lu de la source.
-- ============================================================

create or replace function public.sync_director_national_championship_message(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
    team_season_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    source_reference,
    is_important,
    sent_at,
    read_at
  )
  select
    director.id,
    edition.season_id,
    notification.team_season_id,
    case notification.notification_type
      when 'selection' then 'national_championship_selection'
      else 'national_championship_result'
    end,
    'Fédération nationale',
    notification.title,
    left(notification.message, 220),
    notification.message,
    case race.competition_type
      when 'national_time_trial'
        then '/jeu/championnats-nationaux/contre-la-montre'
      else '/jeu/championnats-nationaux/route'
    end,
    case notification.notification_type
      when 'selection' then 'Gérer les retraits'
      else 'Consulter les résultats'
    end,
    'national-championship:' || notification.id,
    true,
    notification.created_at,
    notification.read_at
  from public.national_championship_notifications as notification
  join public.team_seasons as team_season
    on team_season.id = notification.team_season_id
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
    and director.status = 'active'
  join public.race_editions as edition
    on edition.id = notification.race_edition_id
  join public.races as race on race.id = edition.race_id
  where notification.id = p_notification_id
  on conflict (sporting_director_id, source_reference)
  do update set
    subject = excluded.subject,
    preview = excluded.preview,
    body = excluded.body,
    action_href = excluded.action_href,
    action_label = excluded.action_label,
    read_at = excluded.read_at;
end;
$$;

create or replace function public.sync_director_roster_alert_message(
  p_notification_id uuid
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
    source_reference, is_important, sent_at, read_at
  )
  select
    director.id,
    edition.season_id,
    notification.team_season_id,
    'roster_alert',
    'Service médical',
    notification.title,
    left(notification.message, 220),
    notification.message,
    coalesce('/jeu/courses/' || race.slug, '/jeu/calendrier'),
    'Vérifier la sélection',
    'roster-alert:' || notification.id,
    notification.requires_action,
    notification.created_at,
    notification.read_at
  from public.race_roster_notifications as notification
  join public.team_seasons as team_season
    on team_season.id = notification.team_season_id
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
    and director.status = 'active'
  join public.race_registrations as registration
    on registration.id = notification.race_registration_id
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race on race.id = edition.race_id
  where notification.id = p_notification_id
  on conflict (sporting_director_id, source_reference)
  do update set
    subject = excluded.subject,
    preview = excluded.preview,
    body = excluded.body,
    is_important = excluded.is_important,
    read_at = excluded.read_at;
end;
$$;

create or replace function public.sync_director_wildcard_message(
  p_decision_id uuid
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
    director.id,
    edition.season_id,
    decision.team_season_id,
    'wildcard',
    'Comité organisateur',
    decision.title,
    left(decision.message, 220),
    decision.message,
    coalesce('/jeu/courses/' || race.slug, '/jeu/calendrier'),
    'Voir la course',
    'wildcard:' || decision.id,
    decision.decision = 'accepted',
    decision.decided_at
  from public.elite_wildcard_decisions as decision
  join public.team_seasons as team_season
    on team_season.id = decision.team_season_id
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
    and director.status = 'active'
  join public.race_editions as edition
    on edition.id = decision.race_edition_id
  join public.races as race on race.id = edition.race_id
  where decision.id = p_decision_id
  on conflict (sporting_director_id, source_reference)
  do update set
    subject = excluded.subject,
    preview = excluded.preview,
    body = excluded.body,
    is_important = excluded.is_important;
end;
$$;

create or replace function public.sync_director_academy_message(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sporting_director_messages (
    sporting_director_id, message_type, sender_name, subject, preview, body,
    action_href, action_label, source_reference, is_important, sent_at, read_at
  )
  select
    director.id,
    'academy',
    'Centre de formation',
    notification.title,
    left(notification.message, 220),
    notification.message,
    '/jeu/centre-de-formation',
    'Ouvrir le centre',
    'academy:' || notification.id,
    notification.notification_type in ('promotion_scheduled', 'contract_expired'),
    notification.created_at,
    notification.read_at
  from public.youth_development_notifications as notification
  join public.team_manager_assignments as assignment
    on assignment.team_id = notification.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
    and director.status = 'active'
  where notification.id = p_notification_id
  on conflict (sporting_director_id, source_reference)
  do update set
    subject = excluded.subject,
    preview = excluded.preview,
    body = excluded.body,
    is_important = excluded.is_important,
    read_at = excluded.read_at;
end;
$$;

create or replace function public.sync_director_infrastructure_message(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sporting_director_messages (
    sporting_director_id, message_type, sender_name, subject, preview, body,
    action_href, action_label, source_reference, is_important, sent_at, read_at
  )
  select
    director.id,
    'infrastructure',
    'Direction technique',
    notification.title,
    left(notification.message, 220),
    notification.message,
    '/jeu/infrastructures',
    'Voir les infrastructures',
    'infrastructure:' || notification.id,
    false,
    notification.created_at,
    notification.read_at
  from public.infrastructure_notifications as notification
  join public.team_manager_assignments as assignment
    on assignment.team_id = notification.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
    and director.status = 'active'
  where notification.id = p_notification_id
  on conflict (sporting_director_id, source_reference)
  do update set
    subject = excluded.subject,
    preview = excluded.preview,
    body = excluded.body,
    read_at = excluded.read_at;
end;
$$;

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
    ),
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
  join public.countries as country on country.id = nation_selection.country_id
  join public.riders as rider on rider.id = candidate.rider_id
  left join public.team_seasons as team_season
    on team_season.team_id = candidate.team_id
    and team_season.season_id = edition.season_id
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

create or replace function public.sync_director_message_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  case tg_table_name
    when 'national_championship_notifications' then
      perform public.sync_director_national_championship_message(new.id);
    when 'race_roster_notifications' then
      perform public.sync_director_roster_alert_message(new.id);
    when 'elite_wildcard_decisions' then
      perform public.sync_director_wildcard_message(new.id);
    when 'youth_development_notifications' then
      perform public.sync_director_academy_message(new.id);
    when 'infrastructure_notifications' then
      perform public.sync_director_infrastructure_message(new.id);
    when 'international_championship_rider_selections' then
      perform public.sync_director_international_selection_message(new.id);
  end case;
  return new;
end;
$$;

create trigger national_championship_notifications_sync_director_mailbox
after insert or update on public.national_championship_notifications
for each row execute function public.sync_director_message_trigger();

create trigger race_roster_notifications_sync_director_mailbox
after insert or update on public.race_roster_notifications
for each row execute function public.sync_director_message_trigger();

create trigger elite_wildcard_decisions_sync_director_mailbox
after insert or update on public.elite_wildcard_decisions
for each row execute function public.sync_director_message_trigger();

create trigger youth_development_notifications_sync_director_mailbox
after insert or update on public.youth_development_notifications
for each row execute function public.sync_director_message_trigger();

create trigger infrastructure_notifications_sync_director_mailbox
after insert or update on public.infrastructure_notifications
for each row execute function public.sync_director_message_trigger();

create trigger international_selection_sync_director_mailbox
after insert or update on public.international_championship_rider_selections
for each row execute function public.sync_director_message_trigger();

revoke all on function public.sync_director_national_championship_message(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_director_roster_alert_message(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_director_wildcard_message(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_director_academy_message(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_director_infrastructure_message(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_director_international_selection_message(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_director_message_trigger()
  from public, anon, authenticated;

-- Reprise des annonces déjà présentes au déploiement.
select public.sync_director_national_championship_message(id)
from public.national_championship_notifications;

select public.sync_director_roster_alert_message(id)
from public.race_roster_notifications;

select public.sync_director_wildcard_message(id)
from public.elite_wildcard_decisions;

select public.sync_director_academy_message(id)
from public.youth_development_notifications;

select public.sync_director_infrastructure_message(id)
from public.infrastructure_notifications;

select public.sync_director_international_selection_message(id)
from public.international_championship_rider_selections
where is_selected = true;

select public.publish_director_race_result_messages(id)
from public.race_editions
where status = 'completed';

commit;
