begin;

alter table public.rider_form_camps
  add column if not exists interruption_requested_at timestamptz,
  add column if not exists interruption_effective_day_number smallint;

alter table public.stage_reconnaissances
  add column if not exists interruption_requested_at timestamptz,
  add column if not exists interruption_effective_day_number smallint;

alter table public.rider_form_camps
  drop constraint if exists rider_form_camps_interruption_consistent;
alter table public.rider_form_camps
  add constraint rider_form_camps_interruption_consistent check (
    (interruption_requested_at is null and interruption_effective_day_number is null)
    or (
      interruption_requested_at is not null
      and interruption_effective_day_number between 2 and 28
    )
  );

alter table public.stage_reconnaissances
  drop constraint if exists stage_reconnaissances_interruption_consistent;
alter table public.stage_reconnaissances
  add constraint stage_reconnaissances_interruption_consistent check (
    (interruption_requested_at is null and interruption_effective_day_number is null)
    or (
      interruption_requested_at is not null
      and interruption_effective_day_number between 2 and 28
    )
  );

-- Une reconnaissance express ou interrompue peut légitimement ne durer qu'un
-- jour. Cette contrainte couvre les deux cas sans élargir la durée maximale.
alter table public.stage_reconnaissances
  drop constraint if exists stage_reconnaissances_day_range;
alter table public.stage_reconnaissances
  add constraint stage_reconnaissances_day_range check (
    start_day_number between 1 and 28
    and end_day_number between start_day_number and least(28, start_day_number + 1)
  );

create or replace function public.request_current_team_form_camp_interruption(
  p_camp_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_camp record;
begin
  if p_camp_id is null then
    raise exception 'Le stage à interrompre est invalide.';
  end if;

  -- Synchronisation légère de la journée uniquement : aucun règlement global
  -- de santé ou de forme n'est exécuté dans cette action interactive.
  perform public.sync_active_season_day();

  select
    camp.id,
    camp.camp_type,
    camp.start_day_number,
    camp.end_day_number,
    camp.status,
    camp.interruption_effective_day_number,
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

  if v_camp.interruption_effective_day_number is not null then
    return v_camp.interruption_effective_day_number;
  end if;

  if v_camp.status not in ('planned', 'active')
    or v_camp.current_day_number not between v_camp.start_day_number and v_camp.end_day_number
  then
    raise exception 'Seul un stage de remise en forme en cours peut être interrompu.';
  end if;

  if v_camp.end_day_number <= v_camp.current_day_number
    or v_camp.current_day_number >= 28
  then
    raise exception 'Ce stage se termine déjà naturellement demain.';
  end if;

  update public.rider_form_camps as camp
  set
    end_day_number = v_camp.current_day_number,
    interruption_requested_at = now(),
    interruption_effective_day_number = v_camp.current_day_number + 1
  where camp.id = v_camp.id;

  return v_camp.current_day_number + 1;
end;
$$;

create or replace function public.request_current_team_reconnaissance_interruption(
  p_reconnaissance_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_reconnaissance record;
begin
  if p_reconnaissance_id is null then
    raise exception 'La reconnaissance à interrompre est invalide.';
  end if;

  perform public.sync_active_season_day();

  select
    reconnaissance.id,
    reconnaissance.start_day_number,
    reconnaissance.end_day_number,
    reconnaissance.status,
    reconnaissance.interruption_effective_day_number,
    coalesce(season.current_day_number, 1)::integer as current_day_number
  into v_reconnaissance
  from public.stage_reconnaissances as reconnaissance
  join public.team_seasons as team_season
    on team_season.id = reconnaissance.team_season_id
  join public.seasons as season
    on season.id = reconnaissance.season_id
   and season.status = 'active'
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  where reconnaissance.id = p_reconnaissance_id
    and director.auth_user_id = auth.uid()
  for update of reconnaissance;

  if v_reconnaissance.id is null then
    raise exception 'Cette reconnaissance est introuvable.';
  end if;

  if v_reconnaissance.interruption_effective_day_number is not null then
    return v_reconnaissance.interruption_effective_day_number;
  end if;

  if v_reconnaissance.status not in ('planned', 'active')
    or v_reconnaissance.current_day_number not between
      v_reconnaissance.start_day_number and v_reconnaissance.end_day_number
  then
    raise exception 'Seule une reconnaissance en cours peut être interrompue.';
  end if;

  if v_reconnaissance.end_day_number <= v_reconnaissance.current_day_number
    or v_reconnaissance.current_day_number >= 28
  then
    raise exception 'Cette reconnaissance se termine déjà naturellement demain.';
  end if;

  -- Le statut annulé retire immédiatement tout bonus de course. Les camps
  -- participants restent actifs jusqu'à la fin de la journée courante afin que
  -- les coureurs ne redeviennent disponibles qu'au lendemain.
  update public.stage_reconnaissances as reconnaissance
  set
    status = 'cancelled',
    end_day_number = v_reconnaissance.current_day_number,
    interruption_requested_at = now(),
    interruption_effective_day_number = v_reconnaissance.current_day_number + 1
  where reconnaissance.id = v_reconnaissance.id;

  update public.rider_form_camps as camp
  set
    end_day_number = v_reconnaissance.current_day_number,
    interruption_requested_at = now(),
    interruption_effective_day_number = v_reconnaissance.current_day_number + 1
  where camp.id in (
    select participant.form_camp_id
    from public.stage_reconnaissance_riders as participant
    where participant.reconnaissance_id = v_reconnaissance.id
  )
    and camp.status in ('planned', 'active');

  return v_reconnaissance.current_day_number + 1;
end;
$$;

-- Une interruption conserve les gains des journées déjà effectuées. Le camp
-- reste donc actif jusqu'au règlement de la journée courante, puis ce déclencheur
-- transforme sa clôture technique en annulation pour qu'il ne compte jamais
-- comme un stage intégralement achevé.
create or replace function public.mark_interrupted_form_camp_cancelled()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed'
    and new.interruption_requested_at is not null
  then
    new.status := 'cancelled';
  end if;
  return new;
end;
$$;

drop trigger if exists rider_form_camps_mark_interrupted_cancelled
  on public.rider_form_camps;
create trigger rider_form_camps_mark_interrupted_cancelled
before update of status on public.rider_form_camps
for each row
execute function public.mark_interrupted_form_camp_cancelled();

revoke all on function public.request_current_team_form_camp_interruption(uuid)
  from public, anon;
grant execute on function public.request_current_team_form_camp_interruption(uuid)
  to authenticated, service_role;

revoke all on function public.request_current_team_reconnaissance_interruption(uuid)
  from public, anon;
grant execute on function public.request_current_team_reconnaissance_interruption(uuid)
  to authenticated, service_role;

comment on function public.request_current_team_form_camp_interruption(uuid) is
  'Programme au lendemain l’arrêt ciblé d’un stage de forme, sans remboursement ni règlement global interactif.';
comment on function public.request_current_team_reconnaissance_interruption(uuid) is
  'Programme au lendemain l’arrêt ciblé d’une reconnaissance et supprime immédiatement son bonus, sans remboursement.';

commit;
