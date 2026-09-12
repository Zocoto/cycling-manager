begin;

alter table public.global_chat_messages
  add column if not exists source_race_edition_id uuid
    references public.race_editions(id) on delete cascade,
  add column if not exists source_stage_id uuid
    references public.stages(id) on delete cascade,
  add column if not exists source_label text,
  add column if not exists source_href text;

alter table public.global_chat_messages
  drop constraint if exists global_chat_messages_race_source_complete,
  add constraint global_chat_messages_race_source_complete check (
    (
      source_race_edition_id is null
      and source_stage_id is null
      and source_label is null
      and source_href is null
    )
    or (
      source_race_edition_id is not null
      and source_stage_id is not null
      and btrim(coalesce(source_label, '')) <> ''
      and source_href ~ '^/jeu/resultats/[a-z0-9-]+/[0-9]+$'
    )
  );

create index if not exists global_chat_messages_race_source_created_idx
  on public.global_chat_messages (source_race_edition_id, created_at desc)
  where source_race_edition_id is not null;

create or replace function public.post_race_context_global_chat_message(
  p_stage_id uuid,
  p_message text
)
returns public.global_chat_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stage record;
  v_message text;
  v_result public.global_chat_messages;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour commenter.';
  end if;

  v_message := regexp_replace(btrim(coalesce(p_message, '')), '\s+', ' ', 'g');
  if char_length(v_message) not between 1 and 280 then
    raise exception 'Le message doit contenir entre 1 et 280 caractères.';
  end if;

  select
    stage.id as stage_id,
    stage.race_edition_id,
    stage.stage_number,
    edition.display_name as race_name,
    race.slug as race_slug
  into v_stage
  from public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.races as race on race.id = edition.race_id
  where stage.id = p_stage_id
    and edition.status <> 'cancelled';

  if not found then
    raise exception 'Cette course est introuvable.';
  end if;

  v_result := public.post_global_chat_message_v4(
    v_message,
    null,
    null,
    null,
    array[]::uuid[],
    null,
    null,
    null,
    null,
    null
  );

  update public.global_chat_messages as message
  set
    source_race_edition_id = v_stage.race_edition_id,
    source_stage_id = v_stage.stage_id,
    source_label = v_stage.race_name,
    source_href = '/jeu/resultats/' || v_stage.race_slug || '/' || v_stage.stage_number::text
  where message.id = v_result.id
  returning message.* into v_result;

  return v_result;
end;
$$;

revoke all on function public.post_race_context_global_chat_message(uuid, text)
  from public, anon;
grant execute on function public.post_race_context_global_chat_message(uuid, text)
  to authenticated;

comment on function public.post_race_context_global_chat_message(uuid, text) is
  'Publie un commentaire de course dans le fil general unique en conservant le contexte de la course.';
comment on column public.global_chat_messages.source_race_edition_id is
  'Course depuis laquelle le message general a ete publie, sans dupliquer le message.';

commit;
