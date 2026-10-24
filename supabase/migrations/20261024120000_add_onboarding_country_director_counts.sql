begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';
set local application_name = 'onboarding-country-counts-20261024';

-- Presentation only. Aggregate on the server; never return player identities.
-- Callable only by the application server, without widening profile access.
create function public.get_onboarding_country_director_counts()
returns table (country_id uuid, director_count bigint)
language sql
stable
security invoker
set search_path = ''
set statement_timeout = '3s'
as $$
  with director_counts as (
    select director.country_id, count(*) as director_count
    from public.sporting_directors as director
    where director.status = 'active'
      and director.auth_user_id is not null
      and director.country_id is not null
      and not exists (
        select 1 from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
           or bot.auth_user_id = director.auth_user_id
      )
    group by director.country_id
  )
  select country.id, coalesce(counts.director_count, 0)::bigint
  from public.countries as country
  left join director_counts as counts on counts.country_id = country.id
  where country.is_active = true;
$$;

revoke all on function public.get_onboarding_country_director_counts() from public, anon, authenticated;
grant execute on function public.get_onboarding_country_director_counts() to service_role;

notify pgrst, 'reload schema';
commit;
