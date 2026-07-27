begin;

create table public.global_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  team_id uuid not null
    references public.teams(id)
    on delete cascade,
  author_display_name text not null,
  team_display_name text not null,
  message text not null,
  preview_type text,
  preview_entity_id uuid,
  preview_title text,
  preview_subtitle text,
  created_at timestamptz not null default now(),

  constraint global_chat_messages_author_not_empty
    check (btrim(author_display_name) <> ''),
  constraint global_chat_messages_team_not_empty
    check (btrim(team_display_name) <> ''),
  constraint global_chat_messages_message_length
    check (char_length(btrim(message)) between 1 and 500),
  constraint global_chat_messages_preview_complete
    check (
      (
        preview_type is null
        and preview_entity_id is null
        and preview_title is null
        and preview_subtitle is null
      )
      or (
        preview_type in ('team', 'rider')
        and preview_entity_id is not null
        and preview_title is not null
        and preview_subtitle is not null
        and btrim(preview_title) <> ''
        and btrim(preview_subtitle) <> ''
      )
    )
);

create index global_chat_messages_created_idx
  on public.global_chat_messages (created_at desc);

create index global_chat_messages_director_created_idx
  on public.global_chat_messages (sporting_director_id, created_at desc);

alter table public.global_chat_messages enable row level security;

create policy global_chat_messages_select_authenticated
on public.global_chat_messages
for select
to authenticated
using (true);

grant select on table public.global_chat_messages
to authenticated, service_role;

grant all on table public.global_chat_messages
to service_role;

create or replace function public.get_current_global_chat_identity()
returns table (
  sporting_director_id uuid,
  display_name text,
  team_id uuid,
  team_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    director.id,
    director.display_name,
    assignment.team_id,
    coalesce(
      current_team_season.display_name,
      nullif(btrim(team.amateur_name), ''),
      team.internal_name
    )
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.teams as team
    on team.id = assignment.team_id
   and team.status = 'active'
  left join lateral (
    select team_season.display_name
    from public.team_seasons as team_season
    where team_season.team_id = team.id
      and team_season.status in ('planned', 'active')
    order by
      case when team_season.status = 'active' then 0 else 1 end,
      team_season.created_at desc
    limit 1
  ) as current_team_season on true
  where director.auth_user_id = (select auth.uid())
    and director.status = 'active'
  limit 1;
$$;

create or replace function public.post_global_chat_message(
  p_message text,
  p_preview_type text default null,
  p_preview_entity_id uuid default null
)
returns public.global_chat_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_message text;
  v_director_id uuid;
  v_author_name text;
  v_team_id uuid;
  v_team_name text;
  v_preview_type text;
  v_preview_entity_id uuid;
  v_preview_title text;
  v_preview_subtitle text;
  v_result public.global_chat_messages;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour écrire dans le chat.';
  end if;

  v_message := regexp_replace(btrim(coalesce(p_message, '')), '\s+', ' ', 'g');

  if char_length(v_message) not between 1 and 500 then
    raise exception 'Le message doit contenir entre 1 et 500 caractères.';
  end if;

  select
    identity.sporting_director_id,
    identity.display_name,
    identity.team_id,
    identity.team_name
  into
    v_director_id,
    v_author_name,
    v_team_id,
    v_team_name
  from public.get_current_global_chat_identity() as identity;

  if v_director_id is null or v_team_id is null then
    raise exception 'Votre profil de Directeur Sportif ou votre équipe est indisponible.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_director_id::text, 0)
  );

  if exists (
    select 1
    from public.global_chat_messages as recent_message
    where recent_message.sporting_director_id = v_director_id
      and recent_message.created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Patientez un instant avant d’envoyer un nouveau message.';
  end if;

  if (
    select count(*)
    from public.global_chat_messages as recent_message
    where recent_message.sporting_director_id = v_director_id
      and recent_message.created_at > now() - interval '1 minute'
  ) >= 15 then
    raise exception 'Trop de messages ont été envoyés. Réessayez dans une minute.';
  end if;

  if p_preview_type = 'team'
     and p_preview_entity_id is not null
     and strpos(
       lower(v_message),
       '/jeu/equipes/' || lower(p_preview_entity_id::text)
     ) > 0 then
    select
      'team',
      team.id,
      coalesce(
        current_team_season.display_name,
        nullif(btrim(team.amateur_name), ''),
        team.internal_name
      ),
      coalesce(
        'Équipe de ' || nullif(btrim(manager.display_name), ''),
        'Fiche de l’équipe'
      )
    into
      v_preview_type,
      v_preview_entity_id,
      v_preview_title,
      v_preview_subtitle
    from public.teams as team
    left join lateral (
      select team_season.display_name
      from public.team_seasons as team_season
      where team_season.team_id = team.id
        and team_season.status in ('planned', 'active')
      order by
        case when team_season.status = 'active' then 0 else 1 end,
        team_season.created_at desc
      limit 1
    ) as current_team_season on true
    left join public.team_manager_assignments as manager_assignment
      on manager_assignment.team_id = team.id
     and manager_assignment.role = 'general_manager'
     and manager_assignment.status = 'active'
    left join public.sporting_directors as manager
      on manager.id = manager_assignment.sporting_director_id
    where team.id = p_preview_entity_id
      and team.status <> 'dissolved';
  elsif p_preview_type = 'rider'
        and p_preview_entity_id is not null
        and strpos(
          lower(v_message),
          '/jeu/coureurs/' || lower(p_preview_entity_id::text)
        ) > 0 then
    select
      'rider',
      rider.id,
      concat_ws(' ', rider.first_name, rider.last_name),
      coalesce(
        current_team_season.display_name,
        current_team.amateur_name,
        'Fiche du coureur'
      )
    into
      v_preview_type,
      v_preview_entity_id,
      v_preview_title,
      v_preview_subtitle
    from public.riders as rider
    left join public.rider_contracts as rider_contract
      on rider_contract.rider_id = rider.id
     and rider_contract.status = 'active'
    left join public.teams as current_team
      on current_team.id = rider_contract.team_id
    left join lateral (
      select team_season.display_name
      from public.team_seasons as team_season
      where team_season.team_id = current_team.id
        and team_season.status in ('planned', 'active')
      order by
        case when team_season.status = 'active' then 0 else 1 end,
        team_season.created_at desc
      limit 1
    ) as current_team_season on true
    where rider.id = p_preview_entity_id
      and rider.status <> 'retired';
  end if;

  insert into public.global_chat_messages (
    sporting_director_id,
    team_id,
    author_display_name,
    team_display_name,
    message,
    preview_type,
    preview_entity_id,
    preview_title,
    preview_subtitle
  )
  values (
    v_director_id,
    v_team_id,
    v_author_name,
    v_team_name,
    v_message,
    v_preview_type,
    v_preview_entity_id,
    v_preview_title,
    v_preview_subtitle
  )
  returning *
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_current_global_chat_identity()
from public, anon;
revoke all on function public.post_global_chat_message(text, text, uuid)
from public, anon;

grant execute on function public.get_current_global_chat_identity()
to authenticated, service_role;
grant execute on function public.post_global_chat_message(text, text, uuid)
to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'global_chat_messages'
  ) then
    alter publication supabase_realtime
      add table public.global_chat_messages;
  end if;
end;
$$;

comment on table public.global_chat_messages is
  'Fil de discussion général des Directeurs Sportifs connectés.';

comment on function public.post_global_chat_message(text, text, uuid) is
  'Publie un message authentifié, limité en fréquence, avec un aperçu interne validé.';

commit;
