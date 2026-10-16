begin;
set local lock_timeout='3s';
set local statement_timeout='10s';

-- Metadata-only queue. Include interrupted COMPLETED countries whose physical
-- effects remain unapplied; never replay their homologated classification.
create function public.get_due_national_championship_edition_ids(
  p_season_id uuid,p_competition_type text,p_now timestamptz default now()
) returns table(race_edition_id uuid)
language sql stable security definer set search_path='' set statement_timeout='4s' as $$
  select e.id from public.race_editions e
  join public.races r on r.id=e.race_id
  join public.seasons season on season.id=e.season_id and season.status='active'
  where e.season_id=p_season_id and r.competition_type=p_competition_type
    and p_competition_type in('national_time_trial','national_road')
    and e.status<>'cancelled'
    and exists(select 1 from public.stages t where t.race_edition_id=e.id)
    and not exists(select 1 from public.stages t where t.race_edition_id=e.id and (
      t.status='cancelled' or t.departure_at is null or p_now<t.departure_at+
        make_interval(mins=>greatest(8,least(48,round(t.distance_km/6.0)::integer)))))
    and (e.status<>'completed' or exists(
      select 1 from public.stages t join public.race_registrations g on g.race_edition_id=t.race_edition_id and g.status='accepted'
      join public.race_rosters rr on rr.race_registration_id=g.id and rr.status in('selected','confirmed')
      where t.race_edition_id=e.id and not exists(select 1 from public.stage_rider_condition_effects effect
        where effect.stage_id=t.id and effect.rider_id=rr.rider_id)))
  order by e.id limit 250;
$$;
revoke all on function public.get_due_national_championship_edition_ids(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.get_due_national_championship_edition_ids(uuid,text,timestamptz) to service_role;
notify pgrst,'reload schema';
commit;
