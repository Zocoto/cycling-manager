begin;

alter table public.global_chat_message_reactions
  add column if not exists reactor_display_name text,
  add column if not exists team_id uuid,
  add column if not exists team_display_name text;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.global_chat_message_reactions'::regclass
      and conname = 'global_chat_message_reactions_team_id_fkey'
  ) then
    alter table public.global_chat_message_reactions
      add constraint global_chat_message_reactions_team_id_fkey
      foreign key (team_id)
      references public.teams(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.global_chat_message_reactions'::regclass
      and conname = 'global_chat_message_reactions_reactor_not_empty'
  ) then
    alter table public.global_chat_message_reactions
      add constraint global_chat_message_reactions_reactor_not_empty
      check (reactor_display_name is null or btrim(reactor_display_name) <> '')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.global_chat_message_reactions'::regclass
      and conname = 'global_chat_message_reactions_team_not_empty'
  ) then
    alter table public.global_chat_message_reactions
      add constraint global_chat_message_reactions_team_not_empty
      check (team_display_name is null or btrim(team_display_name) <> '')
      not valid;
  end if;
end;
$migration$;

with resolved_identity as (
  select
    reaction.message_id,
    reaction.sporting_director_id,
    reaction.emoji,
    coalesce(
      nullif(btrim(director.display_name), ''),
      nullif(btrim(director.username), ''),
      'Directeur Sportif'
    ) as reactor_display_name,
    assignment.team_id,
    assignment.team_display_name
  from public.global_chat_message_reactions as reaction
  join public.sporting_directors as director
    on director.id = reaction.sporting_director_id
  left join lateral (
    select
      manager_assignment.team_id,
      coalesce(
        current_team_season.display_name,
        nullif(btrim(team.amateur_name), ''),
        team.internal_name
      ) as team_display_name
    from public.team_manager_assignments as manager_assignment
    join public.teams as team
      on team.id = manager_assignment.team_id
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
    where manager_assignment.sporting_director_id = reaction.sporting_director_id
      and manager_assignment.role = 'general_manager'
    order by
      case when manager_assignment.status = 'active' then 0 else 1 end,
      manager_assignment.created_at desc
    limit 1
  ) as assignment on true
)
update public.global_chat_message_reactions as reaction
set
  reactor_display_name = coalesce(
    reaction.reactor_display_name,
    resolved_identity.reactor_display_name
  ),
  team_id = coalesce(reaction.team_id, resolved_identity.team_id),
  team_display_name = coalesce(
    reaction.team_display_name,
    resolved_identity.team_display_name
  )
from resolved_identity
where reaction.message_id = resolved_identity.message_id
  and reaction.sporting_director_id = resolved_identity.sporting_director_id
  and reaction.emoji = resolved_identity.emoji;

do $migration$
begin
  if not exists (
    select 1
    from public.global_chat_message_reactions
    where reactor_display_name is null
      or team_id is null
      or team_display_name is null
  ) then
    alter table public.global_chat_message_reactions
      alter column reactor_display_name set not null,
      alter column team_id set not null,
      alter column team_display_name set not null;
  end if;
end;
$migration$;

notify pgrst, 'reload schema';

comment on column public.global_chat_message_reactions.reactor_display_name is
  'Public director name stored with the reaction.';

comment on column public.global_chat_message_reactions.team_display_name is
  'Public team name stored with the reaction.';

commit;
