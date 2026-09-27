begin;

do $$
declare
  v_definition text;
  v_patched text;
begin
  v_definition := pg_get_functiondef(
    'public.evaluate_sponsor_objectives_for_contract(uuid, boolean)'::regprocedure
  );
  v_patched := replace(
    v_definition,
    'set reputation_points = least(1000, reputation_points + v_temporary_penalty)',
    'set reputation_points = reputation_points + v_temporary_penalty'
  );
  if v_patched <> v_definition then execute v_patched; end if;
end;
$$;

do $$
declare
  v_definition text;
  v_patched text;
begin
  v_definition := pg_get_functiondef(
    'private.apply_team_rivalry_reward(uuid, text, uuid, uuid, integer, numeric, text)'::regprocedure
  );
  v_patched := replace(
    v_definition,
    'v_applied_reputation := least(
    1000,
    greatest(0, v_previous_reputation + p_requested_reputation)
  ) - v_previous_reputation;',
    'v_applied_reputation := greatest(
    0,
    v_previous_reputation + p_requested_reputation
  ) - v_previous_reputation;'
  );
  if v_patched = v_definition then
    raise exception 'Impossible de retirer le plafond du moteur de rivalités.';
  end if;
  execute v_patched;
end;
$$;

comment on function public.enforce_sporting_director_progression_caps() is
  'Protège la borne basse de réputation et conserve uniquement le plafond d’expérience du niveau 50.';

commit;
