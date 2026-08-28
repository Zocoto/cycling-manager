begin;

create or replace function public.cancel_current_team_planned_form_camp(
  p_camp_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_camp record;
begin
  if p_camp_id is null then
    raise exception 'Le stage à annuler est invalide.';
  end if;

  -- La journée active suffit pour distinguer un stage futur d’un stage déjà
  -- commencé. Aucun règlement global de santé ou de forme n’est déclenché.
  perform public.sync_active_season_day();

  select
    camp.id,
    camp.camp_type,
    camp.start_day_number,
    camp.status,
    coalesce(season.current_day_number, 1)::integer as current_day_number
  into v_camp
  from public.rider_form_camps as camp
  join public.team_seasons as team_season
    on team_season.id = camp.team_season_id
  join public.seasons as season
    on season.id = camp.season_id
   and season.status = 'active'
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  where camp.id = p_camp_id
    and director.auth_user_id = auth.uid()
  for update of camp;

  if v_camp.id is null or v_camp.camp_type not in ('classic', 'premium') then
    raise exception 'Ce stage de remise en forme est introuvable.';
  end if;

  if v_camp.status <> 'planned'
    or v_camp.current_day_number >= v_camp.start_day_number
  then
    raise exception 'Seul un stage programmé qui n’a pas commencé peut être annulé.';
  end if;

  update public.rider_form_camps as camp
  set
    status = 'cancelled',
    completed_at = now()
  where camp.id = v_camp.id;
end;
$$;

revoke all on function public.cancel_current_team_planned_form_camp(uuid)
  from public, anon;
grant execute on function public.cancel_current_team_planned_form_camp(uuid)
  to authenticated, service_role;

comment on function public.cancel_current_team_planned_form_camp(uuid) is
  'Annule immédiatement un stage de forme futur de l’équipe courante, sans remboursement ni règlement global interactif.';

commit;
