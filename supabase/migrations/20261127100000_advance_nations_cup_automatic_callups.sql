begin;

set local lock_timeout = '1s';
set local statement_timeout = '8s';

-- Open the Sunday 18:00 Nations Cup to the Friday afternoon scheduler.
-- The selection wrapper keeps its separate Olympic invitation window.
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
    and p_now >= p_departure_at - case p_competition_code
      when 'world_championship' then interval '96 hours'
      when 'nations_cup' then interval '52 hours'
      else interval '24 hours'
    end;
$$;

commit;
