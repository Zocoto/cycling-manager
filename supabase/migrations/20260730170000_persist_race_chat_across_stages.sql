begin;

alter table public.race_live_messages
  add column race_edition_id uuid
  references public.race_editions(id)
  on delete cascade;

update public.race_live_messages as message
set race_edition_id = stage.race_edition_id
from public.stages as stage
where stage.id = message.stage_id
  and message.race_edition_id is null;

alter table public.race_live_messages
  alter column race_edition_id set not null;

create index race_live_messages_edition_created_idx
  on public.race_live_messages (race_edition_id, created_at desc);

create or replace function public.ensure_race_live_message_edition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_race_edition_id uuid;
begin
  select stage.race_edition_id
  into v_race_edition_id
  from public.stages as stage
  where stage.id = new.stage_id;

  if v_race_edition_id is null then
    raise exception 'Etape de course introuvable.';
  end if;

  if new.race_edition_id is null then
    new.race_edition_id := v_race_edition_id;
  elsif new.race_edition_id <> v_race_edition_id then
    raise exception 'Le salon de discussion ne correspond pas a l edition de cette etape.';
  end if;

  return new;
end;
$$;

create trigger race_live_messages_ensure_edition
before insert or update of stage_id, race_edition_id
on public.race_live_messages
for each row
execute function public.ensure_race_live_message_edition();

revoke all on function public.ensure_race_live_message_edition()
from public, anon, authenticated;

comment on column public.race_live_messages.race_edition_id is
  'Edition de course utilisee comme salon commun a toutes les etapes du tour.';

comment on table public.race_live_messages is
  'Messages courts echanges entre Directeurs Sportifs pendant et apres une course, partages entre toutes les etapes d un meme tour.';

commit;
