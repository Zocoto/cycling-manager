begin;

-- L'administration groupée appelait la fonction unitaire jusqu'à 35 fois.
-- Celle-ci réglait les finances et l'état de santé global à chaque passage :
-- le même travail coûteux pouvait donc être répété 35 fois avant les écritures.
-- La fonction unitaire conserve son comportement autonome, mais saute ces
-- règlements lorsqu'ils ont déjà été effectués par le lot courant.
do $migration$
declare
  v_definition text;
  v_marker text := E'  perform public.settle_current_team_finances();\n  perform public.settle_current_health_and_form();';
  v_replacement text := E'  if current_setting(''app.nutrition_batch_settlement'', true) is distinct from ''settled'' then\n    perform public.settle_current_team_finances();\n    perform public.settle_current_health_and_form_throttled();\n  end if;';
  v_count integer;
begin
  select pg_get_functiondef(
    'public.apply_current_team_nutrition_intervention(uuid,uuid,text)'::regprocedure
  ) into v_definition;

  v_count := (
    length(v_definition) - length(replace(v_definition, v_marker, ''))
  ) / length(v_marker);

  if v_count <> 1 then
    raise exception
      'Impossible de sécuriser le règlement nutritionnel unitaire (% marqueurs).',
      v_count;
  end if;

  execute replace(v_definition, v_marker, v_replacement);
end;
$migration$;

-- Le contrôle de capacité est exécuté une fois par complément. Cet index évite
-- que chaque contrôle reparcourt l'historique nutritionnel de toutes les équipes.
create index if not exists
  rider_nutrition_interventions_nutritionist_day_idx
on public.rider_nutrition_interventions (
  nutritionist_contract_id,
  season_day_id
);

create or replace function public.apply_current_team_nutrition_interventions(
  p_interventions jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
-- Le lot est strictement borné à 35 éléments et toutes ses boucles sont
-- déterministes. Il ne doit pas être annulé par le délai interactif PostgREST
-- après avoir attendu un règlement quotidien légitime.
set statement_timeout = '0'
as $$
declare
  v_intervention jsonb;
  v_applied_ids uuid[] := array[]::uuid[];
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if p_interventions is null
    or jsonb_typeof(p_interventions) <> 'array'
    or jsonb_array_length(p_interventions) < 1
    or jsonb_array_length(p_interventions) > 35
  then
    raise exception 'Sélectionnez entre 1 et 35 compléments à appliquer.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_interventions) as entry(value)
    where jsonb_typeof(entry.value) is distinct from 'object'
      or coalesce(entry.value ->> 'riderId', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(entry.value ->> 'nutritionistContractId', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(entry.value ->> 'interventionCode', '') not in (
        'recovery_snack',
        'tailored_plan',
        'elite_recharge'
      )
  ) then
    raise exception 'Une intervention nutritionnelle est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_interventions) as entry(value)
    group by entry.value ->> 'riderId'
    having count(*) > 1
  ) then
    raise exception 'Un coureur ne peut recevoir qu’un complément par jour.';
  end if;

  -- Une seule actualisation avant le lot. Le verrou quotidien attend un éventuel
  -- traitement concurrent et ne relance jamais le travail déjà terminé.
  perform public.settle_current_team_finances();
  perform public.settle_current_health_and_form_throttled();
  perform set_config(
    'app.nutrition_batch_settlement',
    'settled',
    true
  );

  for v_intervention in
    select entry.value
    from jsonb_array_elements(p_interventions) with ordinality
      as entry(value, position)
    order by entry.position
  loop
    v_applied_ids := array_append(
      v_applied_ids,
      public.apply_current_team_nutrition_intervention(
        (v_intervention ->> 'riderId')::uuid,
        (v_intervention ->> 'nutritionistContractId')::uuid,
        v_intervention ->> 'interventionCode'
      )
    );
  end loop;

  return v_applied_ids;
end;
$$;

revoke all on function public.apply_current_team_nutrition_interventions(jsonb)
from public, anon;

grant execute on function public.apply_current_team_nutrition_interventions(jsonb)
to authenticated, service_role;

comment on function public.apply_current_team_nutrition_interventions(jsonb) is
  'Applique atomiquement un lot borné de compléments après un seul règlement quotidien, sans délai SQL interactif ni scans répétés de capacité.';

notify pgrst, 'reload schema';

commit;
