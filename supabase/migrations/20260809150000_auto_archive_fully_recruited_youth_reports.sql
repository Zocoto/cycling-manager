begin;

create or replace function public.resolve_fully_recruited_youth_scouting_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.youth_scouting_candidates as candidate
    where candidate.mission_id = new.mission_id
  ) and not exists (
    select 1
    from public.youth_scouting_candidates as candidate
    where candidate.mission_id = new.mission_id
      and candidate.status <> 'signed'
  ) then
    update public.youth_scouting_missions as mission
    set
      report_viewed_at = coalesce(mission.report_viewed_at, now()),
      updated_at = now()
    where mission.id = new.mission_id
      and mission.status = 'completed';
  end if;

  return new;
end;
$$;

revoke all on function public.resolve_fully_recruited_youth_scouting_report() from public;

drop trigger if exists youth_scouting_candidates_resolve_fully_recruited_report
  on public.youth_scouting_candidates;
create trigger youth_scouting_candidates_resolve_fully_recruited_report
after update of status on public.youth_scouting_candidates
for each row
when (old.status is distinct from new.status and new.status = 'signed')
execute function public.resolve_fully_recruited_youth_scouting_report();

update public.youth_scouting_missions as mission
set
  report_viewed_at = coalesce(mission.report_viewed_at, now()),
  updated_at = now()
where mission.status = 'completed'
  and exists (
    select 1
    from public.youth_scouting_candidates as candidate
    where candidate.mission_id = mission.id
  )
  and not exists (
    select 1
    from public.youth_scouting_candidates as candidate
    where candidate.mission_id = mission.id
      and candidate.status <> 'signed'
  );

commit;
