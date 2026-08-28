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
  v_refund_transaction_id uuid;
begin
  if p_camp_id is null then
    raise exception 'Le stage à annuler est invalide.';
  end if;

  -- La journée active suffit pour distinguer un stage futur d’un stage déjà
  -- commencé. Aucun règlement global de santé ou de forme n’est déclenché.
  perform public.sync_active_season_day();

  select
    camp.id,
    camp.team_season_id,
    camp.camp_type,
    camp.start_day_number,
    camp.end_day_number,
    camp.total_price,
    camp.status,
    current_day.id as season_day_id,
    coalesce(season.current_day_number, 1)::integer as current_day_number
  into v_camp
  from public.rider_form_camps as camp
  join public.team_seasons as team_season
    on team_season.id = camp.team_season_id
  join public.seasons as season
    on season.id = camp.season_id
   and season.status = 'active'
  join public.season_days as current_day
    on current_day.season_id = season.id
   and current_day.day_number = coalesce(season.current_day_number, 1)
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
    v_camp.season_day_id,
    v_camp.current_day_number,
    v_camp.total_price,
    'training',
    'posted',
    case
      when v_camp.camp_type = 'premium'
        then 'Remboursement · stage de forme premium'
      else 'Remboursement · stage de forme classique'
    end
      || ' · J' || v_camp.start_day_number::text
      || case
          when v_camp.end_day_number > v_camp.start_day_number
            then '–J' || v_camp.end_day_number::text
          else ''
        end,
    'form-camp-refund:' || v_camp.id::text,
    now()
  )
  on conflict (team_season_id, source_reference) do nothing
  returning id into v_refund_transaction_id;

  if v_refund_transaction_id is null then
    raise exception 'Ce stage a déjà été remboursé.';
  end if;

  update public.team_seasons as team_season
  set cash_balance = team_season.cash_balance + v_camp.total_price
  where team_season.id = v_camp.team_season_id;

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
  'Annule et rembourse intégralement un stage de forme futur de l’équipe courante, sans règlement global interactif.';

commit;
