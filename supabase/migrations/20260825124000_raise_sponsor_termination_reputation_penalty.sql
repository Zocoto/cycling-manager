begin;

-- La rupture volontaire d'un partenariat principal doit rester une décision
-- exceptionnelle. On modifie la fonction en place sans recopier ses centaines
-- de lignes afin de préserver toutes les sécurités ajoutées au workflow.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.terminate_active_sponsor_contract(uuid)'::regprocedure
  )
  into v_definition;

  if position('v_reputation_penalty integer := 25;' in v_definition) > 0 then
    return;
  end if;

  if position('v_reputation_penalty integer := 10;' in v_definition) = 0 then
    raise exception
      'Le barème attendu de rupture sponsor est introuvable : migration interrompue.';
  end if;

  execute replace(
    v_definition,
    'v_reputation_penalty integer := 10;',
    'v_reputation_penalty integer := 25;'
  );
end;
$$;

comment on function public.terminate_active_sponsor_contract(uuid) is
  'Met fin au sponsor principal avec une pénalité immédiate de 25 points de réputation, sans solde négatif.';

notify pgrst, 'reload schema';

commit;
