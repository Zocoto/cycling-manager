begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

alter table public.youth_scouting_candidates
  drop constraint youth_scouting_candidates_status_allowed,
  add constraint youth_scouting_candidates_status_allowed
    check (status in ('spotted', 'signed', 'expired', 'rejected'));

create function public.reject_current_team_youth_candidate(p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select candidate.status
  into v_status
  from public.youth_scouting_candidates as candidate
  join public.youth_scouting_missions as mission on mission.id = candidate.mission_id
  where candidate.id = p_candidate_id
    and mission.status = 'completed'
    and public.current_user_manages_team(mission.team_id)
  for update of candidate;

  if v_status is null or v_status = 'signed' then
    raise exception 'Ce profil ne peut plus être rejeté.';
  end if;

  if v_status in ('spotted', 'expired') then
    update public.youth_scouting_candidates
    set status = 'rejected'
    where id = p_candidate_id;
  end if;
end;
$$;

revoke all on function public.reject_current_team_youth_candidate(uuid) from public, anon;
grant execute on function public.reject_current_team_youth_candidate(uuid) to authenticated;

create function public.resolve_reviewed_youth_scouting_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A separate statement after this lock observes other decisions that committed while waiting.
  perform 1
  from public.youth_scouting_missions as mission
  where mission.id = new.mission_id
    and mission.status = 'completed'
    and mission.report_viewed_at is null
  for no key update;

  if found and not exists (
    select 1
    from public.youth_scouting_candidates as candidate
    where candidate.mission_id = new.mission_id
      and candidate.status not in ('signed', 'rejected')
  ) then
    update public.youth_scouting_missions
    set report_viewed_at = now(), updated_at = now()
    where id = new.mission_id;
  end if;

  return new;
end;
$$;

revoke all on function public.resolve_reviewed_youth_scouting_report() from public, anon, authenticated;

drop trigger youth_scouting_candidates_resolve_fully_recruited_report on public.youth_scouting_candidates;
create trigger youth_scouting_candidates_resolve_reviewed_report
after update of status on public.youth_scouting_candidates
for each row
when (old.status is distinct from new.status and new.status in ('signed', 'rejected'))
execute function public.resolve_reviewed_youth_scouting_report();

create or replace function public.mark_current_team_scouting_report_viewed(p_mission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.youth_scouting_missions as mission
  set report_viewed_at = coalesce(mission.report_viewed_at, now()), updated_at = now()
  where mission.id = p_mission_id
    and mission.status = 'completed'
    and public.current_user_manages_team(mission.team_id)
    and not exists (
      select 1
      from public.youth_scouting_candidates as candidate
      where candidate.mission_id = mission.id
        and candidate.status not in ('signed', 'rejected')
    );

  if not found then
    raise exception 'Chaque profil doit être signé ou rejeté pour terminer le rapport.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
