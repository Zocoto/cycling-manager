begin;

delete from public.stage_segment_primes as prime
using
  public.stage_segments as segment,
  public.stages as stage,
  public.race_editions as edition,
  public.races as race
where prime.stage_segment_id = segment.id
  and segment.stage_id = stage.id
  and stage.race_edition_id = edition.id
  and edition.race_id = race.id
  and race.race_format = 'one_day'
  and prime.prime_type = 'mountain';

create or replace function public.prevent_one_day_race_mountain_prime()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.prime_type = 'mountain'
    and exists (
      select 1
      from public.stage_segments as segment
      join public.stages as stage
        on stage.id = segment.stage_id
      join public.race_editions as edition
        on edition.id = stage.race_edition_id
      join public.races as race
        on race.id = edition.race_id
      where segment.id = new.stage_segment_id
        and race.race_format = 'one_day'
    )
  then
    raise exception 'Les GPM sont reserves aux courses par etapes.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
on function public.prevent_one_day_race_mountain_prime()
from public;

drop trigger if exists prevent_one_day_race_mountain_prime
on public.stage_segment_primes;

create trigger prevent_one_day_race_mountain_prime
before insert or update
on public.stage_segment_primes
for each row
execute function public.prevent_one_day_race_mountain_prime();

comment on function public.prevent_one_day_race_mountain_prime() is
  'Empeche les courses d''un jour de recevoir une prime montagne.';

commit;
