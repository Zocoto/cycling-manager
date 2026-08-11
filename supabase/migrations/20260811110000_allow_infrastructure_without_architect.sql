-- Keep architects optional for every infrastructure project.
-- Without an architect, the project uses its standard cost and duration.

create or replace function public.get_architect_adjusted_reduction(
  p_contract_id uuid,
  p_current_reduction integer,
  p_kind text
)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when p_contract_id is null then 0
    else least(
      45,
      round(
        greatest(0, coalesce(p_current_reduction, 0))
          * public.get_staff_contract_nationality_multiplier(p_contract_id)
        + case p_kind
            when 'cost' then public.get_staff_contract_talent_percentage(
              p_contract_id,
              'architect_construction_cost',
              2
            )
            when 'duration' then public.get_staff_contract_talent_percentage(
              p_contract_id,
              'architect_construction_time',
              2
            )
            else 0
          end
      )
    )::integer
  end;
$$;
comment on function public.get_architect_adjusted_reduction(uuid, integer, text)
is 'Calcule le bonus optionnel d architecte ; retourne zero sans architecte.';
