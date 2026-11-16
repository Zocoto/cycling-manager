begin;

create function private.rider_personality_for_identity(p_identity uuid)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select (array[
    'franc_tireur', 'opportuniste', 'calculateur', 'solidaire', 'sociable',
    'ambitieux', 'colerique', 'charismatique', 'assidu',
    'imprevisible', 'fonceur', 'cooperatif', 'metronome', 'tenace', 'prudent',
    'fidele', 'mentor', 'collectif', 'globe_trotteur', 'meticuleux', 'perfectionniste',
    'force_tranquille', 'discret', 'franc_parleur', 'chambreur'
  ])[1 + (('x' || left(md5('rider-personality-v1:' || p_identity::text), 8))::bit(32)::bigint % 25)::integer];
$$;

alter table public.riders add column personality_key text;
alter table public.youth_scouting_candidates add column personality_key text;
alter table public.youth_academy_riders add column personality_key text;

-- Give each existing identity an assignment. The scouting record remains
-- the same identity through academy recruitment and professional promotion.
update public.youth_scouting_candidates
set personality_key = private.rider_personality_for_identity(id)
where personality_key is null;

update public.youth_academy_riders as junior
set personality_key = candidate.personality_key
from public.youth_scouting_candidates as candidate
where candidate.id = junior.candidate_id
  and junior.personality_key is null;

update public.youth_academy_riders
set personality_key = private.rider_personality_for_identity(id)
where personality_key is null;

with promoted_juniors as (
  select distinct on (promoted_rider_id) promoted_rider_id, personality_key
  from public.youth_academy_riders
  where promoted_rider_id is not null
  order by promoted_rider_id, (status = 'promoted') desc, signed_at desc, id
)
update public.riders as rider
set personality_key = junior.personality_key
from promoted_juniors as junior
where junior.promoted_rider_id = rider.id
  and rider.personality_key is null;

update public.riders
set personality_key = private.rider_personality_for_identity(id)
where personality_key is null;

alter table public.riders
  alter column personality_key set not null,
  add constraint riders_personality_allowed check (personality_key in (
    'franc_tireur', 'opportuniste', 'calculateur', 'solidaire', 'sociable',
    'ambitieux', 'colerique', 'charismatique', 'assidu',
    'imprevisible', 'fonceur', 'cooperatif', 'metronome', 'tenace', 'prudent',
    'fidele', 'mentor', 'collectif', 'globe_trotteur', 'meticuleux', 'perfectionniste',
    'force_tranquille', 'discret', 'franc_parleur', 'chambreur'
  ));

alter table public.youth_scouting_candidates
  alter column personality_key set not null,
  add constraint youth_scouting_candidates_personality_allowed check (personality_key in (
    'franc_tireur', 'opportuniste', 'calculateur', 'solidaire', 'sociable',
    'ambitieux', 'colerique', 'charismatique', 'assidu',
    'imprevisible', 'fonceur', 'cooperatif', 'metronome', 'tenace', 'prudent',
    'fidele', 'mentor', 'collectif', 'globe_trotteur', 'meticuleux', 'perfectionniste',
    'force_tranquille', 'discret', 'franc_parleur', 'chambreur'
  ));

alter table public.youth_academy_riders
  alter column personality_key set not null,
  add constraint youth_academy_riders_personality_allowed check (personality_key in (
    'franc_tireur', 'opportuniste', 'calculateur', 'solidaire', 'sociable',
    'ambitieux', 'colerique', 'charismatique', 'assidu',
    'imprevisible', 'fonceur', 'cooperatif', 'metronome', 'tenace', 'prudent',
    'fidele', 'mentor', 'collectif', 'globe_trotteur', 'meticuleux', 'perfectionniste',
    'force_tranquille', 'discret', 'franc_parleur', 'chambreur'
  ));

-- Cover every insertion path, including new auctions, seasonal generation,
-- team creation and scouting, without duplicating assignment in each caller.
create function private.assign_generated_rider_personality()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.personality_key := coalesce(new.personality_key, private.rider_personality_for_identity(new.id));
  return new;
end;
$$;

create trigger riders_assign_personality
  before insert on public.riders
  for each row execute function private.assign_generated_rider_personality();

create trigger youth_scouting_candidates_assign_personality
  before insert on public.youth_scouting_candidates
  for each row execute function private.assign_generated_rider_personality();

create function private.assign_academy_rider_personality()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select candidate.personality_key
  into new.personality_key
  from public.youth_scouting_candidates as candidate
  where candidate.id = new.candidate_id;

  new.personality_key := coalesce(new.personality_key, private.rider_personality_for_identity(new.id));
  return new;
end;
$$;

create trigger youth_academy_riders_assign_personality
  before insert on public.youth_academy_riders
  for each row execute function private.assign_academy_rider_personality();

create function private.preserve_promoted_rider_personality()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.promoted_rider_id is not distinct from old.promoted_rider_id then
    return new;
  end if;

  update public.riders as rider
  set personality_key = new.personality_key
  where rider.id = new.promoted_rider_id
    and rider.personality_key is distinct from new.personality_key;

  return new;
end;
$$;

create trigger youth_academy_riders_preserve_promoted_personality
  after insert or update of promoted_rider_id on public.youth_academy_riders
  for each row
  when (new.promoted_rider_id is not null)
  execute function private.preserve_promoted_rider_personality();

revoke all on function private.rider_personality_for_identity(uuid) from public;
revoke all on function private.assign_generated_rider_personality() from public;
revoke all on function private.assign_academy_rider_personality() from public;
revoke all on function private.preserve_promoted_rider_personality() from public;

notify pgrst, 'reload schema';

commit;
