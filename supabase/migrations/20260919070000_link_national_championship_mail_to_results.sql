-- Les courriers de résultats CN doivent ouvrir les classements, pas l'ancienne
-- page d'inscription par discipline. Les courriers de sélection restent inchangés.
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
    'national_championship_result',
    'Fédération nationale',
    notification.title,
    left(notification.message, 220),
    notification.message,
    '/jeu/championnats-nationaux/resultats',
    'Consulter les résultats',
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
  where notification.id = p_notification_id
    and notification.notification_type = 'results'
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

-- Conserver l'état de lecture et le contenu des courriers déjà reçus.
update public.sporting_director_messages
set action_href = '/jeu/championnats-nationaux/resultats'
where message_type = 'national_championship_result'
  and action_href in (
    '/jeu/championnats-nationaux/route',
    '/jeu/championnats-nationaux/contre-la-montre'
  );
