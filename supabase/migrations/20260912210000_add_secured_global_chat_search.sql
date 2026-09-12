begin;

create or replace function public.search_current_global_chat_message_ids(
  p_query text,
  p_limit integer default 30
)
returns table (message_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_pattern text;
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 40);
begin
  if char_length(v_query) < 2 or char_length(v_query) > 80 then
    raise exception 'La recherche doit contenir entre 2 et 80 caracteres.';
  end if;

  if not exists (
    select 1
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.teams as team
      on team.id = assignment.team_id
     and team.status = 'active'
    where director.auth_user_id = (select auth.uid())
      and director.status = 'active'
  ) then
    raise exception 'Vous devez diriger une equipe active pour rechercher dans le chat.';
  end if;

  v_pattern := '%' || replace(
    replace(replace(v_query, '\', '\\'), '%', '\%'),
    '_',
    '\_'
  ) || '%';

  return query
  select message.id
  from public.global_chat_messages as message
  where message.created_at >= now() - interval '30 days'
    and (
      message.message ilike v_pattern escape '\'
      or message.author_display_name ilike v_pattern escape '\'
      or message.team_display_name ilike v_pattern escape '\'
      or coalesce(message.source_label, '') ilike v_pattern escape '\'
      or coalesce(message.reply_to_author_display_name, '') ilike v_pattern escape '\'
      or coalesce(message.reply_to_message_excerpt, '') ilike v_pattern escape '\'
    )
  order by message.created_at desc, message.id desc
  limit v_limit;
end;
$$;

revoke all on function public.search_current_global_chat_message_ids(text, integer)
  from public, anon;
grant execute on function public.search_current_global_chat_message_ids(text, integer)
  to authenticated, service_role;

comment on function public.search_current_global_chat_message_ids(text, integer) is
  'Recherche a la demande dans les trente derniers jours du chat general, reservee aux DS actifs.';

commit;
