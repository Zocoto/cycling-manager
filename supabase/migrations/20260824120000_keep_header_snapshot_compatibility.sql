begin;

-- Vercel peut conserver brièvement une session ouverte sur le déploiement
-- précédent. Le code courant n'appelle plus ce RPC, mais cet alias évite qu'un
-- ancien rendu serveur casse pendant la fenêtre de compatibilité des builds.
create or replace function public.get_current_game_header_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_current_game_header_identity();
$$;

revoke all on function public.get_current_game_header_snapshot()
  from public, anon;
grant execute on function public.get_current_game_header_snapshot()
  to authenticated, service_role;

comment on function public.get_current_game_header_snapshot() is
  'Alias de compatibilité pour les sessions épinglées à un ancien déploiement ; le code courant utilise get_current_game_header_identity.';

notify pgrst, 'reload schema';

commit;
