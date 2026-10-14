begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
-- Only future quotes/functions and unbid market listings change. No existing contract is repriced.
create or replace function public.calculate_rider_salary_profile_score(p_ratings jsonb) returns numeric
language sql immutable set search_path='' as $$ select least(100,greatest(0,.7*greatest(0.55*coalesce((p_ratings->>'mountain')::numeric,45)+0.2*coalesce((p_ratings->>'endurance')::numeric,45)+0.15*coalesce((p_ratings->>'resistance')::numeric,45)+0.1*coalesce((p_ratings->>'recovery')::numeric,45),0.55*coalesce((p_ratings->>'hills')::numeric,45)+0.2*coalesce((p_ratings->>'acceleration')::numeric,45)+0.15*coalesce((p_ratings->>'resistance')::numeric,45)+0.1*coalesce((p_ratings->>'endurance')::numeric,45),0.65*coalesce((p_ratings->>'sprint')::numeric,45)+0.2*coalesce((p_ratings->>'acceleration')::numeric,45)+0.15*coalesce((p_ratings->>'flat')::numeric,45),0.6*coalesce((p_ratings->>'cobbles')::numeric,45)+0.2*coalesce((p_ratings->>'flat')::numeric,45)+0.1*coalesce((p_ratings->>'resistance')::numeric,45)+0.1*coalesce((p_ratings->>'endurance')::numeric,45),0.65*coalesce((p_ratings->>'time_trial')::numeric,45)+0.15*coalesce((p_ratings->>'flat')::numeric,45)+0.1*coalesce((p_ratings->>'resistance')::numeric,45)+0.1*coalesce((p_ratings->>'endurance')::numeric,45),0.35*coalesce((p_ratings->>'flat')::numeric,45)+0.3*coalesce((p_ratings->>'endurance')::numeric,45)+0.2*coalesce((p_ratings->>'resistance')::numeric,45)+0.15*coalesce((p_ratings->>'recovery')::numeric,45))+.3*(coalesce((p_ratings->>'mountain')::numeric,45)+coalesce((p_ratings->>'hills')::numeric,45)+coalesce((p_ratings->>'flat')::numeric,45)+coalesce((p_ratings->>'time_trial')::numeric,45)+coalesce((p_ratings->>'cobbles')::numeric,45)+coalesce((p_ratings->>'sprint')::numeric,45)+coalesce((p_ratings->>'acceleration')::numeric,45)+coalesce((p_ratings->>'downhill')::numeric,45)+coalesce((p_ratings->>'endurance')::numeric,45)+coalesce((p_ratings->>'resistance')::numeric,45)+coalesce((p_ratings->>'recovery')::numeric,45)+coalesce((p_ratings->>'breakaway')::numeric,45)+coalesce((p_ratings->>'prologue')::numeric,45))/13)); $$;
create or replace function public.calculate_rider_salary_base(p_overall numeric) returns numeric
language sql immutable set search_path='' as $$ select case when x<=45 then 6000+(x-0)/45*0
when x<=50 then 6000+(x-45)/5*500
when x<=55 then 6500+(x-50)/5*1000
when x<=60 then 7500+(x-55)/5*1500
when x<=65 then 9000+(x-60)/5*3500
when x<=70 then 12500+(x-65)/5*6000
when x<=75 then 18500+(x-70)/5*9500
when x<=80 then 28000+(x-75)/5*17000
when x<=85 then 45000+(x-80)/5*45000
when x<=90 then 90000+(x-85)/5*70000
when x<=95 then 160000+(x-90)/5*80000
when x<=100 then 240000+(x-95)/5*80000 else 320000 end from (select least(100,greatest(0,coalesce(p_overall,45))) as x) r; $$;
create or replace function public.rider_salary_result_multiplier(p_percentile numeric,p_points numeric) returns numeric
language sql immutable set search_path='' as $$ select case
 when p_points>=1000 and p_percentile>=.99 then 1.25
 when p_points>=300 and p_percentile>=.95 then 1.15
 when p_points>=100 and p_percentile>=.85 then 1.10
 when p_points>=25 and p_percentile>=.70 then 1.05 else 1 end; $$;
