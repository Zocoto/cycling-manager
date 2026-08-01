create or replace function public.save_current_rider_training_plans(
  p_plans jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_effective_day integer;
begin
  if p_plans is null or jsonb_typeof(p_plans) <> 'array' then
    raise exception 'Les programmes d’entraînement doivent former une liste.';
  end if;

  if jsonb_array_length(p_plans) not between 1 and 35 then
    raise exception 'Entre 1 et 35 programmes peuvent être modifiés ensemble.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_plans) as plan(
      rider_id uuid,
      intensity integer,
      domain text,
      trainer_contract_id uuid
    )
    group by plan.rider_id
    having plan.rider_id is null or count(*) > 1
  ) then
    raise exception 'Chaque coureur doit apparaître une seule fois.';
  end if;

  -- Libérer d’abord les entraîneurs des coureurs modifiés permet de gérer
  -- correctement les permutations entre deux entraîneurs déjà complets.
  -- Toute erreur ultérieure annule ces écritures avec la transaction RPC.
  for v_plan in
    select *
    from jsonb_to_recordset(p_plans) as plan(
      rider_id uuid,
      intensity integer,
      domain text,
      trainer_contract_id uuid
    )
  loop
    if v_plan.rider_id is null
      or v_plan.intensity is null
      or v_plan.domain is null
    then
      raise exception 'Un programme d’entraînement est incomplet.';
    end if;

    v_effective_day := public.save_current_rider_training_plan(
      v_plan.rider_id,
      v_plan.intensity,
      v_plan.domain,
      null
    );
  end loop;

  for v_plan in
    select *
    from jsonb_to_recordset(p_plans) as plan(
      rider_id uuid,
      intensity integer,
      domain text,
      trainer_contract_id uuid
    )
    where plan.trainer_contract_id is not null
  loop
    v_effective_day := public.save_current_rider_training_plan(
      v_plan.rider_id,
      v_plan.intensity,
      v_plan.domain,
      v_plan.trainer_contract_id
    );
  end loop;

  return v_effective_day;
end;
$$;

revoke all on function public.save_current_rider_training_plans(jsonb) from public;
grant execute on function public.save_current_rider_training_plans(jsonb) to authenticated;

comment on function public.save_current_rider_training_plans(jsonb)
is 'Enregistre atomiquement plusieurs programmes individuels et contrôle les quotas sur leur répartition finale.';
