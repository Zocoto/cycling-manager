begin;

create or replace function public.sync_director_scouting_report_message(
  p_mission_id uuid
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
    sent_at
  )
  select
    director.id,
    mission.season_id,
    team_season.id,
    'academy',
    'Cellule de recrutement',
    'Rapport de scouting disponible',
    case
      when candidate_summary.candidate_count = 1
        then '1 jeune détecté en ' || country.name || '.'
      else candidate_summary.candidate_count::text
        || ' jeunes détectés en ' || country.name || '.'
    end,
    format(
      'La mission menée par %s %s en %s est terminée. %s attend votre analyse dans le centre de formation.',
      scout.first_name,
      scout.last_name,
      country.name,
      case
        when candidate_summary.candidate_count = 1 then '1 jeune détecté'
        else candidate_summary.candidate_count::text || ' jeunes détectés'
      end
    ),
    '/jeu/centre-de-formation?onglet=scouting',
    'Ouvrir le rapport',
    'scouting-report:' || mission.id::text,
    true,
    coalesce(mission.report_ready_at, mission.updated_at, now())
  from public.youth_scouting_missions as mission
  join public.countries as country on country.id = mission.country_id
  join public.staff_contracts as scout_contract
    on scout_contract.id = mission.scout_contract_id
  join public.staff_members as scout
    on scout.id = scout_contract.staff_member_id
  join public.team_seasons as team_season
    on team_season.team_id = mission.team_id
   and team_season.season_id = mission.season_id
  join public.team_manager_assignments as assignment
    on assignment.team_id = mission.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  cross join lateral (
    select count(*)::integer as candidate_count
    from public.youth_scouting_candidates as candidate
    where candidate.mission_id = mission.id
  ) as candidate_summary
  where mission.id = p_mission_id
    and mission.status = 'completed'
    and mission.report_ready_at is not null
  on conflict (sporting_director_id, source_reference)
  do update set
    season_id = excluded.season_id,
    team_season_id = excluded.team_season_id,
    sender_name = excluded.sender_name,
    subject = excluded.subject,
    preview = excluded.preview,
    body = excluded.body,
    action_href = excluded.action_href,
    action_label = excluded.action_label,
    is_important = excluded.is_important;
end;
$$;

create or replace function public.sync_director_scouting_report_message_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
    and new.report_ready_at is not null
    and (
      tg_op = 'INSERT'
      or old.status is distinct from 'completed'
      or old.report_ready_at is distinct from new.report_ready_at
    )
  then
    perform public.sync_director_scouting_report_message(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists youth_scouting_missions_sync_director_mailbox
  on public.youth_scouting_missions;

create trigger youth_scouting_missions_sync_director_mailbox
after insert or update of status, report_ready_at
on public.youth_scouting_missions
for each row
execute function public.sync_director_scouting_report_message_trigger();

revoke all on function public.sync_director_scouting_report_message(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_director_scouting_report_message_trigger()
  from public, anon, authenticated;
grant execute on function public.sync_director_scouting_report_message(uuid)
  to service_role;

-- Do not flood the mailbox with old reports: only restore messages for reports
-- that are still awaiting their first consultation when this migration runs.
select public.sync_director_scouting_report_message(mission.id)
from public.youth_scouting_missions as mission
where mission.status = 'completed'
  and mission.report_ready_at is not null
  and mission.report_viewed_at is null;

notify pgrst, 'reload schema';

commit;
