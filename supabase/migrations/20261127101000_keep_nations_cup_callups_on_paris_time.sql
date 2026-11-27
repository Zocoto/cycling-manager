begin;

set local lock_timeout = '1s';
set local statement_timeout = '8s';

create or replace function public.federation_professional_call_up_is_due(
  p_competition_code text,
  p_departure_at timestamptz,
  p_now timestamptz
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select p_departure_at > p_now
    and p_competition_code in ('world_championship', 'continental_championship', 'nations_cup')
    and p_now >= case p_competition_code
      when 'world_championship' then p_departure_at - interval '96 hours'
      -- Keep the same Paris opening hour even if the clocks change over the weekend.
      when 'nations_cup' then ((p_departure_at at time zone 'Europe/Paris') - interval '52 hours')
        at time zone 'Europe/Paris'
      else p_departure_at - interval '24 hours'
    end;
$$;

commit;
