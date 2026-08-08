begin;

-- Réduit le coût quotidien des compléments tout en conservant les réductions
-- liées au niveau et aux talents du nutritionniste.
do $migration$
declare
  v_definition text;
  v_marker text;
  v_replacement text;
  v_count integer;
begin
  select pg_get_functiondef(
    'public.apply_current_team_nutrition_intervention(uuid,uuid,text)'::regprocedure
  ) into v_definition;

  for v_marker, v_replacement in
    values
      ('v_base_price := 1500;', 'v_base_price := 500;'),
      ('v_base_price := 3500;', 'v_base_price := 1200;'),
      ('v_base_price := 6500;', 'v_base_price := 2500;')
  loop
    v_count := (
      length(v_definition) - length(replace(v_definition, v_marker, ''))
    ) / length(v_marker);

    if v_count <> 1 then
      raise exception 'Tarif nutrition inattendu pour % (% marqueurs).',
        v_marker,
        v_count;
    end if;

    v_definition := replace(v_definition, v_marker, v_replacement);
  end loop;

  execute v_definition;
end;
$migration$;

create or replace function public.apply_current_team_nutrition_interventions(
  p_interventions jsonb
)
returns uuid[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_intervention jsonb;
  v_rider_id text;
  v_nutritionist_contract_id text;
  v_intervention_code text;
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
    group by entry.value ->> 'riderId'
    having count(*) > 1
  ) then
    raise exception 'Un coureur ne peut recevoir qu’un complément par jour.';
  end if;

  for v_intervention in
    select entry.value
    from jsonb_array_elements(p_interventions) with ordinality as entry(value, position)
    order by entry.position
  loop
    if jsonb_typeof(v_intervention) <> 'object' then
      raise exception 'Une intervention nutritionnelle est invalide.';
    end if;

    v_rider_id := coalesce(v_intervention ->> 'riderId', '');
    v_nutritionist_contract_id := coalesce(
      v_intervention ->> 'nutritionistContractId',
      ''
    );
    v_intervention_code := coalesce(
      v_intervention ->> 'interventionCode',
      ''
    );

    if v_rider_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or v_nutritionist_contract_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or v_intervention_code not in (
        'recovery_snack',
        'tailored_plan',
        'elite_recharge'
      )
    then
      raise exception 'Une intervention nutritionnelle est invalide.';
    end if;

    v_applied_ids := array_append(
      v_applied_ids,
      public.apply_current_team_nutrition_intervention(
        v_rider_id::uuid,
        v_nutritionist_contract_id::uuid,
        v_intervention_code
      )
    );
  end loop;

  return v_applied_ids;
end;
$$;

revoke all on function public.apply_current_team_nutrition_interventions(jsonb)
from public, anon;

grant execute on function public.apply_current_team_nutrition_interventions(jsonb)
to authenticated;

comment on function public.apply_current_team_nutrition_interventions(jsonb) is
  'Applique atomiquement un lot d’un complément maximum par coureur et par jour.';

notify pgrst, 'reload schema';

commit;
