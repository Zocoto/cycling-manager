begin;

alter table public.race_registrations
  add column if not exists reputation_commitment_id uuid
    references public.reputation_commitments(id) on delete set null,
  add column if not exists wildcard_commitment_amount integer not null default 0,
  add column if not exists wildcard_support_bonus numeric(8, 2) not null default 0;

alter table public.race_registrations
  add constraint race_registrations_wildcard_commitment_allowed
    check (wildcard_commitment_amount in (0, 25, 50, 75)),
  add constraint race_registrations_wildcard_support_bonus_allowed
    check (wildcard_support_bonus in (0, 30, 65, 105));

drop function if exists public.save_current_team_competition_roster_with_roles(uuid, jsonb);
create function public.save_current_team_competition_roster_with_roles(
  p_race_edition_id uuid,
  p_roster jsonb,
  p_commitment_amount integer default 0
)
returns table (
  registration_id uuid,
  registration_status text,
  registered_rider_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_competition_type text;
  v_saved record;
  v_context record;
  v_commitment_id uuid;
  v_support_bonus numeric(8, 2) := case p_commitment_amount
    when 25 then 30 when 50 then 65 when 75 then 105 else 0 end;
begin
  if coalesce(p_commitment_amount, 0) not in (0, 25, 50, 75) then
    raise exception 'Niveau d’appui Wild Card invalide.';
  end if;

  select race.competition_type into v_competition_type
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  where edition.id = p_race_edition_id;
  if v_competition_type is null then
    raise exception using errcode = 'P0002', message = 'Cette édition de course est introuvable.';
  end if;
  if v_competition_type in ('national_road', 'national_time_trial') then
    raise exception using errcode = 'P0001', message = 'Les engagements aux championnats sont automatiques. Consultez le menu CN pour retirer un coureur.';
  end if;

  select saved.* into v_saved
  from public.save_current_team_race_roster_with_roles(
    p_race_edition_id, p_roster
  ) as saved;

  if p_commitment_amount > 0 then
    if v_saved.registration_status <> 'pending' then
      raise exception 'L’appui de réputation est réservé aux demandes de Wild Card.';
    end if;

    select director.id as sporting_director_id, director.reputation_points,
      assignment.team_id, edition.season_id, season.game_year
    into v_context
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager' and assignment.status = 'active'
    join public.race_editions as edition on edition.id = p_race_edition_id
    join public.seasons as season on season.id = edition.season_id
    where director.auth_user_id = auth.uid() and director.status = 'active'
    limit 1;

    if v_context.game_year < 4 then
      raise exception 'L’appui des candidatures Wild Card ouvre en saison 4.';
    end if;
    if v_context.reputation_points < 750 then
      raise exception 'L’appui Wild Card exige 750 points de réputation.';
    end if;

    v_commitment_id := private.create_reputation_commitment(
      v_context.sporting_director_id, v_context.season_id, v_context.team_id,
      'elite_wildcard', v_saved.registration_id, p_commitment_amount,
      jsonb_build_object('raceEditionId', p_race_edition_id)
    );

    update public.race_registrations
    set reputation_commitment_id = v_commitment_id,
        wildcard_commitment_amount = p_commitment_amount,
        wildcard_support_bonus = v_support_bonus
    where id = v_saved.registration_id;
  end if;

  return query select v_saved.registration_id, v_saved.registration_status,
    v_saved.registered_rider_count;
end;
$$;

revoke all on function public.save_current_team_competition_roster_with_roles(uuid, jsonb, integer)
from public, anon;
grant execute on function public.save_current_team_competition_roster_with_roles(uuid, jsonb, integer)
to authenticated;

-- Le moteur d'arbitrage reste celui déjà éprouvé. On enrichit uniquement son
-- candidat et son score avec le bonus explicite de la candidature.
do $$
declare
  v_definition text;
  v_augmented text;
begin
  v_definition := pg_get_functiondef(
    'public.settle_due_elite_wildcards()'::regprocedure
  );
  if position('wildcard_support_bonus' in v_definition) > 0 then return; end if;

  v_augmented := replace(
    v_definition,
    'coalesce(director.reputation_points, 0)::integer
            as reputation_points,',
    'coalesce(director.reputation_points, 0)::integer
            as reputation_points,
          coalesce(registration.wildcard_support_bonus, 0)::numeric(8, 2)
            as wildcard_support_bonus,'
  );
  v_augmented := replace(
    v_augmented,
    '+ least(greatest(candidate.reputation_points, 0), 1000) * 0.25
          + candidate.best_rider_profile_fit * 5',
    '+ least(greatest(candidate.reputation_points, 0), 1000) * 0.25
          + candidate.wildcard_support_bonus
          + candidate.best_rider_profile_fit * 5'
  );

  if v_augmented = v_definition
    or position('+ candidate.wildcard_support_bonus' in v_augmented) = 0 then
    raise exception 'Impossible d’intégrer l’appui de réputation au moteur Wild Card.';
  end if;
  execute v_augmented;
end;
$$;

create or replace function private.settle_wildcard_reputation_after_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_commitment_id uuid;
begin
  select reputation_commitment_id into v_commitment_id
  from public.race_registrations
  where id = new.race_registration_id;
  if v_commitment_id is not null then
    perform private.settle_reputation_commitment(
      v_commitment_id,
      case when new.decision = 'accepted' then 'accepted' else 'rejected' end,
      case when new.decision = 'accepted' then 0 else 0.40 end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists settle_wildcard_reputation_after_decision
  on public.elite_wildcard_decisions;
create trigger settle_wildcard_reputation_after_decision
after insert on public.elite_wildcard_decisions
for each row execute function private.settle_wildcard_reputation_after_decision();

create or replace function public.withdraw_current_team_elite_wildcard_request(
  p_race_edition_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registration_id uuid;
  v_commitment_id uuid;
  v_wildcard_closes_at timestamptz;
begin
  select registration.id, registration.reputation_commitment_id,
    edition.wildcard_closes_at
  into v_registration_id, v_commitment_id, v_wildcard_closes_at
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.team_seasons as team_season on team_season.team_id = assignment.team_id
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.race_edition_id = p_race_edition_id
   and registration.status = 'pending'
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
   and edition.season_id = team_season.season_id
  where director.auth_user_id = auth.uid()
  for update of registration;

  if v_registration_id is null then
    raise exception using errcode = 'P0001', message = 'Aucune demande de Wild Card en attente ne peut être retirée.';
  end if;
  if v_wildcard_closes_at is null or now() >= v_wildcard_closes_at then
    raise exception using errcode = 'P0001', message = 'La demande est déjà en cours d’arbitrage et ne peut plus être retirée.';
  end if;

  update public.race_rosters set status = 'withdrawn'
  where race_registration_id = v_registration_id
    and status in ('selected', 'confirmed');
  update public.race_registrations
  set status = 'withdrawn', decided_at = now()
  where id = v_registration_id;

  if v_commitment_id is not null then
    perform private.settle_reputation_commitment(v_commitment_id, 'withdrawn', 0.25);
  end if;
end;
$$;
revoke all on function public.withdraw_current_team_elite_wildcard_request(uuid)
from public, anon;
grant execute on function public.withdraw_current_team_elite_wildcard_request(uuid)
to authenticated;

create or replace function private.release_wildcard_reputation_after_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registration record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for v_registration in
      select reputation_commitment_id from public.race_registrations
      where race_edition_id = new.id and reputation_commitment_id is not null
    loop
      perform private.settle_reputation_commitment(
        v_registration.reputation_commitment_id, 'cancelled', 0
      );
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists release_wildcard_reputation_after_cancellation
  on public.race_editions;
create trigger release_wildcard_reputation_after_cancellation
after update of status on public.race_editions
for each row execute function private.release_wildcard_reputation_after_cancellation();

commit;
