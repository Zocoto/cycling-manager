begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

-- Keep any reactions recorded during the schema transition.
insert into public.gazette_article_reactions (target_key, emoji, sporting_director_id, created_at)
select 'media:' || article_id::text, '👏', sporting_director_id, created_at
from public.cyclogazette_article_reactions
on conflict (target_key, emoji, sporting_director_id) do nothing;

-- Reuse the Gazette reactions and count each reader once per article.
do $upgrade$
declare
  v_definition text := pg_get_functiondef('private.create_season_five_distinctions(uuid)'::regprocedure);
  v_count_anchor constant text := 'count(*)::numeric as reaction_count';
  v_join_anchor constant text := 'join public.cyclogazette_article_reactions as reaction on reaction.article_id = article.id';
begin
  if position(v_count_anchor in v_definition) = 0 or position(v_join_anchor in v_definition) = 0 then
    raise exception 'Unexpected original Gazette award source';
  end if;
  v_definition := replace(v_definition, v_count_anchor,
    'count(distinct reaction.sporting_director_id)::numeric as reaction_count');
  v_definition := replace(v_definition, v_join_anchor,
    'join public.gazette_article_reactions as reaction on reaction.target_key = ''media:'' || article.id::text');
  execute v_definition;
end;
$upgrade$;

drop function public.get_cyclogazette_article_reaction_context(uuid);
drop function public.toggle_cyclogazette_article_reaction(uuid);
drop table public.cyclogazette_article_reactions;

notify pgrst, 'reload schema';
commit;
