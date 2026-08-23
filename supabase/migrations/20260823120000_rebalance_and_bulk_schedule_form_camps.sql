begin;

-- Les anciens stages terminés conservent leur valeur d'historique. Les stages
-- encore actifs ou planifiés basculent immédiatement vers le nouveau barème et
-- profitent du niveau cumulé des médecins actuellement sous contrat.
alter table public.rider_form_camps
  drop constraint if exists rider_form_camps_gain_allowed;

update public.rider_form_camps as camp
set form_gain_per_day = round(
  (case when camp.camp_type = 'premium' then 20 else 10 end)
  * (
      1
      + least(
          50,
          public.get_active_team_staff_level(team_season.team_id, 'doctor') * 5
        ) / 100.0
    )
)::integer
from public.team_seasons as team_season
where team_season.id = camp.team_season_id
  and camp.camp_type in ('classic', 'premium')
  and camp.status in ('planned', 'active');

alter table public.rider_form_camps
  add constraint rider_form_camps_gain_allowed
  check (
    (
      camp_type = 'classic'
      and (
        form_gain_per_day between 10 and 15
        or (status in ('completed', 'cancelled') and form_gain_per_day = 5)
      )
    )
    or (
      camp_type = 'premium'
      and (
        form_gain_per_day between 20 and 30
        or (status in ('completed', 'cancelled') and form_gain_per_day = 10)
      )
    )
    or (
      camp_type in (
        'reconnaissance',
        'indoor_preparation',
        'wind_tunnel_preparation'
      )
      and form_gain_per_day = 0
    )
  );

