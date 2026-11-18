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
    and public.current_user_manages_team(mission.team_id);

  if not found then
    raise exception 'Ce rapport est introuvable ou ne vous appartient pas.';
  end if;
end;
$$;
