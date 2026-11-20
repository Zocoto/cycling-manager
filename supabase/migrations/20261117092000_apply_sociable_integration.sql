begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';

-- The game stores nationalities without individual languages. Use a
-- conservative set of countries where the same language is widely used.
create function private.rider_integration_language(p_country_code text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when p_country_code in ('AU', 'GB', 'IE', 'NZ', 'US') then 'en'
    when p_country_code in ('FR', 'MC') then 'fr'
    when p_country_code in ('AT', 'DE', 'LI') then 'de'
    when p_country_code in ('IT', 'SM') then 'it'
    when p_country_code in ('BR', 'PT') then 'pt'
    when p_country_code in (
      'AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'ES', 'GT',
      'HN', 'MX', 'NI', 'PA', 'PE', 'PY', 'SV', 'UY', 'VE'
    ) then 'es'
    else null
  end;
$$;

revoke all on function private.rider_integration_language(text)
  from public, anon, authenticated, service_role;

create function public.settle_due_sociable_morale()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day_id uuid;
  v_rider record;
  v_description text;
  v_metadata jsonb;
  v_result jsonb;
  v_applied integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('settle_due_sociable_morale', 0)) then
    return 0;
  end if;

  select day.id into v_day_id
  from public.seasons as season
  join public.season_days as day on day.season_id = season.id
    and day.day_number = coalesce(season.current_day_number, 1)
  where season.status = 'active';
  if not found then return 0; end if;

  for v_rider in
    with professionals as materialized (
      select rider.id, contract.team_id, rider.country_id,
        private.rider_integration_language(country.iso_alpha2) as language,
        'personality:sociable:' || contract.team_id::text as reference
      from public.riders as rider
      join public.rider_contracts as contract
        on contract.rider_id = rider.id and contract.status = 'active'
      join public.countries as country on country.id = rider.country_id
      where rider.personality_key = 'sociable'
        and not exists (
          select 1 from public.rider_morale_events as event
          where event.rider_id = rider.id and (
            (event.source_type = 'social_integration'
              and event.source_reference = 'personality:sociable:' || contract.team_id::text)
            or (event.source_type = 'academy_promotion'
              and event.metadata ->> 'personalityKey' = 'sociable'
              and event.metadata ->> 'teamId' = contract.team_id::text)
          )
        )
    ), juniors as materialized (
      select rider.id, rider.team_id, rider.country_id,
        private.rider_integration_language(country.iso_alpha2) as language,
        'personality:sociable:' || rider.team_id::text as reference
      from public.youth_academy_riders as rider
      join public.countries as country on country.id = rider.country_id
      where rider.personality_key = 'sociable'
        and rider.status in ('active', 'recruited', 'release_pending')
        and not exists (
          select 1 from public.youth_rider_morale_events as event
          where event.academy_rider_id = rider.id
            and event.source_type = 'social_integration'
            and event.source_reference = 'personality:sociable:' || rider.team_id::text
        )
    )
    select *
    from (
      select candidate.id, candidate.team_id, candidate.reference,
        false as is_junior, match.same_country
      from professionals as candidate
      cross join lateral (
        select teammate.country_id = candidate.country_id as same_country
        from public.rider_contracts as contract
        join public.riders as teammate on teammate.id = contract.rider_id
        join public.countries as country on country.id = teammate.country_id
        where contract.team_id = candidate.team_id and contract.status = 'active'
          and teammate.id <> candidate.id
          and (teammate.country_id = candidate.country_id
            or private.rider_integration_language(country.iso_alpha2) = candidate.language)
        order by (teammate.country_id = candidate.country_id) desc
        limit 1
      ) as match
      union all
      select candidate.id, candidate.team_id, candidate.reference,
        true as is_junior, match.same_country
      from juniors as candidate
      cross join lateral (
        select teammate.country_id = candidate.country_id as same_country
        from public.youth_academy_riders as teammate
        join public.countries as country on country.id = teammate.country_id
        where teammate.team_id = candidate.team_id
          and teammate.status in ('active', 'recruited', 'release_pending')
          and teammate.id <> candidate.id
          and (teammate.country_id = candidate.country_id
            or private.rider_integration_language(country.iso_alpha2) = candidate.language)
        order by (teammate.country_id = candidate.country_id) desc
        limit 1
      ) as match
    ) as recipients
    order by id, is_junior
    limit 250
  loop
    v_description := case when v_rider.same_country
      then 'Caractère Sociable · Intégration auprès d’un compatriote'
      else 'Caractère Sociable · Intégration autour d’une langue commune'
    end;
    v_metadata := jsonb_build_object(
      'teamId', v_rider.team_id,
      'personalityKey', 'sociable',
      'integrationCause', case when v_rider.same_country then 'compatriot' else 'shared_language' end
    );
    if v_rider.is_junior then
      v_result := public.apply_youth_rider_morale_event(
        v_rider.id, v_day_id, 'social_integration', v_rider.reference, 1, v_description, v_metadata
      );
    else
      v_result := public.apply_rider_morale_event(
        v_rider.id, v_day_id, 'social_integration', v_rider.reference, 1, v_description, v_metadata
      );
    end if;
    if not coalesce((v_result ->> 'alreadyApplied')::boolean, false) then
      v_applied := v_applied + 1;
    end if;
  end loop;
  return v_applied;
end;
$$;

revoke all on function public.settle_due_sociable_morale()
  from public, anon, authenticated;
grant execute on function public.settle_due_sociable_morale() to service_role;

notify pgrst, 'reload schema';

commit;
