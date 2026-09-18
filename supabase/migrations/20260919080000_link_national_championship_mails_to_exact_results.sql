-- Chaque courrier de résultat CN de la saison active mène au classement
-- officiel de son championnat (pays et discipline).
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
    case
      when season.status = 'active' then coalesce(
        '/jeu/resultats/' || race.slug || '/' || stage.stage_number::text,
        '/jeu/resultats/championnats-nationaux/' ||
          case race.competition_type
            when 'national_time_trial' then 'contre-la-montre'
            else 'route'
          end
      )
      else '/jeu/resultats'
    end,
    'Consulter le classement',
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
  join public.seasons as season on season.id = edition.season_id
  join public.races as race on race.id = edition.race_id
  left join lateral (
    select stage_number
    from public.stages
    where race_edition_id = edition.id
    order by stage_number
    limit 1
  ) as stage on true
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

-- Le contenu et l'état de lecture des messages déjà reçus restent inchangés.
-- Les courriers des saisons closes ne doivent pas ouvrir par erreur l'édition
-- homonyme de la saison active.
update public.sporting_director_messages as message
set
  action_href = coalesce(
    '/jeu/resultats/' || race.slug || '/' || stage.stage_number::text,
    '/jeu/resultats/championnats-nationaux/' ||
      case race.competition_type
        when 'national_time_trial' then 'contre-la-montre'
        else 'route'
      end
  ),
  action_label = 'Consulter le classement'
from public.national_championship_notifications as notification
join public.race_editions as edition
  on edition.id = notification.race_edition_id
join public.races as race on race.id = edition.race_id
left join lateral (
  select stage_number
  from public.stages
  where race_edition_id = edition.id
  order by stage_number
  limit 1
) as stage on true
where message.source_reference = 'national-championship:' || notification.id
  and message.message_type = 'national_championship_result'
  and notification.notification_type = 'results'
  and exists (
    select 1
    from public.seasons as season
    where season.id = edition.season_id
      and season.status = 'active'
  );