create or replace function public.book_current_team_form_camps(
  p_rider_ids uuid[],
  p_camp_type text,
  p_start_day_number integer,
  p_end_day_number integer
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_rider_ids uuid[];
  v_camp_ids uuid[];
  v_duration_days integer;
  v_gain integer;
  v_doctor_boost_pct integer;
  v_daily_price numeric(12, 2);
  v_total_price numeric(12, 2);
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_team_rider_count integer;
  v_conflict_name text;
  v_booking_id uuid := gen_random_uuid();
begin
  perform public.settle_current_health_and_form();

  if p_camp_type not in ('classic', 'premium') then
    raise exception 'Le type de stage demandé est invalide.';
  end if;

  if p_start_day_number is null
    or p_end_day_number is null
    or p_start_day_number not between 1 and 28
    or p_end_day_number not between p_start_day_number and 28 then
    raise exception 'La plage de stage demandée est invalide.';
  end if;

  v_duration_days := p_end_day_number - p_start_day_number + 1;
  if v_duration_days not between 1 and 3 then
    raise exception 'Un stage doit durer entre un et trois jours.';
  end if;

  if cardinality(coalesce(p_rider_ids, array[]::uuid[])) not between 1 and 50 then
    raise exception 'Sélectionnez entre un et cinquante coureurs.';
  end if;

  select array_agg(requested.rider_id order by requested.rider_id)
  into v_rider_ids
  from (
    select distinct selected.rider_id
    from unnest(coalesce(p_rider_ids, array[]::uuid[])) as selected(rider_id)
    where selected.rider_id is not null
  ) as requested;

  if cardinality(coalesce(v_rider_ids, array[]::uuid[]))
    <> cardinality(coalesce(p_rider_ids, array[]::uuid[])) then
    raise exception 'La sélection de coureurs contient une valeur invalide ou dupliquée.';
  end if;

  select
    team_season.id as team_season_id,
    team_season.team_id,
    team_season.cash_balance,
    team_season.season_id,
    season.current_day_number,
    current_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.season_days as current_day
    on current_day.season_id = season.id
   and current_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
  for update of team_season;

  if v_context is null then
    raise exception 'Aucune équipe active ne permet de programmer ce stage.';
  end if;

  if p_start_day_number <= coalesce(v_context.current_day_number, 1) then
    raise exception 'Un stage doit commencer après la journée en cours.';
  end if;

  select count(distinct contract.rider_id)::integer
  into v_team_rider_count
  from public.rider_contracts as contract
  join public.seasons as active_season
    on active_season.id = v_context.season_id
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
   and start_season.game_year <= active_season.game_year
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
   and end_season.game_year >= active_season.game_year
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
    and contract.rider_id = any(v_rider_ids);

  if v_team_rider_count <> cardinality(v_rider_ids) then
    raise exception 'Au moins un coureur ne fait pas partie de votre effectif actif.';
  end if;

  select
    (start_day.calendar_date::timestamp at time zone 'Europe/Paris'),
    ((end_day.calendar_date::timestamp + interval '1 day') at time zone 'Europe/Paris')
  into v_start_at, v_end_at
  from public.season_days as start_day
  join public.season_days as end_day
    on end_day.season_id = start_day.season_id
  where start_day.season_id = v_context.season_id
    and start_day.day_number = p_start_day_number
    and end_day.day_number = p_end_day_number;

  if v_start_at is null or v_end_at is null then
    raise exception 'La plage choisie n’existe pas dans la saison active.';
  end if;

  select rider.first_name || ' ' || rider.last_name
  into v_conflict_name
  from public.riders as rider
  where rider.id = any(v_rider_ids)
    and exists (
      select 1
      from public.rider_injuries as injury
      where injury.rider_id = rider.id
        and injury.status = 'active'
        and injury.started_at < v_end_at
        and injury.expected_recovery_at > v_start_at
    )
  order by rider.last_name, rider.first_name
  limit 1;

  if v_conflict_name is not null then
    raise exception '% sera encore en convalescence pendant cette plage.', v_conflict_name;
  end if;

  select rider.first_name || ' ' || rider.last_name
  into v_conflict_name
  from public.riders as rider
  where rider.id = any(v_rider_ids)
    and exists (
      select 1
      from public.rider_form_camps as camp
      where camp.rider_id = rider.id
        and camp.season_id = v_context.season_id
        and camp.status <> 'cancelled'
        and camp.start_day_number <= p_end_day_number
        and camp.end_day_number >= p_start_day_number
    )
  order by rider.last_name, rider.first_name
  limit 1;

  if v_conflict_name is not null then
    raise exception '% possède déjà une indisponibilité programmée sur cette plage.', v_conflict_name;
  end if;

  select rider.first_name || ' ' || rider.last_name
  into v_conflict_name
  from public.riders as rider
  where rider.id = any(v_rider_ids)
    and exists (
      select 1
      from public.race_rosters as roster
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
       and registration.status in ('pending', 'accepted')
      join public.stages as stage
        on stage.race_edition_id = registration.race_edition_id
       and stage.status <> 'cancelled'
      join public.season_days as day on day.id = stage.season_day_id
      where roster.rider_id = rider.id
        and roster.status in ('selected', 'confirmed')
        and day.season_id = v_context.season_id
        and day.day_number between p_start_day_number and p_end_day_number
    )
  order by rider.last_name, rider.first_name
  limit 1;

  if v_conflict_name is not null then
    raise exception '% est déjà engagé en course pendant cette plage.', v_conflict_name;
  end if;

  v_doctor_boost_pct := least(
    50,
    public.get_active_team_staff_level(v_context.team_id, 'doctor') * 5
  );
  v_gain := round(
    (case when p_camp_type = 'premium' then 20 else 10 end)
    * (1 + v_doctor_boost_pct / 100.0)
  )::integer;
  v_daily_price := case when p_camp_type = 'premium' then 6000 else 2000 end;
  v_total_price :=
    v_daily_price * v_duration_days * cardinality(v_rider_ids);

  if v_context.cash_balance < v_total_price then
    raise exception 'La trésorerie de l’équipe est insuffisante pour cette sélection.';
  end if;

  with inserted as (
    insert into public.rider_form_camps (
      id,
      rider_id,
      team_season_id,
      season_id,
      camp_type,
      start_day_number,
      end_day_number,
      form_gain_per_day,
      price_per_day,
      total_price
    )
    select
      gen_random_uuid(),
      selected.rider_id,
      v_context.team_season_id,
      v_context.season_id,
      p_camp_type,
      p_start_day_number,
      p_end_day_number,
      v_gain,
      v_daily_price,
      v_daily_price * v_duration_days
    from unnest(v_rider_ids) as selected(rider_id)
    returning id
  )
  select array_agg(inserted.id order by inserted.id)
  into v_camp_ids
  from inserted;

  update public.team_seasons
  set cash_balance = cash_balance - v_total_price
  where id = v_context.team_season_id;

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
    v_context.team_season_id,
    v_context.season_day_id,
    coalesce(v_context.current_day_number, 1),
    -v_total_price,
    'training',
    'posted',
    case
      when p_camp_type = 'premium' then 'Stages de forme premium'
      else 'Stages de forme classiques'
    end
      || ' · ' || cardinality(v_rider_ids)::text
      || ' coureur(s) · J' || p_start_day_number::text
      || case
          when p_end_day_number > p_start_day_number
            then '–J' || p_end_day_number::text
          else ''
        end,
    'form-camp-batch:' || v_booking_id::text,
    now()
  );

  return v_camp_ids;
end;
$$;

-- Compatibilité avec l’ancienne interface pendant un déploiement progressif.
create or replace function public.book_current_team_form_camp(
  p_rider_id uuid,
  p_camp_type text,
  p_duration_days integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_day_number integer;
  v_camp_ids uuid[];
begin
  select coalesce(season.current_day_number, 1)
  into v_current_day_number
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_current_day_number is null then
    raise exception 'Aucune saison active.';
  end if;

  v_camp_ids := public.book_current_team_form_camps(
    array[p_rider_id],
    p_camp_type,
    v_current_day_number + 1,
    v_current_day_number + p_duration_days
  );

  return v_camp_ids[1];
end;
$$;

revoke all on function public.book_current_team_form_camps(uuid[], text, integer, integer)
  from public, anon;
grant execute on function public.book_current_team_form_camps(uuid[], text, integer, integer)
  to authenticated, service_role;

revoke all on function public.book_current_team_form_camp(uuid, text, integer)
  from public, anon;
grant execute on function public.book_current_team_form_camp(uuid, text, integer)
  to authenticated, service_role;

comment on function public.book_current_team_form_camps(uuid[], text, integer, integer) is
  'Planifie atomiquement un stage groupé sur une plage future, bloque les conflits, applique le bonus cumulé des médecins et débite une seule fois la sélection.';

comment on function public.book_current_team_form_camp(uuid, text, integer) is
  'Compatibilité : planifie un stage individuel dès le lendemain via le moteur groupé.';

commit;
