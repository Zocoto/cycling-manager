begin;

-- ============================================================
-- ALERTES DE RECRUTEMENT DU DIRECTEUR SPORTIF
-- Les critères sont privés. Les correspondances sont publiées dans
-- la boîte mail unifiée dès l'insertion d'un profil quotidien.
-- ============================================================

create table public.recruitment_alerts (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  alert_type text not null,
  country_id uuid references public.countries(id) on delete set null,
  minimum_overall smallint,
  rating_key text,
  minimum_rating smallint,
  minimum_potential_steps smallint,
  staff_role text,
  minimum_staff_level smallint,
  staff_trainer_specialty text,
  created_at timestamptz not null default now(),

  constraint recruitment_alerts_type_allowed
    check (alert_type in ('rider', 'staff')),
  constraint recruitment_alerts_overall_range
    check (minimum_overall is null or minimum_overall between 0 and 100),
  constraint recruitment_alerts_rating_key_allowed
    check (
      rating_key is null
      or rating_key in (
        'mountain', 'hills', 'recovery', 'endurance', 'resistance',
        'breakaway', 'downhill', 'acceleration', 'sprint', 'flat',
        'cobbles', 'prologue', 'timeTrial'
      )
    ),
  constraint recruitment_alerts_rating_range
    check (minimum_rating is null or minimum_rating between 0 and 100),
  constraint recruitment_alerts_rating_complete
    check ((rating_key is null) = (minimum_rating is null)),
  constraint recruitment_alerts_single_rider_level_criterion
    check (minimum_overall is null or minimum_rating is null),
  constraint recruitment_alerts_potential_range
    check (
      minimum_potential_steps is null
      or minimum_potential_steps between 1 and 8
    ),
  constraint recruitment_alerts_staff_role_allowed
    check (
      staff_role is null
      or staff_role in (
        'trainer', 'scout', 'doctor', 'mechanic', 'nutritionist',
        'physiotherapist', 'race_preparer', 'architect',
        'community_manager', 'research_engineer'
      )
    ),
  constraint recruitment_alerts_staff_level_range
    check (
      minimum_staff_level is null
      or minimum_staff_level between 1 and 5
    ),
  constraint recruitment_alerts_staff_specialty_allowed
    check (
      staff_trainer_specialty is null
      or staff_trainer_specialty in (
        'mountain', 'hills', 'flat', 'sprint',
        'time_trial', 'cobbles', 'endurance'
      )
    ),
  constraint recruitment_alerts_staff_specialty_shape
    check (
      staff_trainer_specialty is null
      or staff_role = 'trainer'
    ),
  constraint recruitment_alerts_shape
    check (
      (
        alert_type = 'rider'
        and staff_role is null
        and minimum_staff_level is null
        and staff_trainer_specialty is null
        and (
          country_id is not null
          or minimum_overall is not null
          or minimum_rating is not null
          or minimum_potential_steps is not null
        )
      )
      or
      (
        alert_type = 'staff'
        and minimum_overall is null
        and rating_key is null
        and minimum_rating is null
        and minimum_potential_steps is null
        and (
          country_id is not null
          or staff_role is not null
          or minimum_staff_level is not null
          or staff_trainer_specialty is not null
        )
      )
    )
);

create index recruitment_alerts_director_created_idx
  on public.recruitment_alerts (sporting_director_id, created_at desc);

create index recruitment_alerts_rider_matching_idx
  on public.recruitment_alerts (country_id, minimum_overall)
  where alert_type = 'rider';

create index recruitment_alerts_staff_matching_idx
  on public.recruitment_alerts (country_id, staff_role, minimum_staff_level)
  where alert_type = 'staff';

alter table public.recruitment_alerts enable row level security;

create policy recruitment_alerts_select_own
on public.recruitment_alerts
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id = recruitment_alerts.sporting_director_id
      and director.auth_user_id = auth.uid()
  )
);

grant select on table public.recruitment_alerts to authenticated;
grant all privileges on table public.recruitment_alerts to service_role;