create or replace function public.rider_salary_performance_multiplier(p_percentile numeric) returns numeric
language sql immutable set search_path='' as $$ select case when p_percentile>=.99 then 1.25 when p_percentile>=.95 then 1.15 when p_percentile>=.85 then 1.1 when p_percentile>=.7 then 1.05 else 1 end; $$;
create or replace function public.rider_two_season_salary_adjustment(p_age integer) returns integer
language sql immutable set search_path='' as $$ select case when p_age>30 then -25 when p_age<25 then 25 else 10 end; $$;

create or replace function public.calculate_rider_season_salary_quotes(p_rider_ids uuid[],p_season_id uuid)
returns table(rider_id uuid,salary_per_season numeric)
language sql stable security definer set search_path='' as $$
 with target as (select game_year from public.seasons where id=p_season_id),
 population as (
 select rt.rider_id,coalesce(sm.points,0) as points,
 percent_rank() over(order by coalesce(sm.points,0))::numeric as percentile
 from public.rider_season_ratings rt join public.seasons s on s.id=rt.season_id
 cross join target left join public.rider_season_summaries sm on sm.rider_id=rt.rider_id and sm.season_id=rt.season_id
 where s.game_year=target.game_year-1
 ), requested as (select distinct unnest(coalesce(p_rider_ids,array[]::uuid[])) as id)
 select requested.id,round(greatest(6000,least(400000,
 public.calculate_rider_salary_base(public.calculate_rider_salary_profile_score(coalesce(rating.data,'{}'::jsonb)))
 *public.rider_salary_result_multiplier(population.percentile,population.points)))/500)*500
 from requested cross join target
 left join lateral (select to_jsonb(rt) as data from public.rider_season_ratings rt
 join public.seasons s on s.id=rt.season_id where rt.rider_id=requested.id and s.game_year<=target.game_year
 order by s.game_year desc limit 1) rating on true
 left join population on population.rider_id=requested.id;
 $$;
create or replace function public.calculate_rider_season_salary(p_rider_id uuid,p_season_id uuid) returns numeric
language sql stable set search_path='' as $$ select salary_per_season from public.calculate_rider_season_salary_quotes(array[p_rider_id],p_season_id); $$;

do $patch$
declare definition text; needle text := 'then round(v_base_salary * 1.25, 2)';
begin
 definition:=pg_get_functiondef('public.renew_current_team_rider_until(uuid,integer)'::regprocedure);
 if position(needle in definition)=0 then raise exception 'Unexpected renewal definition; salary migration stopped'; end if;
 definition:=replace(definition,needle,
 'then round(v_base_salary * (1 + public.rider_two_season_salary_adjustment((select age from public.rider_season_ratings where rider_id=p_rider_id and season_id=v_context.season_id))::numeric / 100), 2)');
 execute definition;
end $patch$;

-- Refresh only unsold offers without bids. Accepted/pending offers and signed deals keep their quoted terms.
do $market$
declare listing record;
begin
 for listing in select id,rider_id,season_id from public.transfer_market_listings
   where status='open' order by id for update skip locked
 loop
   -- Bid placement locks the listing too. Recheck after acquiring the lock;
   -- a player already bidding keeps the existing offer and salary.
   if not exists(select 1 from public.transfer_market_bids b where b.listing_id=listing.id) then
     update public.transfer_market_listings set salary_per_season=public.calculate_rider_season_salary(listing.rider_id,listing.season_id)
       where id=listing.id;
   end if;
 end loop;
end $market$;
comment on function public.renew_current_team_rider_until(uuid,integer) is 'Future-only renewal; two added seasons cost +25% below age 25, +10% at ages 25-30, -25% above age 30. Existing active salaries stay unchanged.';
notify pgrst,'reload schema';
commit;
