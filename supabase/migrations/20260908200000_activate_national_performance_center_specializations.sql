-- Le Centre national de performance conserve son bonus général et ajoute
-- l'orientation choisie uniquement à la statistique travaillée par la séance.

create or replace function public.get_national_performance_specialization_bonus_percentage(
  p_country_id uuid,
  p_stat_code text
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    max(
      case
        when specialization.specialization_code = 'altitude_endurance'
          and p_stat_code in ('mountain', 'endurance') then 1.5::numeric
        when specialization.specialization_code = 'altitude_endurance'
          and p_stat_code = 'recovery' then 0.5::numeric
        when specialization.specialization_code = 'speed_power'
          and p_stat_code in ('sprint', 'acceleration') then 1.5::numeric
        when specialization.specialization_code = 'speed_power'
          and p_stat_code = 'prologue' then 0.5::numeric
        when specialization.specialization_code = 'rolling_engine'
          and p_stat_code in ('time_trial', 'flat') then 1.5::numeric
        when specialization.specialization_code = 'rolling_engine'
          and p_stat_code = 'resistance' then 0.5::numeric
        else 0::numeric
      end
      * public.get_infrastructure_specialization_power_multiplier(
          infrastructure.level
        )
    ),
    0::numeric
  )
  from public.national_federation_infrastructures as infrastructure
  cross join lateral (
    select public.get_federation_infrastructure_specialization(
      p_country_id,
      'national_performance_center'
    ) as specialization_code
  ) as specialization
  where infrastructure.country_id = p_country_id
    and infrastructure.infrastructure_code = 'national_performance_center';
$$;

create or replace function public.get_team_national_performance_multiplier(
  p_team_id uuid,
  p_stat_code text
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select 1 + coalesce(
    (
      select
        coalesce(infrastructure.level, 0) * 0.003
        + public.get_national_performance_specialization_bonus_percentage(
            team_season.registration_country_id,
            p_stat_code
          ) / 100
      from public.team_seasons as team_season
      join public.seasons as season
        on season.id = team_season.season_id
       and season.status = 'active'
      left join public.national_federation_infrastructures as infrastructure
        on infrastructure.country_id = team_season.registration_country_id
       and infrastructure.infrastructure_code = 'national_performance_center'
      where team_season.team_id = p_team_id
      limit 1
    ),
    0::numeric
  );
$$;

-- Compatibilité avec les appels techniques qui ne travaillent pas une
-- statistique précise : ils conservent le seul bonus général du bâtiment.
create or replace function public.get_team_national_performance_multiplier(
  p_team_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_team_national_performance_multiplier(p_team_id, null::text);
$$;

do $migration$
declare
  v_definition text;
  v_old_call text :=
    'public.get_team_national_performance_multiplier(v_rider.team_id)';
  v_new_call text :=
    'public.get_team_national_performance_multiplier(v_rider.team_id, v_stat.stat_code)';
begin
  select pg_catalog.pg_get_functiondef(
    'public.settle_due_training_sessions()'::regprocedure
  ) into v_definition;

  if position(v_new_call in v_definition) = 0 then
    if position(v_old_call in v_definition) = 0 then
      raise exception 'Point d’intégration du Centre national de performance introuvable.';
    end if;
    v_definition := replace(v_definition, v_old_call, v_new_call);
    execute v_definition;
  end if;
end;
$migration$;

revoke all on function public.get_national_performance_specialization_bonus_percentage(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_team_national_performance_multiplier(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_team_national_performance_multiplier(uuid)
  from public, anon, authenticated;

grant execute on function public.get_national_performance_specialization_bonus_percentage(uuid, text)
  to service_role;
grant execute on function public.get_team_national_performance_multiplier(uuid, text)
  to service_role;
grant execute on function public.get_team_national_performance_multiplier(uuid)
  to service_role;

comment on function public.get_national_performance_specialization_bonus_percentage(uuid, text) is
  'Bonus de progression ciblé du Centre national de performance, pondéré par son niveau.';
comment on function public.get_team_national_performance_multiplier(uuid, text) is
  'Multiplicateur fédéral total appliqué à une statistique lors d’un entraînement professionnel.';