comment on table public.recruitment_alerts is
  'Critères privés utilisés pour prévenir un DS lors des créations quotidiennes de coureurs et de staff.';

-- ============================================================
-- COMMANDES AUTHENTIFIÉES
-- Les écritures directes restent interdites au client.
-- ============================================================

create or replace function public.create_current_director_recruitment_alert(
  p_alert_type text,
  p_country_id uuid default null,
  p_minimum_overall integer default null,
  p_rating_key text default null,
  p_minimum_rating integer default null,
  p_minimum_potential_steps integer default null,
  p_staff_role text default null,
  p_minimum_staff_level integer default null,
  p_staff_trainer_specialty text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_alert_id uuid;
  v_staff_role text := nullif(btrim(p_staff_role), '');
  v_staff_specialty text := nullif(btrim(p_staff_trainer_specialty), '');
begin
  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_director_id is null then
    raise exception 'Aucun directeur sportif actif n’est associé à ce compte.';
  end if;

  if (
    select count(*)
    from public.recruitment_alerts as alert
    where alert.sporting_director_id = v_director_id
  ) >= 12 then
    raise exception 'Vous pouvez enregistrer au maximum 12 alertes de recrutement.';
  end if;

  if p_country_id is not null and not exists (
    select 1
    from public.countries as country
    where country.id = p_country_id
      and country.is_active
  ) then
    raise exception 'La nationalité choisie est invalide.';
  end if;

  if p_alert_type not in ('rider', 'staff') then
    raise exception 'Le type d’alerte est invalide.';
  end if;

  if p_alert_type = 'rider' then
    if v_staff_role is not null
      or p_minimum_staff_level is not null
      or v_staff_specialty is not null then
      raise exception 'Les critères de staff ne peuvent pas être utilisés pour un coureur.';
    end if;

    if p_minimum_overall is not null and p_minimum_rating is not null then
      raise exception 'Choisissez le niveau général ou une statistique ciblée.';
    end if;

    if (p_rating_key is null) <> (p_minimum_rating is null) then
      raise exception 'La statistique ciblée et son seuil doivent être renseignés ensemble.';
    end if;

    if p_country_id is null
      and p_minimum_overall is null
      and p_minimum_rating is null
      and p_minimum_potential_steps is null then
      raise exception 'Ajoutez au moins un critère à l’alerte coureur.';
    end if;
  else
    if p_minimum_overall is not null
      or p_rating_key is not null
      or p_minimum_rating is not null
      or p_minimum_potential_steps is not null then
      raise exception 'Les critères de coureur ne peuvent pas être utilisés pour un staff.';
    end if;

    if v_staff_specialty is not null and v_staff_role is null then
      v_staff_role := 'trainer';
    end if;

    if v_staff_specialty is not null and v_staff_role <> 'trainer' then
      raise exception 'Une spécialité d’entraînement exige le métier entraîneur.';
    end if;

    if p_country_id is null
      and v_staff_role is null
      and p_minimum_staff_level is null
      and v_staff_specialty is null then
      raise exception 'Ajoutez au moins un critère à l’alerte staff.';
    end if;
  end if;

  insert into public.recruitment_alerts (
    sporting_director_id,
    alert_type,
    country_id,
    minimum_overall,
    rating_key,
    minimum_rating,
    minimum_potential_steps,
    staff_role,
    minimum_staff_level,
    staff_trainer_specialty
  ) values (
    v_director_id,
    p_alert_type,
    p_country_id,
    p_minimum_overall,
    nullif(btrim(p_rating_key), ''),
    p_minimum_rating,
    p_minimum_potential_steps,
    case when p_alert_type = 'staff' then v_staff_role else null end,
    case when p_alert_type = 'staff' then p_minimum_staff_level else null end,
    case when p_alert_type = 'staff' then v_staff_specialty else null end
  )
  returning id into v_alert_id;

  return v_alert_id;
end;
$$;

create or replace function public.delete_current_director_recruitment_alert(
  p_alert_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.recruitment_alerts as alert
  using public.sporting_directors as director
  where alert.id = p_alert_id
    and director.id = alert.sporting_director_id
    and director.auth_user_id = auth.uid();

  return found;
end;
$$;

revoke all
on function public.create_current_director_recruitment_alert(
  text, uuid, integer, text, integer, integer, text, integer, text
)
from public, anon;

revoke all
on function public.delete_current_director_recruitment_alert(uuid)
from public, anon;

grant execute
on function public.create_current_director_recruitment_alert(
  text, uuid, integer, text, integer, integer, text, integer, text
)
to authenticated, service_role;

grant execute
on function public.delete_current_director_recruitment_alert(uuid)
to authenticated, service_role;

-- ============================================================
-- CORRESPONDANCES COUREURS
-- Le préfixe zz force ce trigger à passer après l'attribution du potentiel.
-- ============================================================

create or replace function public.notify_recruitment_alerts_for_daily_rider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.listing_type <> 'daily' then
    return new;
  end if;

  with candidate as (
    select
      rider.id,
      rider.country_id,
      rider.first_name,
      rider.last_name,
      rider.potential_steps,
      country.name as country_name,
      rating.mountain,
      rating.hills,
      rating.recovery,
      rating.endurance,
      rating.resistance,
      rating.breakaway,
      rating.downhill,
      rating.acceleration,
      rating.sprint,
      rating.flat,
      rating.cobbles,
      rating.prologue,
      rating.time_trial,
      public.calculate_rider_overall(rider.id, new.season_id) as overall
    from public.riders as rider
    join public.countries as country on country.id = rider.country_id
    join public.rider_season_ratings as rating
      on rating.rider_id = rider.id
      and rating.season_id = new.season_id
    where rider.id = new.rider_id
  ),
  matching_directors as (
    select distinct on (alert.sporting_director_id)
      alert.sporting_director_id
    from public.recruitment_alerts as alert
    join public.sporting_directors as director
      on director.id = alert.sporting_director_id
      and director.status = 'active'
    cross join candidate
    where alert.alert_type = 'rider'
      and (alert.country_id is null or alert.country_id = candidate.country_id)
      and (
        alert.minimum_overall is null
        or candidate.overall >= alert.minimum_overall
      )
      and (
        alert.minimum_potential_steps is null
        or candidate.potential_steps >= alert.minimum_potential_steps
      )
      and (
        alert.minimum_rating is null
        or case alert.rating_key
          when 'mountain' then candidate.mountain
          when 'hills' then candidate.hills
          when 'recovery' then candidate.recovery
          when 'endurance' then candidate.endurance
          when 'resistance' then candidate.resistance
          when 'breakaway' then candidate.breakaway
          when 'downhill' then candidate.downhill
          when 'acceleration' then candidate.acceleration
          when 'sprint' then candidate.sprint
          when 'flat' then candidate.flat
          when 'cobbles' then candidate.cobbles
          when 'prologue' then candidate.prologue
          when 'timeTrial' then candidate.time_trial
          else null
        end >= alert.minimum_rating
      )
    order by alert.sporting_director_id, alert.created_at
  )
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
    match.sporting_director_id,
    new.season_id,
    (
      select team_season.id
      from public.team_manager_assignments as assignment
      join public.team_seasons as team_season
        on team_season.team_id = assignment.team_id
        and team_season.season_id = new.season_id
      where assignment.sporting_director_id = match.sporting_director_id
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
      limit 1
    ),
    'system',
    'Cellule recrutement',
    'Un coureur correspond à votre recherche',
    format(
      '%s %s (%s) rejoint les enchères quotidiennes.',
      candidate.first_name,
      candidate.last_name,
      candidate.country_name
    ),
    format(
      '%s %s vient d’être ajouté aux enchères quotidiennes.%s%sCe profil satisfait les critères cumulés d’au moins une de vos alertes (niveau, nationalité ou potentiel). Ouvrez le marché pour consulter son rapport de scouting et enchérir.',
      candidate.first_name,
      candidate.last_name,
      E'\n',
      E'\n'
    ),
    '/jeu/transferts?onglet=quotidiennes#enchere-' || new.id::text,
    'Voir le coureur aux enchères',
    'recruitment-alert:rider:' || new.id::text,
    true,
    now()
  from matching_directors as match
  cross join candidate
  on conflict (sporting_director_id, source_reference) do nothing;

  return new;
end;
$$;

create trigger zz_notify_recruitment_alerts_for_daily_rider
after insert on public.transfer_market_listings
for each row
execute function public.notify_recruitment_alerts_for_daily_rider();

-- ============================================================
-- CORRESPONDANCES STAFF
-- ============================================================

create or replace function public.notify_recruitment_alerts_for_daily_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with candidate as (
    select
      member.id,
      member.country_id,
      member.first_name,
      member.last_name,
      member.role,
      member.level,
      member.trainer_specialty,
      country.name as country_name
    from public.staff_members as member
    join public.countries as country on country.id = member.country_id
    where member.id = new.staff_member_id
  ),
  active_season as (
    select season.id
    from public.seasons as season
    where season.status = 'active'
    limit 1
  ),
  matching_directors as (
    select distinct on (alert.sporting_director_id)
      alert.sporting_director_id
    from public.recruitment_alerts as alert
    join public.sporting_directors as director
      on director.id = alert.sporting_director_id
      and director.status = 'active'
    cross join candidate
    where alert.alert_type = 'staff'
      and (alert.country_id is null or alert.country_id = candidate.country_id)
      and (alert.staff_role is null or alert.staff_role = candidate.role)
      and (
        alert.minimum_staff_level is null
        or candidate.level >= alert.minimum_staff_level
      )
      and (
        alert.staff_trainer_specialty is null
        or alert.staff_trainer_specialty = candidate.trainer_specialty
      )
    order by alert.sporting_director_id, alert.created_at
  )
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
    match.sporting_director_id,
    active_season.id,
    (
      select team_season.id
      from public.team_manager_assignments as assignment
      join public.team_seasons as team_season
        on team_season.team_id = assignment.team_id
        and team_season.season_id = active_season.id
      where assignment.sporting_director_id = match.sporting_director_id
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
      limit 1
    ),
    'system',
    'Cellule recrutement',
    'Un staff correspond à votre recherche',
    format(
      '%s %s (%s) est disponible sur le marché du staff.',
      candidate.first_name,
      candidate.last_name,
      candidate.country_name
    ),
    format(
      '%s %s vient d’être ajouté au marché quotidien du staff.%s%sCe profil de niveau %s satisfait les critères cumulés d’au moins une de vos alertes. Ouvrez sa fiche pour vérifier ses compétences et lui proposer un contrat.',
      candidate.first_name,
      candidate.last_name,
      E'\n',
      E'\n',
      candidate.level
    ),
    '/jeu/staff?onglet=marche#staff-' || new.id::text,
    'Voir le profil du staff',
    'recruitment-alert:staff:' || new.id::text,
    true,
    now()
  from matching_directors as match
  cross join candidate
  cross join active_season
  on conflict (sporting_director_id, source_reference) do nothing;

  return new;
end;
$$;

create trigger zz_notify_recruitment_alerts_for_daily_staff
after insert on public.staff_market_listings
for each row
execute function public.notify_recruitment_alerts_for_daily_staff();

revoke all
on function public.notify_recruitment_alerts_for_daily_rider()
from public, anon, authenticated;

revoke all
on function public.notify_recruitment_alerts_for_daily_staff()
from public, anon, authenticated;

comment on function public.notify_recruitment_alerts_for_daily_rider() is
  'Publie un unique courrier par coureur et par DS lorsqu’une alerte correspond.';

comment on function public.notify_recruitment_alerts_for_daily_staff() is
  'Publie un unique courrier par staff et par DS lorsqu’une alerte correspond.';

commit;
